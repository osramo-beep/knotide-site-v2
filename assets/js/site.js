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
    var N = parseInt(viewer.dataset.frames, 10) || 144;
    var stage = viewer.querySelector('.viewer-stage');
    var canvas = viewer.querySelector('canvas');
    var ctx = canvas.getContext('2d');
    var btnToggle = viewer.querySelector('[data-act="toggle"]');
    var frames = new Array(N), loaded = 0, started = false, allReady = false;
    var pos = 0, zoom = 1, targetZoom = 1;
    var SPEED = N / 16;            // one full revolution every 16 s
    var playing = !reduceMotion, userPaused = reduceMotion, visible = false;
    var dragging = false, lastX = 0, velocity = 0, resumeTimer = null, last = 0, raf = 0;

    function src(i) { return BASE + '/assets/img/molecule/m' + ('00' + i).slice(-3) + '.webp'; }

    // Load and pre-decode every frame before rotating, so drawing never waits on image decoding.
    function load() {
      if (started) return; started = true;
      for (var i = 0; i < N; i++) (function (i) {
        var im = new Image(); im.decoding = 'async'; im.src = src(i);
        var done = function (bmp) {
          frames[i] = bmp || im; loaded++;
          if (i === 0) { resize(); viewer.classList.add('ready'); }
          if (loaded === N) { allReady = true; kick(); }
        };
        (im.decode ? im.decode() : Promise.resolve())
          .then(function () { return window.createImageBitmap ? createImageBitmap(im) : null; })
          .then(done, function () { done(null); });
      })(i);
    }

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
      if (!canvas.width || !frames[0]) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!allReady) { blit(frames[0], 1); ctx.globalAlpha = 1; return; }
      var p = ((pos % N) + N) % N, i0 = Math.floor(p), f = p - i0, i1 = (i0 + 1) % N;
      // 144 real angles: each one is shown sharp, with only a very short blend into the next
      var k = Math.min(1, Math.max(0, (f - 0.75) / 0.25));
      blit(frames[i0], 1);
      if (k > 0.002) blit(frames[i1], k);
      ctx.globalAlpha = 1;
    }
    function tick(t) {
      raf = 0;
      var dt = last ? Math.min((t - last) / 1000, 0.05) : 0; last = t;
      if (!dragging && allReady) {
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
      var step = dx / (stage.clientWidth / 72);
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
      }, { rootMargin: '400px 0px' }).observe(viewer);
    } else { visible = true; load(); kick(); }
    btnToggle.textContent = userPaused ? viewer.dataset.resume : viewer.dataset.pause;
  })();

  /* ---------- Cursor light ---------- */
  var cl = document.querySelector('.cursor-light');
  if (cl && window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reduceMotion) (function () {
    var dot = cl.querySelector('.cursor-dot'), halo = cl.querySelector('.cursor-halo');
    var x = -100, y = -100, hx = -100, hy = -100, running = false;
    function loop() {
      hx += (x - hx) * 0.14; hy += (y - hy) * 0.14;
      halo.style.transform = 'translate3d(' + hx + 'px,' + hy + 'px,0)';
      if (Math.abs(x - hx) + Math.abs(y - hy) > 0.5) requestAnimationFrame(loop); else running = false;
    }
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX; y = e.clientY;
      dot.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
      cl.classList.add('cursor-on');
      if (!running) { running = true; requestAnimationFrame(loop); }
      var el = e.target;
      cl.classList.toggle('cursor-hover', !!(el.closest && el.closest('a, button, label, select, input, textarea, .viewer-stage')));
      var sec = el.closest && el.closest('section, header, footer');
      cl.classList.toggle('on-light', !!(sec && (sec.classList.contains('light') || sec.classList.contains('site-header'))));
    }, { passive: true });
    document.addEventListener('pointerleave', function () { cl.classList.remove('cursor-on'); });
    document.documentElement.addEventListener('mouseleave', function () { cl.classList.remove('cursor-on'); });
  })();

  /* ---------- Count-up numbers (35+, 45+, €40M+, $43) ---------- */
  var counts = document.querySelectorAll('.count[data-to]');
  if (counts.length && 'IntersectionObserver' in window) {
    var runCount = function (el) {
      var to = parseFloat(el.dataset.to), dec = (el.dataset.to.split('.')[1] || '').length, t0 = null, dur = 1600;
      if (reduceMotion) { el.textContent = el.dataset.to; return; }
      function step(t) {
        if (!t0) t0 = t;
        var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = (to * e).toFixed(dec);
        if (k < 1) requestAnimationFrame(step); else el.textContent = el.dataset.to;
      }
      el.textContent = (0).toFixed(dec); requestAnimationFrame(step);
    };
    var co = new IntersectionObserver(function (en) {
      en.forEach(function (x) { if (x.isIntersecting) { runCount(x.target); co.unobserve(x.target); } });
    }, { threshold: 0.6 });
    counts.forEach(function (el) { co.observe(el); });
  }

  /* ---------- Data panel charts animate when visible ---------- */
  var dp = document.getElementById('dataPanel');
  if (dp && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (en, obs) {
      if (en[0].isIntersecting) { dp.classList.add('in-view'); obs.disconnect(); }
    }, { threshold: 0.35 }).observe(dp);
  } else if (dp) dp.classList.add('in-view');

  /* ---------- Platform pipeline lights up as you scroll ---------- */
  var pipe = document.getElementById('pipeline');
  if (pipe) (function () {
    var track = document.querySelector('.pipeline-track'), steps = pipe.querySelectorAll('li'), ticking = false;
    function update() {
      ticking = false;
      var r = pipe.getBoundingClientRect(), vh = window.innerHeight;
      // 0 when the steps enter the lower part of the screen, 1 when they reach the upper third
      var p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (vh * 0.55)));
      if (track) track.style.setProperty('--p', p.toFixed(3));
      steps.forEach(function (li, i) { li.classList.toggle('lit', p >= (i + 0.35) / steps.length); });
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update); update();
  })();

  /* ---------- Mechanism of action: A fades into B (one panel at a time) ---------- */
  var cmp = document.getElementById('compare');
  if (cmp) (function () {
    var range = document.getElementById('compareRange'), stage = cmp.querySelector('.compare-stage'), dragging = false, x0 = 0, v0 = 0;
    function set(v, animate) {
      v = Math.max(0, Math.min(100, v));
      cmp.classList.toggle('anim', !!animate);
      // steep cross-fade around the middle so the two sets of labels are never shown together for long
      var k = Math.min(1, Math.max(0, (v - 35) / 30)); k = k * k * (3 - 2 * k);
      cmp.style.setProperty('--fa', (1 - k).toFixed(3));
      cmp.style.setProperty('--fb', k.toFixed(3));
      range.value = Math.round(v);
    }
    range.addEventListener('input', function () { cmp.classList.add('used'); set(+range.value); });
    range.addEventListener('change', function () { set(+range.value < 50 ? 0 : 100, true); });
    stage.addEventListener('pointerdown', function (e) { e.preventDefault(); dragging = true; x0 = e.clientX; v0 = +range.value; stage.setPointerCapture(e.pointerId); });
    stage.addEventListener('pointermove', function (e) { if (!dragging) return; cmp.classList.add('used'); set(v0 + ((e.clientX - x0) / stage.clientWidth) * 160); });
    function end(e) {
      if (!dragging) return; dragging = false;
      var moved = Math.abs(e.clientX - x0) > 6;
      // a tap toggles between A and B; a drag settles on the closest panel
      if (!moved) set(+range.value < 50 ? 100 : 0, true); else set(+range.value < 50 ? 0 : 100, true);
      cmp.classList.add('used');
    }
    stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
    set(0);
  })();

  /* ---------- Hero: discreet molecular network that reacts to the pointer ---------- */
  var net = document.querySelector('.hero-net');
  if (net && net.getContext) (function () {
    var ctx = net.getContext('2d'), hero = net.parentElement, nodes = [], W = 0, H = 0, dpr = 1;
    var mouse = { x: -9999, y: -9999 }, visible = true, raf = 0;
    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = hero.clientWidth; H = hero.clientHeight;
      net.width = W * dpr; net.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(Math.min(90, (W * H) / 16000));
      nodes = [];
      for (var i = 0; i < n; i++) nodes.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .25, r: Math.random() * 1.6 + .8 });
      draw();
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      var L = 130;
      for (var i = 0; i < nodes.length; i++) {
        var a = nodes[i];
        if (!reduceMotion) {
          var dx = mouse.x - a.x, dy = mouse.y - a.y, d2 = dx * dx + dy * dy;
          if (d2 < 32000) { a.vx += dx * 0.00002; a.vy += dy * 0.00002; }
          a.x += a.vx; a.y += a.vy; a.vx *= .995; a.vy *= .995;
          if (Math.abs(a.vx) < .05) a.vx += (Math.random() - .5) * .04;
          if (Math.abs(a.vy) < .05) a.vy += (Math.random() - .5) * .04;
          if (a.x < 0 || a.x > W) a.vx *= -1; if (a.y < 0 || a.y > H) a.vy *= -1;
        }
        for (var j = i + 1; j < nodes.length; j++) {
          var b = nodes[j], ex = a.x - b.x, ey = a.y - b.y, d = Math.sqrt(ex * ex + ey * ey);
          if (d < L) { ctx.strokeStyle = 'rgba(34,211,238,' + (0.16 * (1 - d / L)).toFixed(3) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        }
        var md = Math.sqrt((mouse.x - a.x) * (mouse.x - a.x) + (mouse.y - a.y) * (mouse.y - a.y));
        if (md < 180) { ctx.strokeStyle = 'rgba(57,255,160,' + (0.35 * (1 - md / 180)).toFixed(3) + ')'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke(); }
        ctx.fillStyle = md < 180 ? 'rgba(57,255,160,.9)' : 'rgba(0,224,199,.55)';
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.283); ctx.fill();
      }
    }
    function loop() { raf = 0; draw(); if (visible && !document.hidden && !reduceMotion) raf = requestAnimationFrame(loop); }
    function kick() { if (!raf && visible && !reduceMotion) raf = requestAnimationFrame(loop); }
    hero.addEventListener('pointermove', function (e) { var r = hero.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; if (reduceMotion) draw(); });
    hero.addEventListener('pointerleave', function () { mouse.x = mouse.y = -9999; if (reduceMotion) draw(); });
    window.addEventListener('resize', size);
    document.addEventListener('visibilitychange', kick);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; kick(); }).observe(hero);
    size(); kick();
  })();

  /* ---------- DNA band: red glow follows scroll proximity ---------- */
  var dnaBand = document.getElementById('dnaBand');
  if (dnaBand) (function () {
    var ticking = false;
    function update() {
      ticking = false;
      var r = dnaBand.getBoundingClientRect(), vh = window.innerHeight;
      var centre = r.top + r.height / 2, dist = Math.abs(centre - vh / 2) / (vh / 2 + r.height / 2);
      var g = Math.max(0, 1 - dist * 1.25); g = g * g * (3 - 2 * g);
      dnaBand.style.setProperty('--glow', g.toFixed(3));
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update); update();
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

  /* Links that open the form with an enquiry type already chosen */
  document.querySelectorAll('[data-enquiry]').forEach(function (a) {
    a.addEventListener('click', function () {
      var sel = document.getElementById('f-type'); if (!sel) return;
      for (var i = 0; i < sel.options.length; i++) if (sel.options[i].text === a.dataset.enquiry) sel.selectedIndex = i;
    });
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
        var dots = document.createElement('p'); dots.className = 'msg bot typing'; dots.innerHTML = '<i></i><i></i><i></i>';
        log.appendChild(dots); log.scrollTop = log.scrollHeight;
        setTimeout(function () { dots.remove(); add(best && bestScore >= 2 ? best.a : fallback, 'bot'); }, 650);
      }).catch(function () { add(fallback, 'bot'); });
    }
    function setOpen(o) { panel.hidden = !o; openBtn.setAttribute('aria-expanded', o ? 'true' : 'false'); if (o) { getKb(); input.focus(); } }
    openBtn.addEventListener('click', function () { setOpen(panel.hidden); });
    document.getElementById('chatClose').addEventListener('click', function () { setOpen(false); openBtn.focus(); });
    var chatForm = document.getElementById('chatForm');
    chatForm.addEventListener('submit', function (e) { e.preventDefault(); var q = input.value.trim(); if (q) { input.value = ''; answer(q); } });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); chatForm.requestSubmit ? chatForm.requestSubmit() : chatForm.dispatchEvent(new Event('submit')); } });
    document.getElementById('chatTalk').addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { setOpen(false); openBtn.focus(); } });
    document.getElementById('chatSuggest').addEventListener('click', function (e) { if (e.target.tagName === 'BUTTON') answer(e.target.textContent); });
    log.addEventListener('click', function (e) { if (e.target.tagName === 'A' && e.target.getAttribute('href').charAt(0) === '#') setOpen(false); });
  })();
})();
