// Knotide Bio static site generator.
// Reads content/*.json and writes a complete static site to dist/.
// No dependencies: run with `node src/build.mjs`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'content', f), 'utf8'));

const S = read('settings.json');
const LOCALES = { pt: read('pt.json'), en: read('en.json') };
const KB = read('chatbot-kb.json');
const YEAR = new Date().getFullYear();
const VERSION = Date.now().toString(36);
// BASE_PATH lets the same site run under a sub-folder, e.g. https://user.github.io/knotide-site-v2/
// (set automatically by the GitHub Actions workflow). Empty on the real domain.
const BASE = (process.env.BASE_PATH || '').replace(/\/$/, '');
const PREVIEW = BASE !== '';
// Prefix every root-relative URL (href, src, srcset, action, data-*) with BASE.
const withBase = (html) => !BASE ? html : html
  .replace(/(\s(?:href|src|data-privacy|data-src-base)=")\/(?!\/)/g, `$1${BASE}/`)
  .replace(/(\ssrcset=")([^"]+)"/g, (m, a, v) => a + v.replace(/(^|,\s*)\/(?!\/)/g, `$1${BASE}/`) + '"');

const ROUTES = {
  pt: { home: '/', privacy: '/privacidade/' },
  en: { home: '/en/', privacy: '/en/privacy/' },
};

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const strip = (s = '') => String(s).replace(/<[^>]+>/g, '');
const pad = (n) => String(n).padStart(2, '0');

function img(name, widths, alt, { sizes = '100vw', cls = '', eager = false, w, h } = {}) {
  const largest = widths[widths.length - 1] > widths[0] ? widths[widths.length - 1] : widths[0];
  const srcset = widths.map((wd) => `/assets/img/${name}-${wd}.webp ${wd}w`).join(', ');
  const dims = w && h ? ` width="${w}" height="${h}"` : '';
  return `<img src="/assets/img/${name}-${largest}.webp" srcset="${srcset}" sizes="${sizes}" alt="${esc(alt)}"${dims}${cls ? ` class="${cls}"` : ''} ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}

// Wrap a figure such as "35+", "€40M+" or "43" so the number can count up on screen.
function countUp(text) {
  const m = String(text).match(/^(\D*)(\d+(?:[.,]\d+)?)(.*)$/);
  if (!m) return text;
  return `${m[1]}<span class="count" data-to="${m[2].replace(',', '.')}">${m[2]}</span>${m[3]}`;
}

function dataPanel(d) {
  if (!d) return '';
  const bars = d.f2fBars.map((b, i) => `<div class="bar" style="--v:${b.value}"><span class="bar-fill"><span class="bar-note">${b.note}</span></span><span class="bar-year">${b.year}</span></div>`).join('');
  const marks = d.mortMarkers.map((m) => `<li><strong>${m.day}</strong><span>${m.text}</span></li>`).join('');
  return `<div class="data-panel reveal" id="dataPanel">
      <p class="label">${d.label}</p>
      <div class="data-grid">
        <div class="data-card data-loss">
          <p class="data-big">${d.lossPrefix}<span class="count" data-to="${d.lossValue}">${d.lossValue}</span><small>${d.lossUnit}</small></p>
          <p class="data-text">${d.lossText}</p>
        </div>
        <div class="data-card data-mort">
          <p class="data-title">${d.mortTitle}</p>
          <div class="mort-track"><span class="mort-fill"></span></div>
          <div class="mort-ticks" aria-hidden="true"><i style="left:0"></i><i style="left:28.6%"></i><i style="left:85.7%"></i><i style="left:calc(100% - 2px)"></i></div>
          <ol class="mort-marks">${marks}</ol>
          <p class="data-text mort-text">${d.mortText || ''}</p>
        </div>
        <div class="data-card data-f2f">
          <p class="data-title">${d.f2fTitle}</p>
          <div class="bars">${bars}</div>
        </div>
      </div>
      <p class="data-sources">${d.sources}</p>
    </div>`;
}

function head(t, lang, page, { title, description, ogTitle, ogDescription, noindex = false }) {
  const other = lang === 'pt' ? 'en' : 'pt';
  const url = S.siteUrl + ROUTES[lang][page];
  const altUrl = S.siteUrl + ROUTES[other][page];
  const ptUrl = S.siteUrl + ROUTES.pt[page];
  const orgLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Knotide Bio',
    legalName: S.companyName,
    taxID: S.nipc,
    url: S.siteUrl + '/',
    logo: S.siteUrl + '/assets/img/logo-mark.png',
    email: S.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: S.addressLine1,
      postalCode: '4430-204',
      addressLocality: 'Vila Nova de Gaia',
      addressCountry: 'PT',
    },
  };
  return `<!DOCTYPE html>
<html lang="${lang === 'pt' ? 'pt-PT' : 'en'}" data-base="${BASE}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex || PREVIEW ? '<meta name="robots" content="noindex, follow">' : ''}
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="pt-PT" href="${ptUrl}">
<link rel="alternate" hreflang="en" href="${S.siteUrl + ROUTES.en[page]}">
<link rel="alternate" hreflang="x-default" href="${ptUrl}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Knotide Bio">
<meta property="og:locale" content="${lang === 'pt' ? 'pt_PT' : 'en_GB'}">
<meta property="og:locale:alternate" content="${lang === 'pt' ? 'en_GB' : 'pt_PT'}">
<meta property="og:title" content="${esc(ogTitle || title)}">
<meta property="og:description" content="${esc(ogDescription || description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${S.siteUrl}/assets/img/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(ogTitle || title)}">
<meta name="twitter:description" content="${esc(ogDescription || description)}">
<meta name="twitter:image" content="${S.siteUrl}/assets/img/og-image.jpg">
<meta name="theme-color" content="#060B18">
${S.googleSiteVerification ? `<meta name="google-site-verification" content="${esc(S.googleSiteVerification)}">` : ''}
<link rel="icon" type="image/png" href="/assets/img/favicon.png">
<link rel="apple-touch-icon" href="/assets/img/logo-mark.png">
<link rel="preload" href="/assets/fonts/space-grotesk-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/site.css?v=${VERSION}">
<script>
/* Language persistence: honour an explicit earlier choice, without hurting crawlers. */
(function(){try{var want=localStorage.getItem('kb-lang');var here='${lang}';
if(want&&want!==here&&!/[?&]stay=1/.test(location.search)){location.replace('${BASE}${ROUTES[other][page]}'+location.hash);}}catch(e){}})();
</script>
<script type="application/ld+json">${JSON.stringify(orgLd)}</script>
${S.cloudflareAnalyticsToken ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${esc(S.cloudflareAnalyticsToken)}"}'></script>` : ''}
</head>`;
}

function header(t, lang, page) {
  const other = lang === 'pt' ? 'en' : 'pt';
  const h = page === 'home' ? '' : ROUTES[lang].home;
  const links = ['platform', 'applications', 'biosensing', 'services', 'team', 'funding', 'contact'];
  return `<a class="skip" href="#main">${t.nav.skip}</a>
<header class="site-header" id="top">
  <nav class="nav container" aria-label="${lang === 'pt' ? 'Navegação principal' : 'Main navigation'}">
    <a href="${ROUTES[lang].home}" class="logo" aria-label="Knotide Bio">
      <img src="/assets/img/logo-mark.webp" alt="" width="40" height="40">
      <span class="logo-word" aria-label="Knotide Bio"><span class="ch" style="--i:0">K</span><span class="ch" style="--i:1">n</span><span class="ch" style="--i:2">o</span><span class="ch" style="--i:3">t</span><span class="ch" style="--i:4">i</span><span class="ch" style="--i:5">d</span><span class="ch" style="--i:6">e</span><span class="bio"><span class="ch" style="--i:7">B</span><span class="ch" style="--i:8">i</span><span class="ch" style="--i:9">o</span></span></span>
    </a>
    <ul class="nav-links" id="navLinks">
      ${links.map((k) => `<li><a href="${h}#${k}">${t.nav[k]}</a></li>`).join('\n      ')}
    </ul>
    <div class="nav-right">
      <div class="lang-switch" role="group" aria-label="${lang === 'pt' ? 'Idioma' : 'Language'}">
        <a href="${ROUTES.pt[page]}" data-lang="pt" ${lang === 'pt' ? 'aria-current="true"' : `hreflang="pt-PT" lang="pt-PT" title="Ver em português"`}>PT</a>
        <a href="${ROUTES.en[page]}" data-lang="en" ${lang === 'en' ? 'aria-current="true"' : `hreflang="en" lang="en" title="View in English"`}>EN</a>
      </div>
      <a href="${h}#contact" class="btn btn-primary btn-sm nav-cta">${t.nav.cta}</a>
      <button class="nav-toggle" id="navToggle" aria-expanded="false" aria-controls="navLinks" data-open="${t.nav.menu}" data-close="${t.nav.close}">${t.nav.menu}</button>
    </div>
  </nav>
</header>`;
}

function footer(t, lang) {
  return `<footer class="site-footer">
  <div class="container footer-inner">
    <a href="${ROUTES[lang].home}" class="logo logo-footer" aria-label="Knotide Bio"><img src="/assets/img/logo-mark.webp" alt="" width="32" height="32" loading="lazy"><span class="logo-word">Knotide<span>Bio</span></span></a>
    <p class="footer-copy">© ${YEAR} ${S.companyName} · NIPC ${S.nipc} · ${t.footer.rights} · <a href="${ROUTES[lang].privacy}">${t.footer.privacy}</a></p>
  </div>
</footer>`;
}

function widgets(t, lang) {
  const wa = (S.whatsappNumber || '').replace(/[^\d]/g, '');
  const waBtn = wa
    ? `<a class="fab fab-whatsapp" href="https://wa.me/${wa}?text=${encodeURIComponent(t.widgets.whatsappMessage)}" target="_blank" rel="noopener" aria-label="${esc(t.widgets.whatsappLabel)}">
  <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2 7L3 29l6.4-2a13 13 0 0 0 6.6 1.8c7.2 0 13-5.7 13-12.9S23.2 3 16 3Zm0 23.5c-2.1 0-4.1-.6-5.9-1.7l-.4-.2-3.8 1.2 1.2-3.7-.3-.4A10.6 10.6 0 0 1 5.3 16C5.3 10 10.1 5.3 16 5.3S26.7 10 26.7 15.9 21.9 26.5 16 26.5Zm5.9-7.9c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2l-1 1.2c-.2.2-.4.2-.7.1a8.7 8.7 0 0 1-4.3-3.7c-.3-.6.3-.5.9-1.7.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.2 1.4 3.5c.2.2 2.4 3.6 5.8 5 2.1.9 3 1 4 .8.7-.1 1.9-.8 2.2-1.5.3-.7.3-1.4.2-1.5 0-.1-.3-.2-.6-.4Z"/></svg>
</a>` : '';
  const chat = S.showChatAssistant
    ? `<div class="chat" id="chat" data-lang="${lang}" data-privacy="${ROUTES[lang].privacy}">
  <button class="fab fab-chat" id="chatOpen" aria-expanded="false" aria-controls="chatPanel">${t.widgets.chatOpen}</button>
  <div class="chat-panel" id="chatPanel" role="dialog" aria-modal="false" aria-labelledby="chatTitle" hidden>
    <div class="chat-head">
      <span class="chat-avatar" aria-hidden="true"><img src="/assets/img/logo-mark.webp" alt="" width="28" height="28"></span>
      <div class="chat-id"><strong id="chatTitle">${t.widgets.chatTitle}</strong><span class="chat-status">${t.widgets.chatStatus}</span></div>
      <button type="button" class="chat-x" id="chatClose" aria-label="${esc(t.widgets.chatClose)}">×</button>
    </div>
    <div class="chat-log" id="chatLog" aria-live="polite"><p class="msg bot">${t.widgets.chatIntro}</p></div>
    <div class="chat-suggest" id="chatSuggest">${t.widgets.chatSuggestions.map((q) => `<button type="button">${esc(q)}</button>`).join('')}</div>
    <form class="chat-form" id="chatForm"><label class="sr-only" for="chatInput">${t.widgets.chatPlaceholder}</label><textarea id="chatInput" rows="2" autocomplete="off" placeholder="${esc(t.widgets.chatPlaceholder)}"></textarea><button class="chat-send" aria-label="${esc(t.widgets.chatSend)}">${t.widgets.chatSend}</button></form>
    <div class="chat-foot"><a href="#contact" class="chat-talk" id="chatTalk">${t.widgets.chatTalk}</a><p class="chat-note">${t.widgets.chatDisclaimer}</p></div>
    <template id="chatFallback">${t.widgets.chatFallback}</template>
  </div>
</div>` : '';
  return waBtn + chat;
}

function home(lang) {
  const t = LOCALES[lang];
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(S.mapQuery)}&output=embed`;
  const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(S.mapQuery)}`;
  const f = t.form;
  const opt = (arr) => arr.map((o) => `<option>${esc(o)}</option>`).join('');
  return `${head(t, lang, 'home', { title: t.meta.title, description: t.meta.description, ogTitle: t.meta.ogTitle, ogDescription: t.meta.ogDescription })}
<body class="page-home">
${header(t, lang, 'home')}
<main id="main">

<div class="dark-stack">
<div class="glow" aria-hidden="true"></div>
<section class="hero dark" aria-labelledby="hero-title">
  <canvas class="hero-net" aria-hidden="true"></canvas>
  <div class="container hero-grid">
    <div class="hero-copy reveal">
      <p class="eyebrow">${t.hero.eyebrow}</p>
      <h1 id="hero-title">${t.hero.title}</h1>
      <p class="lead">${t.hero.sub}</p>
      <div class="ctas">
        <a href="#contact" class="btn btn-primary">${t.hero.ctaPrimary}</a>
        <a href="#platform" class="btn btn-ghost">${t.hero.ctaSecondary}</a>
      </div>
    </div>
    <div class="hero-art reveal" aria-hidden="true">
      <div class="frame-glow">${img('hero-art', [526], '', { sizes: '(max-width: 900px) 80vw, 460px', eager: true, w: 526, h: 576 })}</div>
    </div>
  </div>
</section>

<section class="stats-band dark" aria-label="${lang === 'pt' ? 'Indicadores' : 'Highlights'}">
  <div class="container">
    <dl class="stats">
      ${t.stats.map((s) => `<div class="stat reveal"><dt>${s.num}</dt><dd>${s.label}</dd></div>`).join('\n      ')}
    </dl>
  </div>
</section>

<section class="photo-band band-abyss" aria-label="${esc(t.photoBand.caption)}">
  <div class="container">
    <figure class="band-frame band-pipette reveal">
      ${img('lab-pipetting-sample', [800, 1584], t.photoBand.alt, { sizes: '(max-width: 1260px) 100vw, 1200px', w: 1584, h: 672 })}
      <figcaption>${t.photoBand.caption}</figcaption>
    </figure>
  </div>
</section>
</div>

<section class="light challenge" aria-labelledby="challenge-title">
  <div class="container">
    <div class="split split-challenge">
      <div class="reveal">
        <p class="label">${t.challenge.label}</p>
        <h2 id="challenge-title">${t.challenge.title}</h2>
        <p>${t.challenge.p1}</p>
        <p>${t.challenge.p2}</p>
      </div>
      <figure class="media-card media-fill photo-cool reveal">${img('indoor-shrimp-aquaculture-facility', [640, 1000], t.challenge.imageAlt, { sizes: '(max-width: 900px) 100vw, 560px', w: 1000, h: 750 })}</figure>
    </div>
    <aside class="callout callout-wide reveal">
      <strong>${t.challenge.calloutTitle}</strong>
      <p>${t.challenge.callout}</p>
    </aside>
    ${dataPanel(t.challenge.data)}
  </div>
</section>

<section id="platform" class="dark platform" aria-labelledby="platform-title">
  <div class="glow glow-soft" aria-hidden="true"></div>
  <div class="container">
    <header class="section-head reveal">
      <p class="label">${t.platform.label}</p>
      <h2 id="platform-title">${t.platform.title}</h2>
      <p class="section-desc">${t.platform.desc}</p>
    </header>
    <div class="pipeline-track" aria-hidden="true"><span></span></div>
    <ol class="pipeline" id="pipeline">
      ${t.platform.steps.map((s, i) => `<li class="reveal"><span class="num">${pad(i + 1)}</span><h3>${s.title}</h3><p>${s.text}</p></li>`).join('\n      ')}
    </ol>
    <div class="design-split">
      <div class="design-copy reveal">
        <h3>${t.platform.designTitle}</h3>
        <p>${t.platform.designText}</p>
        <h4>${t.platform.productionTitle}</h4>
        <p>${t.platform.productionP1}</p>
        <p>${t.platform.productionP2}</p>
      </div>
      <figure class="viewer reveal" id="viewer" data-frames="144" data-pause="${esc(t.viewer.pause)}" data-resume="${esc(t.viewer.resume)}">
        <div class="viewer-stage">
          <img class="viewer-poster" src="/assets/img/molecule/m000.webp" alt="" width="640" height="640" loading="lazy">
          <canvas role="img" aria-label="${esc(t.viewer.aria)}"></canvas>
          <div class="viewer-legend"><span><i class="dot dot-toxin"></i>${t.viewer.toxin}</span><span><i class="dot dot-protein"></i>${t.viewer.protein}</span></div>
        </div>
        <div class="viewer-controls">
          <button type="button" data-act="toggle" aria-pressed="true">${t.viewer.pause}</button>
          <button type="button" data-act="reset">${t.viewer.reset}</button>
          <button type="button" data-act="out" aria-label="${esc(t.viewer.zoomOut)}">−</button>
          <button type="button" data-act="in" aria-label="${esc(t.viewer.zoomIn)}">+</button>
        </div>
        <figcaption>${t.viewer.caption}</figcaption>
      </figure>
    </div>
  </div>
</section>

<section class="photo-band band-navy" aria-label="${esc(t.dnaBand.caption)}">
  <div class="container">
    <figure class="band-frame band-dna reveal" id="dnaBand">
      ${img('dna-helix-lab', [800, 1584], t.dnaBand.alt, { sizes: '(max-width: 1260px) 100vw, 1200px', w: 1584, h: 672 })}
      <span class="dna-glow" aria-hidden="true">${img('dna-helix-lab-halo', [800, 1584], '', { sizes: '(max-width: 1260px) 100vw, 1200px', w: 1584, h: 672, cls: 'dna-halo' })}${img('dna-helix-lab-red', [800, 1584], '', { sizes: '(max-width: 1260px) 100vw, 1200px', w: 1584, h: 672, cls: 'dna-red' })}</span>
      <figcaption>${t.dnaBand.caption}</figcaption>
    </figure>
  </div>
</section>

<section id="applications" class="light" aria-labelledby="applications-title">
  <div class="container">
    <header class="section-head reveal">
      <p class="label">${t.applications.label}</p>
      <h2 id="applications-title">${t.applications.title}</h2>
    </header>
    <div class="pillars">
      ${t.applications.pillars.map((p, i) => `<article class="card pillar reveal"><span class="kicker">${pad(i + 1)}</span><h3>${p.title}</h3><p>${p.text}</p></article>`).join('\n      ')}
    </div>
    <div class="species">
      <p class="species-label">${t.applications.speciesLabel}</p>
      <ul class="species-grid">
        ${t.applications.species.map((s) => `<li class="reveal"><figure><div class="species-photo photo-cool">${img(s.img, [480], s.alt, { sizes: '(max-width: 700px) 45vw, 220px', w: 480, h: 480 })}</div><figcaption>${s.name}</figcaption></figure></li>`).join('\n        ')}
      </ul>
    </div>
    <div class="example">
      <div class="example-copy reveal">
        <span class="tag">${t.applications.exampleTag}</span>
        <p>${t.applications.exampleP}</p>
        <p class="note">${t.applications.exampleNote}</p>
      </div>
      <div class="example-figs reveal">
        <div class="compare" id="compare" style="--t:0">
          <div class="compare-stage">
            ${img('mechanism-panel-a', [480, 820], t.applications.figAAlt, { sizes: '(max-width: 700px) 90vw, 560px', w: 820, h: 1030, cls: 'compare-a' })}
            ${img('mechanism-panel-b', [480, 820], t.applications.figBAlt, { sizes: '(max-width: 700px) 90vw, 560px', w: 820, h: 1030, cls: 'compare-b' })}
            <span class="compare-letter" aria-hidden="true"><span class="la">A</span><span class="lb">B</span></span>
          </div>
          <div class="compare-bar">
            <span class="cb-end">A</span>
            <input type="range" id="compareRange" class="compare-range" min="0" max="100" value="0" aria-label="${esc(t.applications.compare.aria)}">
            <span class="cb-end">B</span>
          </div>
          <p class="compare-caption"><span class="cap-a">${t.applications.figA}</span><span class="cap-b">${t.applications.figB}</span></p>
          <p class="compare-hint">${t.applications.compare.hint}</p>
        </div>
        <p class="fig-caption">${t.applications.figCaption}</p>
      </div>
    </div>
  </div>
</section>

<section id="biosensing" class="light tint" aria-labelledby="biosensing-title">
  <div class="container">
    <header class="section-head reveal">
      <p class="label">${t.biosensing.label}</p>
      <h2 id="biosensing-title">${t.biosensing.title}</h2>
      <p class="section-desc">${t.biosensing.intro}</p>
    </header>
    <div class="bio-grid">
      ${t.biosensing.cards.map((c, i) => `<article class="card bio-card reveal"><span class="kicker">${pad(i + 1)}</span><h3>${c.title}</h3><p>${c.text}</p></article>`).join('\n      ')}
    </div>
  </div>
</section>

<section id="services" class="dark" aria-labelledby="services-title">
  <div class="glow glow-soft" aria-hidden="true"></div>
  <div class="container">
    <header class="section-head reveal">
      <p class="label">${t.services.label}</p>
      <h2 id="services-title">${t.services.title}</h2>
      <p class="section-desc">${t.services.desc}</p>
    </header>
    <ul class="services">
      ${t.services.items.map((s, i) => `<li class="reveal"><span class="num">${pad(i + 1)}</span><h3>${s.title}</h3><p>${s.text}</p></li>`).join('\n      ')}
    </ul>
  </div>
</section>

<section id="team" class="light" aria-labelledby="team-title">
  <div class="container">
    <header class="section-head reveal">
      <p class="label">${t.team.label}</p>
      <h2 id="team-title">${t.team.title}</h2>
      <p class="section-desc">${t.team.desc}</p>
    </header>
    <dl class="team-stats">
      ${t.team.stats.map((s) => `<div class="team-stat reveal"><dt>${countUp(s.num)}</dt><dd>${s.label}</dd></div>`).join('\n      ')}
    </dl>
    <p class="species-label">${t.team.expertiseLabel}</p>
    <div class="expertise">
      ${t.team.expertise.map((e) => `<div class="card exp reveal"><h3>${e.title}</h3><ul>${e.items.map((x) => `<li>${x}</li>`).join('')}</ul></div>`).join('\n      ')}
    </div>
    <div class="team-copy reveal">
      <p>${t.team.p1}</p>
      <p>${t.team.p2}</p>
      <p>${t.team.p3}</p>
    </div>
  </div>
</section>

<section id="funding" class="light tint" aria-labelledby="funding-title">
  <div class="container">
    <div class="funding reveal">
      <div>
        <p class="label">${t.funding.label}</p>
        <h2 id="funding-title">${t.funding.title}</h2>
        <p>${t.funding.text}</p>
      </div>
      <ul class="funding-list">${t.funding.list.map((x) => `<li>${x}</li>`).join('')}</ul>
    </div>
    <div class="calls reveal">
      <div class="calls-head"><p class="label">${t.funding.calls.label}</p><p class="calls-note">${t.funding.calls.note}</p><a href="#contact" class="btn btn-primary btn-sm calls-cta" data-enquiry="${esc(t.form.enquiryTypes[4])}">${t.funding.calls.cta}</a></div>
      <div class="calls-ticker" aria-label="${esc(t.funding.calls.label)}">
        <div class="calls-track">
          ${[0, 1].map((k) => `<ul class="calls-list"${k ? ' aria-hidden="true"' : ''}>
            ${t.funding.calls.items.map((c) => `<li>${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener"${k ? ' tabindex="-1"' : ''}>` : '<div>'}<span class="calls-prog">${c.programme}</span><span class="calls-name">${c.name}</span>${c.url ? '</a>' : '</div>'}</li>`).join('\n            ')}
          </ul>`).join('\n          ')}
        </div>
      </div>
    </div>
  </div>
</section>

<section id="contact" class="dark contact" aria-labelledby="contact-title">
  <div class="glow glow-soft" aria-hidden="true"></div>
  <div class="container contact-grid">
    <div class="contact-info reveal">
      <p class="label">${t.contact.label}</p>
      <h2 id="contact-title">${t.contact.title}</h2>
      <p>${t.contact.text}</p>
      <dl class="contact-detail">
        <dt>${t.contact.emailLabel}</dt><dd><a href="mailto:${S.email}">${S.email}</a></dd>
        <dt>${t.contact.officeLabel}</dt><dd>${S.addressLine1}<br>${S.addressLine2}</dd>
      </dl>
      <div class="map" id="map" data-src="${esc(mapSrc)}" data-title="${esc(t.contact.mapTitle)}">
        <div class="map-facade">
          <button type="button" class="btn btn-ghost btn-sm" id="mapLoad">${t.contact.mapLoad}</button>
          <p>${t.contact.mapNote}</p>
          <a href="${esc(mapLink)}" target="_blank" rel="noopener">${t.contact.mapOpen}</a>
        </div>
      </div>
    </div>

    <form class="contact-form reveal" id="contactForm" action="${esc(S.formEndpoint)}" method="POST" novalidate
      data-sending="${esc(f.sending)}" data-success="${esc(f.success)}" data-error="${esc(f.error)}"
      data-err-required="${esc(f.errRequired)}" data-err-email="${esc(f.errEmail)}" data-err-consent="${esc(f.errConsent)}" data-err-summary="${esc(f.errSummary)}">
      <input type="hidden" name="language" value="${lang}">
      <div class="hp" aria-hidden="true"><label for="f-gotcha">Website</label><input type="text" id="f-gotcha" name="_gotcha" tabindex="-1" autocomplete="off"></div>
      <div class="row2">
        <div class="field"><label for="f-name">${f.name} <span class="req" aria-hidden="true">*</span></label><input id="f-name" name="name" autocomplete="name" required maxlength="120"><span class="err" aria-live="polite"></span></div>
        <div class="field"><label for="f-org">${f.organisation} <span class="opt">(${f.optional})</span></label><input id="f-org" name="organisation" autocomplete="organization" maxlength="160"></div>
      </div>
      <div class="row2">
        <div class="field"><label for="f-email">${f.email} <span class="req" aria-hidden="true">*</span></label><input id="f-email" name="email" type="email" autocomplete="email" required maxlength="160"><span class="err" aria-live="polite"></span></div>
        <div class="field"><label for="f-country">${f.country}</label><select id="f-country" name="country"><option value="">${f.select}</option>${opt(f.countries)}</select></div>
      </div>
      <div class="row2">
        <div class="field"><label for="f-type">${f.enquiryType}</label><select id="f-type" name="enquiry_type"><option value="">${f.select}</option>${opt(f.enquiryTypes)}</select></div>
        <div class="field"><label for="f-subject">${f.subject} <span class="opt">(${f.optional})</span></label><input id="f-subject" name="subject" maxlength="160"></div>
      </div>
      <fieldset class="field chips"><legend>${f.areas}</legend>
        ${f.areaOptions.map((a, i) => `<label class="chip"><input type="checkbox" name="areas" value="${esc(a)}"><span>${a}</span></label>`).join('')}
      </fieldset>
      <div class="field"><label for="f-message">${f.message} <span class="req" aria-hidden="true">*</span></label><textarea id="f-message" name="message" rows="5" required maxlength="5000"></textarea><span class="err" aria-live="polite"></span></div>
      <div class="field consent"><label><input type="checkbox" name="privacy_consent" value="yes" required> <span>${f.consent.replace('{privacy}', ROUTES[lang].privacy)}</span></label><span class="err" aria-live="polite"></span></div>
      <button type="submit" class="btn btn-primary">${f.submit}</button>
      <p class="form-status" role="status" aria-live="polite"></p>
    </form>
  </div>
</section>

</main>
${footer(t, lang)}
${widgets(t, lang)}
<div class="cursor-light" aria-hidden="true"><span class="cursor-halo"></span><span class="cursor-dot"></span></div>
<script src="/assets/js/site.js?v=${VERSION}" defer></script>
</body>
</html>`;
}

function privacy(lang) {
  const t = LOCALES[lang];
  const p = t.privacyPage;
  return `${head(t, lang, 'privacy', { title: p.metaTitle, description: p.metaDescription, noindex: true })}
<body class="page-legal">
${header(t, lang, 'privacy')}
<main id="main" class="legal container">
  <a href="${ROUTES[lang].home}" class="legal-back">← ${p.back}</a>
  <h1>${p.title}</h1>
  <p class="legal-updated">${p.updated}</p>
  <p>${p.intro}</p>
  ${p.sections.map((s) => `<h2>${s.title}</h2>\n  ${s.body}`).join('\n  ')}
</main>
${footer(t, lang)}
<div class="cursor-light" aria-hidden="true"><span class="cursor-halo"></span><span class="cursor-dot"></span></div>
<script src="/assets/js/site.js?v=${VERSION}" defer></script>
</body>
</html>`;
}

function write(rel, content) {
  const file = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, rel.endsWith('.html') ? withBase(content) : content);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dest, e.name);
    e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

// ---------- build ----------
fs.rmSync(DIST, { recursive: true, force: true });
copyDir(path.join(ROOT, 'assets'), path.join(DIST, 'assets'));

// Chat knowledge base: resolve placeholders per language and ship as a small JSON file.
const kbOut = {};
for (const lang of ['pt', 'en']) {
  kbOut[lang] = KB.entries.map((e) => ({ k: e.keywords, a: e[lang].replaceAll('{privacy}', BASE + ROUTES[lang].privacy) }));
}
write('assets/chatbot-kb.json', JSON.stringify(kbOut));

write('index.html', home('pt'));
write('en/index.html', home('en'));
write('privacidade/index.html', privacy('pt'));
write('en/privacy/index.html', privacy('en'));

// Keep old URLs working (the previous site used /privacy.html and /index.html).
const redirect = (to) => `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><link rel="canonical" href="${S.siteUrl}${to}"><meta http-equiv="refresh" content="0; url=${BASE}${to}"><title>Knotide Bio</title></head><body><a href="${to}">Knotide Bio</a></body></html>`;
write('privacy.html', redirect('/en/privacy/'));
write('404.html', redirect('/'));

write('robots.txt', PREVIEW ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\n\nSitemap: ${S.siteUrl}/sitemap.xml\n`);
const today = new Date().toISOString().slice(0, 10);
const urlEntry = (page) => ['pt', 'en'].map((l) => `  <url>
    <loc>${S.siteUrl}${ROUTES[l][page]}</loc>
    <lastmod>${today}</lastmod>
    <xhtml:link rel="alternate" hreflang="pt-PT" href="${S.siteUrl}${ROUTES.pt[page]}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${S.siteUrl}${ROUTES.en[page]}"/>
  </url>`).join('\n');
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlEntry('home')}
${urlEntry('privacy')}
</urlset>
`);
if (!PREVIEW) write('CNAME', 'www.knotidebio.pt\n');
write('.nojekyll', '');

console.log('Built site into', path.relative(process.cwd(), DIST) || DIST, BASE ? `(base path ${BASE}, preview: noindex)` : '');
