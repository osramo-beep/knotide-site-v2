/* Knotide Bio. Site behaviour (no dependencies). */
(function () {
  'use strict';
  var doc = document.documentElement;
  var BASE = doc.getAttribute('data-base') || '';
  doc.classList.add('js');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Language choice persistence ---------- */
  document.querySelectorAll('.lang-switch a[data-lang]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      try { localStorage.setItem('kb-lang', a.dataset.lang); } catch (err) {}
      if (location.hash) { e.preventDefault(); location.href = a.getAttribute('href') + location.hash; }
    });
  });

  /* Show floating buttons on small screens only after the hero */
  var onScroll = function () { doc.classList.toggle('scrolled', window.scrollY > window.innerHeight * 0.9); };
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ---------- Mobile menu ---------- */
  var toggle = document.getElementById('navToggle');
  var links = document.getElementById('navLinks');
  if (toggle && links) {
    var setOpen = function (open) {
      links.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.textContent = open ? toggle.dataset.close : toggle.dataset.open;
    };
    toggle.addEventListener('click', function () { setOpen(!links.classList.contains('open')); });
    links.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
  }

  /* ---------- Reveal on scroll ---------- */
  var reveals = document.querySelectorAll('.reveal');
  if (!reduceMotion && 'IntersectionObserver' in window) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); ro.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { ro.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- Molecule viewer ----------
     Smooth turntable: 48 pre-aligned frames with transparent background.
     Playback interpolates between neighbouring frames (cross-fade), so the
     rotation is continuous instead of jumping frame to frame. */
  var viewer = document.getElementById('viewer');
  if (viewer) (function () {
    var N = parseInt(viewer.dataset.frames, 10) || 48;
    var stage = viewer.querySelector('.viewer-stage');
    var canvas = viewer.querySelector('canvas');
    var ctx = canvas.getContext('2d');
    var btnToggle = viewer.querySelector('[data-act="toggle"]');
    var frames = new Array(N), loaded = 0, started = false;
    var pos = 0, zoom = 1, targetZoom = 1;
    var SPEED = N / 18;            // one full revolution every 18 s
    var playing = !reduceMotion, userPaused = reduceMotion, visible = false;
    var dragging = false, lastX = 0, velocity = 0, resumeTimer = null, last = 0, raf = 0;

    function src(i) { return BASE + '/assets/img/molecule/m' + (i < 10 ? '0' : '') + i + '.webp'; }
    function ok(img) { return img && img.complete && img.naturalWidth > 0; }

    function load() {
      if (started) return; started = true;
      // Load every 4th frame first so rotation can start quickly, then fill the gaps.
      var order = [];
      for (var s = 0; s < 4; s++) for (var i = s; i < N; i += 4) order.push(i);
      order.forEach(function (i) {
        var im = new Image(); im.decoding = 'async';
        im.onload = function () { loaded++; if (i === 0) { resize(); viewer.classList.add('ready'); } };
        im.src = src(i); frames[i] = im;
      });
    }
    function nearest(i, dir) { for (var k = 0; k < N; k++) { var j = ((i + dir * k) % N + N) % N; if (ok(frames[j])) return j; } return -1; }

    function resize() {
      var r = stage.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
      draw();
    }
    function blit(img, alpha) {
      var cw = canvas.width, ch = canvas.height, s = Math.min(cw, ch) * zoom;
      ctx.globalAlpha = alpha; ctx.drawImage(img, (cw - s) / 2, (ch - s) / 2, s, s);
    }
    function draw() {
      if (!canvas.width) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      var p = ((pos % N) + N) % N, i0 = Math.floor(p), f = p - i0, i1 = (i0 + 1) % N;
      var a = ok(frames[i0]) ? i0 : nearest(i0, -1), b = ok(frames[i1]) ? i1 : nearest(i1, 1);
      if (a < 0) return;
      blit(frames[a], 1);
      if (b >= 0 && b !== a && f > 0.001) blit(frames[b], f);
      ctx.globalAlpha = 1;
    }
    function tick(t) {
      raf = 0;
      var dt = last ? Math.min((t - last) / 1000, 0.05) : 0; last = t;
      if (!dragging) {
        if (playing) pos += SPEED * dt;
        if (Math.abs(velocity) > 0.01) { pos += velocity * dt; velocity *= Math.pow(0.04, dt); } else velocity = 0;
      }
      zoom += (targetZoom - zoom) * Math.min(1, dt * 10);
      draw();
      if (visible && !document.hidden && (playing || dragging || velocity || Math.abs(targetZoom - zoom) > 0.002)) raf = requestAnimationFrame(tick);
      else last = 0;
    }
    function kick() { if (!raf && visible) { last = 0; raf = requestAnimationFrame(tick); } }

    function setPlaying(on, byUser) {
      if (byUser) userPaused = !on;
      playing = on;
      btnToggle.textContent = userPaused ? viewer.dataset.resume : viewer.dataset.pause;
      btnToggle.setAttribute('aria-pressed', userPaused ? 'false' : 'true');
      kick();
    }

    stage.addEventListener('pointerdown', function (e) {
      dragging = true; lastX = e.clientX; velocity = 0; playing = false; clearTimeout(resumeTimer);
      stage.setPointerCapture && stage.setPointerCapture(e.pointerId); kick();
    });
    stage.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - lastX; lastX = e.clientX;
      var step = dx / (stage.clientWidth / 24);   // dragging across half the stage = half a turn
      pos += step; velocity = step * 60;
    });
    function endDrag() {
      if (!dragging) return; dragging = false; kick();
      if (!userPaused) resumeTimer = setTimeout(function () { setPlaying(true); }, 2500);
    }
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);

    viewer.querySelector('.viewer-controls').addEventListener('click', function (e) {
      var act = e.target.dataset && e.target.dataset.act; if (!act) return;
      if (act === 'toggle') setPlaying(userPaused, true);
      if (act === 'reset') { pos = 0; velocity = 0; targetZoom = 1; setPlaying(!reduceMotion, true); draw(); }
      if (act === 'in') targetZoom = Math.min(1.8, targetZoom + 0.2);
      if (act === 'out') targetZoom = Math.max(0.7, targetZoom - 0.2);
      kick();
    });

    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', kick);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        visible = en[0].isIntersecting;
        if (visible) { load(); kick(); }
      }, { rootMargin: '300px 0px' }).observe(viewer);
    } else { visible = true; load(); kick(); }
    btnToggle.textContent = userPaused ? viewer.dataset.resume : viewer.dataset.pause;
  })();

  /* ---------- Map (click to load, keeps the site cookie-free by default) ---------- */
  var mapBtn = document.getElementById('mapLoad');
  if (mapBtn) mapBtn.addEventListener('click', function () {
    var box = document.getElementById('map');
    var f = document.createElement('iframe');
    f.src = box.dataset.src; f.title = box.dataset.title; f.loading = 'lazy';
    f.referrerPolicy = 'no-referrer-when-downgrade'; f.allowFullscreen = true;
    box.innerHTML = ''; box.appendChild(f);
  });

  /* ---------- Contact form (Formspree) ---------- */
  var form = document.getElementById('contactForm');
  if (form) (function () {
    var D = form.dataset, status = form.querySelector('.form-status'), btn = form.querySelector('button[type="submit"]');
    var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    function setErr(el, msg) {
      var field = el.closest('.field'); if (!field) return;
      field.classList.toggle('invalid', !!msg);
      var e = field.querySelector('.err'); if (e) e.textContent = msg || '';
      el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    }
    function validate() {
      var first = null;
      [['name'], ['email', 'email'], ['message']].forEach(function (r) {
        var el = form.elements[r[0]], v = el.value.trim(), msg = '';
        if (!v) msg = D.errRequired; else if (r[1] === 'email' && !emailRe.test(v)) msg = D.errEmail;
        setErr(el, msg); if (msg && !first) first = el;
      });
      var c = form.elements.privacy_consent;
      setErr(c, c.checked ? '' : D.errConsent); if (!c.checked && !first) first = c;
      return first;
    }
    form.addEventListener('input', function (e) { if (e.target.closest('.field.invalid')) validate(); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.className = 'form-status'; status.textContent = '';
      var bad = validate();
      if (bad) { status.className = 'form-status bad'; status.textContent = D.errSummary; bad.focus(); return; }
      if (form.elements._gotcha.value) return; // bot

      var fd = new FormData(form);
      var areas = fd.getAll('areas'); fd.delete('areas');
      fd.set('areas_of_interest', areas.join(', '));
      fd.set('_subject', '[Knotide Bio] ' + (fd.get('enquiry_type') || 'Contacto') + ': ' + fd.get('name'));
      var label = btn.textContent; btn.disabled = true; btn.textContent = D.sending;
      fetch(form.action, { method: 'POST', body: fd, headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok) { form.reset(); status.className = 'form-status ok'; status.textContent = D.success; }
          else throw new Error((res.j && res.j.errors && res.j.errors.map(function (x) { return x.message; }).join(' ')) || 'error');
        })
        .catch(function () {
          var body = encodeURIComponent((fd.get('message') || '') + '\n\n' + (fd.get('name') || '') + (fd.get('organisation') ? ' | ' + fd.get('organisation') : ''));
          status.className = 'form-status bad';
          status.innerHTML = '';
          var parts = D.error.split('info@knotidebio.pt');
          status.appendChild(document.createTextNode(parts[0]));
          var a = document.createElement('a'); a.href = 'mailto:info@knotidebio.pt?subject=' + encodeURIComponent(fd.get('_subject')) + '&body=' + body; a.textContent = 'info@knotidebio.pt';
          status.appendChild(a);
          if (parts[1]) status.appendChild(document.createTextNode(parts[1]));
        })
        .then(function () { btn.disabled = false; btn.textContent = label; });
    });
  })();

  /* ---------- Chat assistant (keyword matching on site content only) ---------- */
  var chat = document.getElementById('chat');
  if (chat) document.getElementById('chatOpen').setAttribute('aria-label', document.getElementById('chatOpen').textContent);
  if (chat) (function () {
    var lang = chat.dataset.lang, openBtn = document.getElementById('chatOpen'), panel = document.getElementById('chatPanel');
    var log = document.getElementById('chatLog'), input = document.getElementById('chatInput'), kb = null;
    var fallback = document.getElementById('chatFallback').innerHTML;
    function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
    function getKb() {
      if (kb) return Promise.resolve(kb);
      return fetch(BASE + '/assets/chatbot-kb.json').then(function (r) { return r.json(); }).then(function (j) { kb = j[lang]; return kb; });
    }
    function add(html, who) { var p = document.createElement('p'); p.className = 'msg ' + who; if (who === 'user') p.textContent = html; else p.innerHTML = html; log.appendChild(p); log.scrollTop = log.scrollHeight; }
    function answer(q) {
      add(q, 'user');
      getKb().then(function (entries) {
        var words = norm(q).split(/[^a-z0-9]+/).filter(function (w) { return w.length > 2; });
        var best = null, bestScore = 0;
        entries.forEach(function (e) {
          var score = 0;
          e.k.forEach(function (kw) {
            var k = norm(kw);
            if (k.indexOf(' ') > -1) { if (norm(q).indexOf(k) > -1) score += 3; return; }
            words.forEach(function (w) {
              if (w === k) score += 2 + k.length / 10;
              else if (w.length > 4 && k.length > 4 && (w.indexOf(k) === 0 || k.indexOf(w) === 0 || w.slice(0, -1) === k.slice(0, -1))) score += 2;
            });
          });
          if (score > bestScore) { bestScore = score; best = e; }
        });
        setTimeout(function () { add(best && bestScore >= 2 ? best.a : fallback, 'bot'); }, 250);
      }).catch(function () { add(fallback, 'bot'); });
    }
    function setOpen(o) { panel.hidden = !o; openBtn.setAttribute('aria-expanded', o ? 'true' : 'false'); if (o) { getKb(); input.focus(); } }
    openBtn.addEventListener('click', function () { setOpen(panel.hidden); });
    document.getElementById('chatClose').addEventListener('click', function () { setOpen(false); openBtn.focus(); });
    document.getElementById('chatForm').addEventListener('submit', function (e) { e.preventDefault(); var q = input.value.trim(); if (q) { input.value = ''; answer(q); } });
    document.getElementById('chatSuggest').addEventListener('click', function (e) { if (e.target.tagName === 'BUTTON') answer(e.target.textContent); });
    log.addEventListener('click', function (e) { if (e.target.tagName === 'A' && e.target.getAttribute('href').charAt(0) === '#') setOpen(false); });
  })();
})();
