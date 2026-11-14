/* Ivy's Birthday: interactions and motion. No dependencies. */
(() => {
  'use strict';

  // ---- Event facts: edit here ------------------------------------------
  const EVENT = {
    name: "Ivy's Birthday",
    start: '2026-11-28T15:00:00+03:00', // 3:00 PM, East Africa Time
    end: '2026-11-28T21:00:00+03:00',
    venue: 'Zonetria',
    whatsapp: '254716571448',
    mpesaDisplay: '0716 571 448',
  };

  // Photos shown as polaroids. `pos` is the focal point for the crop.
  const PHOTOS = [
    { n: '02', cap: 'All smiles', pos: '50% 55%', zoom: 1.7 },
    { n: '10', cap: "Hat's off", pos: '50% 20%' },
    { n: '01', cap: 'Sealed with a kiss', pos: '50% 30%' },
    { n: '12', cap: 'Pure joy', pos: '50% 28%' },
    { n: '11', cap: 'Sitting pretty', pos: '50% 18%' },
    { n: '09', cap: 'Double take', pos: '60% 20%' },
    { n: '06', cap: 'In bloom', pos: '50% 35%' },
    { n: '08', cap: 'City lights', pos: '50% 45%' },
    { n: '13', cap: 'Soft glow', pos: '50% 20%' },
    { n: '07', cap: 'Mirror, mirror', pos: '60% 40%' },
    { n: '05', cap: 'Grand entrance', pos: '50% 30%' },
  ];
  // -----------------------------------------------------------------------

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ============ Sky: floating hearts and sparkles on one canvas ============ */
  const sky = $('#sky');
  const sctx = sky.getContext('2d');
  let W = 0, H = 0, DPR = 1;
  const hearts = [], sparks = [], bursts = [];

  function heartPath(c, s) {
    c.beginPath();
    c.moveTo(0, s * 0.3);
    c.bezierCurveTo(-s * 0.5, -s * 0.25, -s, s * 0.2, 0, s * 0.95);
    c.bezierCurveTo(s, s * 0.2, s * 0.5, -s * 0.25, 0, s * 0.3);
    c.closePath();
  }

  // Pre-render glowing heart sprites once so each frame is cheap drawImage calls.
  function makeSprite(size, color, blur) {
    const pad = blur * 2 + 4;
    const c = document.createElement('canvas');
    c.width = c.height = (size * 2 + pad * 2) * DPR;
    const x = c.getContext('2d');
    x.scale(DPR, DPR);
    x.translate(size + pad, pad + size * 0.35);
    x.shadowColor = color; x.shadowBlur = blur;
    const g = x.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, color);
    x.fillStyle = g;
    heartPath(x, size); x.fill();
    return c;
  }
  let sprites = [];

  function resizeSky() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    sky.width = W * DPR; sky.height = H * DPR;
    sctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    sprites = [
      makeSprite(7, '#e2e6f0', 6),
      makeSprite(12, '#c5ccd9', 10),
      makeSprite(20, '#9ea7b8', 16),
      makeSprite(34, '#70798c', 26),
    ];
    seed();
  }

  function newHeart(anywhere) {
    const tier = Math.random() < 0.55 ? 0 : Math.random() < 0.6 ? 1 : Math.random() < 0.7 ? 2 : 3;
    return {
      tier,
      x: rand(0, W), y: anywhere ? rand(0, H) : H + 60,
      vy: rand(0.12, 0.5) * (1 + tier * 0.25),
      sway: rand(8, 26), phase: rand(0, Math.PI * 2), freq: rand(0.4, 1),
      rot: rand(-0.5, 0.5), a: tier === 3 ? rand(0.18, 0.32) : rand(0.35, 0.8),
    };
  }
  function seed() {
    hearts.length = 0; sparks.length = 0;
    const n = Math.round(Math.min(46, Math.max(16, (W * H) / 30000)));
    for (let i = 0; i < n; i++) hearts.push(newHeart(true));
    for (let i = 0; i < n * 1.6; i++) sparks.push({ x: rand(0, W), y: rand(0, H), r: rand(0.5, 1.7), p: rand(0, 6.28), s: rand(0.6, 1.8) });
  }

  // Heart confetti, used when the invitation opens.
  function burst(x, y, count = 70) {
    if (reduceMotion) return;
    for (let i = 0; i < count; i++) {
      const ang = rand(0, Math.PI * 2), sp = rand(2, 11);
      bursts.push({
        x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 3,
        life: 1, decay: rand(0.008, 0.018), tier: Math.random() < 0.7 ? 0 : 1,
        rot: rand(0, 6.28), vr: rand(-0.15, 0.15), white: Math.random() < 0.35,
      });
    }
  }

  let last = 0, running = true;
  function frame(t) {
    if (!running) return;
    const dt = Math.min(48, t - last || 16) / 16.67; last = t;
    sctx.clearRect(0, 0, W, H);

    for (const s of sparks) {
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.001 * s.s + s.p));
      sctx.globalAlpha = tw * 0.75;
      sctx.fillStyle = '#e8ecf4';
      sctx.beginPath(); sctx.arc(s.x, s.y, s.r, 0, 6.28); sctx.fill();
    }

    for (let i = 0; i < hearts.length; i++) {
      const h = hearts[i];
      h.y -= h.vy * dt;
      const x = h.x + Math.sin(t * 0.001 * h.freq + h.phase) * h.sway;
      if (h.y < -80) hearts[i] = newHeart(false);
      const sp = sprites[h.tier];
      const w = sp.width / DPR;
      sctx.globalAlpha = h.a;
      sctx.save();
      sctx.translate(x, h.y);
      sctx.rotate(h.rot + Math.sin(t * 0.0008 + h.phase) * 0.25);
      sctx.drawImage(sp, -w / 2, -w / 2, w, w);
      sctx.restore();
    }

    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.vy += 0.16 * dt; b.vx *= 0.985; b.vy *= 0.985;
      b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt; b.life -= b.decay * dt;
      if (b.life <= 0) { bursts.splice(i, 1); continue; }
      sctx.globalAlpha = Math.max(0, b.life);
      sctx.save(); sctx.translate(b.x, b.y); sctx.rotate(b.rot);
      if (b.white) { sctx.fillStyle = '#ffffff'; heartPath(sctx, 7); sctx.fill(); }
      else { const sp = sprites[b.tier], w = sp.width / DPR; sctx.drawImage(sp, -w / 2, -w / 2, w, w); }
      sctx.restore();
    }
    sctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }

  resizeSky();
  let rz;
  addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(resizeSky, 150); });
  if (reduceMotion) { frame(0); running = false; } else requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => {
    if (reduceMotion) return;
    const was = running; running = !document.hidden;
    if (running && !was) { last = 0; requestAnimationFrame(frame); }
  });

  /* ============ Gate ============ */
  const gate = $('#gate'), openBtn = $('#open-invite');
  function openGate() {
    if (gate.classList.contains('is-open')) return;
    const r = openBtn.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, 90);
    gate.classList.add('is-open');
    document.body.classList.remove('gated');
    document.body.classList.add('is-live');
    try { sessionStorage.setItem('lakiyo-open', '1'); } catch (e) { /* private mode */ }
    setTimeout(() => { gate.hidden = true; }, 1000);
  }
  openBtn.addEventListener('click', openGate);
  let seen = false;
  try { seen = sessionStorage.getItem('lakiyo-open') === '1'; } catch (e) { /* ignore */ }
  if (seen || location.hash) { // returning in the same visit, or a deep link: skip the gate
    gate.classList.add('is-open'); gate.hidden = true;
    document.body.classList.remove('gated'); document.body.classList.add('is-live');
  } else {
    openBtn.focus({ preventScroll: true });
  }

  /* ============ Countdown ============ */
  const target = new Date(EVENT.start).getTime();
  const cells = { d: $('[data-unit="d"]'), h: $('[data-unit="h"]'), m: $('[data-unit="m"]'), s: $('[data-unit="s"]') };
  function setCell(el, v) {
    const txt = String(v).padStart(2, '0');
    if (el.textContent === txt) return;
    el.textContent = txt;
    el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick');
  }
  function tickCountdown() {
    let diff = target - Date.now();
    if (diff <= 0) {
      const cd = $('#countdown');
      if (!cd.dataset.done) {
        cd.dataset.done = '1';
        cd.innerHTML = '<div class="countdown__cell" style="grid-column:1/-1"><b>It\'s party time</b><span>See you at ' + EVENT.venue + '</span></div>';
      }
      return;
    }
    const s = Math.floor(diff / 1000);
    setCell(cells.d, Math.floor(s / 86400));
    setCell(cells.h, Math.floor((s % 86400) / 3600));
    setCell(cells.m, Math.floor((s % 3600) / 60));
    setCell(cells.s, s % 60);
  }
  tickCountdown(); setInterval(tickCountdown, 1000);

  /* ============ Gallery ============ */
  const wrap = $('#polaroids');
  const pin = '<svg class="polaroid__pin" viewBox="0 0 30 28" aria-hidden="true"><path fill="currentColor" d="M15 26S2 18.500 2 9.800A6.800 6.800 0 0 1 15 6.500 6.800 6.800 0 0 1 28 9.800C28 18.500 15 26 15 26z"/></svg>';
  const rots = [-4, 3, -2, 5, 2.500, -3.500, 4, -1.500, 3.500, -4.500, 1.500, -2.500];
  PHOTOS.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'polaroid';
    b.style.setProperty('--rot', rots[i % rots.length] + 'deg');
    b.style.setProperty('--i', i % 4);
    b.style.setProperty('--pos', p.pos);
    b.setAttribute('aria-label', 'Open photo: ' + p.cap);
    b.innerHTML = pin + '<span class="polaroid__img"><img src="images/lakiyo-' + p.n + '.jpg" alt="Ivy in white, ' + p.cap.toLowerCase() + '" loading="lazy" decoding="async"></span><span class="polaroid__cap">' + p.cap + '</span>';
    const img = $('img', b);
    if (p.zoom) { img.style.transformOrigin = p.pos; img.style.scale = p.zoom; }
    img.addEventListener('error', () => b.remove()); // a missing photo never leaves a broken frame
    b.addEventListener('click', () => openLightbox(i));
    wrap.appendChild(b);
  });

  /* ============ Lightbox ============ */
  const lb = $('#lightbox'), lbImg = $('#lightbox-img'), lbCap = $('#lightbox-cap'), lbFig = $('.lightbox__figure');
  let lbIndex = 0, lbReturn = null;
  function showPhoto(i, dir = 0) {
    lbIndex = (i + PHOTOS.length) % PHOTOS.length;
    const p = PHOTOS[lbIndex];
    const swap = () => {
      lbImg.src = 'images/lakiyo-' + p.n + '.jpg';
      lbImg.alt = 'Ivy in white, ' + p.cap.toLowerCase();
      lbCap.textContent = p.cap;
    };
    if (!dir || reduceMotion) return swap();
    lbFig.style.setProperty('--dir', dir * -24 + 'px');
    lbFig.classList.add('is-swap');
    setTimeout(() => {
      swap();
      lbFig.style.setProperty('--dir', dir * 24 + 'px');
      requestAnimationFrame(() => requestAnimationFrame(() => lbFig.classList.remove('is-swap')));
    }, 140);
  }
  function openLightbox(i) {
    lbReturn = document.activeElement;
    showPhoto(i);
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => lb.classList.add('is-on'));
    $('.lightbox__close').focus();
  }
  function closeLightbox() {
    lb.classList.remove('is-on');
    document.body.style.overflow = '';
    setTimeout(() => { lb.hidden = true; }, 240);
    if (lbReturn) lbReturn.focus({ preventScroll: true });
  }
  $('.lightbox__close').addEventListener('click', closeLightbox);
  $('.lightbox__prev').addEventListener('click', () => showPhoto(lbIndex - 1, -1));
  $('.lightbox__next').addEventListener('click', () => showPhoto(lbIndex + 1, 1));
  lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
  addEventListener('keydown', (e) => {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') showPhoto(lbIndex - 1, -1);
    if (e.key === 'ArrowRight') showPhoto(lbIndex + 1, 1);
  });
  let tx = null;
  lb.addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', (e) => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx; tx = null;
    if (Math.abs(dx) > 50) showPhoto(lbIndex + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  });

  /* ============ Scroll reveals ============ */
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
  }, { threshold: 0.16, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal, .polaroid').forEach((el) => io.observe(el));

  /* ============ Scroll-linked bits: top bar, timeline fill, active link ============ */
  const topbar = $('#topbar'), timeline = $('#timeline');
  const navLinks = $$('.topbar__nav a');
  const sections = navLinks.map((a) => $(a.getAttribute('href')));
  let ticking = false;
  function onScroll() {
    ticking = false;
    const y = window.scrollY, vh = window.innerHeight;
    topbar.classList.toggle('is-on', y > vh * 0.5);
    const r = timeline.getBoundingClientRect();
    const fill = Math.min(1, Math.max(0, (vh * 0.62 - r.top) / r.height));
    timeline.style.setProperty('--fill', fill.toFixed(3));
    let active = -1;
    sections.forEach((s, i) => { if (s && s.getBoundingClientRect().top < vh * 0.45) active = i; });
    navLinks.forEach((a, i) => a.classList.toggle('is-active', i === active));
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  /* ============ Hero portrait tilt (pointer devices only) ============ */
  const portrait = $('#portrait'), frameEl = $('.hero__frame');
  if (!reduceMotion && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    portrait.addEventListener('pointermove', (e) => {
      const r = portrait.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      frameEl.style.setProperty('--ry', (px * 10).toFixed(2) + 'deg');
      frameEl.style.setProperty('--rx', (py * -8).toFixed(2) + 'deg');
    });
    portrait.addEventListener('pointerleave', () => { frameEl.style.setProperty('--ry', '0deg'); frameEl.style.setProperty('--rx', '0deg'); });
  }

  /* ============ Fireworks over the finale ============ */
  const fw = $('#fireworks'), fctx = fw.getContext('2d'), finale = $('#rsvp');
  let fwOn = false, fwParts = [], fwW = 0, fwH = 0, fwNext = 0, fwLast = 0;
  const fwColors = ['#ffffff', '#e2e6f0', '#c5ccd9', '#9ea7b8', '#eef1f6'];
  function sizeFw() {
    const r = finale.getBoundingClientRect();
    fwW = r.width; fwH = r.height;
    fw.width = fwW * DPR; fw.height = fwH * DPR;
    fctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  function launch() {
    const x = rand(fwW * 0.12, fwW * 0.88), y = rand(fwH * 0.08, fwH * 0.42);
    const color = fwColors[Math.floor(rand(0, fwColors.length))];
    const n = Math.round(rand(34, 60));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.05, 0.05), sp = rand(1.4, 4.2);
      fwParts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, decay: rand(0.011, 0.02), color });
    }
  }
  function fwFrame(t) {
    if (!fwOn) { fctx.clearRect(0, 0, fwW, fwH); return; }
    const dt = Math.min(48, t - fwLast || 16) / 16.67; fwLast = t;
    fctx.clearRect(0, 0, fwW, fwH);
    if (t > fwNext) { launch(); fwNext = t + rand(650, 1500); }
    fctx.globalCompositeOperation = 'lighter';
    for (let i = fwParts.length - 1; i >= 0; i--) {
      const p = fwParts[i];
      p.vy += 0.035 * dt; p.vx *= 0.985; p.vy *= 0.985;
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= p.decay * dt;
      if (p.life <= 0) { fwParts.splice(i, 1); continue; }
      fctx.globalAlpha = p.life * 0.9;
      fctx.fillStyle = p.color;
      fctx.beginPath(); fctx.arc(p.x, p.y, 1.2 + p.life * 1.4, 0, 6.28); fctx.fill();
    }
    fctx.globalAlpha = 1; fctx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(fwFrame);
  }
  if (!reduceMotion) {
    new IntersectionObserver(([en]) => {
      const was = fwOn; fwOn = en.isIntersecting;
      if (fwOn && !was) { sizeFw(); fwLast = 0; fwNext = 0; requestAnimationFrame(fwFrame); }
    }, { threshold: 0.2 }).observe(finale);
    addEventListener('resize', () => { if (fwOn) sizeFw(); });
  }

  /* ============ RSVP, calendar, share ============ */
  const toast = $('#toast'); let toastT;
  function say(msg) {
    toast.textContent = msg; toast.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('is-on'), 3200);
  }

  const rsvpText = "Hi Ivy! I'll be at your birthday on Saturday 28 November, dressed in plain white. Can't wait to celebrate you!";
  const rsvp = $('#rsvp-btn');
  rsvp.href = 'https://wa.me/' + EVENT.whatsapp + '?text=' + encodeURIComponent(rsvpText);
  rsvp.addEventListener('click', () => {
    const r = rsvp.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, 50);
  });

  $('#cal-btn').addEventListener('click', () => {
    const stamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ivy Birthday//EN', 'BEGIN:VEVENT',
      'UID:ivy-birthday-2026@invite',
      'DTSTAMP:' + stamp(new Date().toISOString()),
      'DTSTART:' + stamp(EVENT.start), 'DTEND:' + stamp(EVENT.end),
      'SUMMARY:' + EVENT.name,
      'LOCATION:' + EVENT.venue,
      'DESCRIPTION:Arrival 3:00 PM. Dress code: plain white outfit. Reservation fee: Ksh 1,000 sent by 18th Nov.',
      'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:' + EVENT.name + ' is tomorrow. Plain white outfit.', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'ivy-birthday.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    say('Saved. Open the file to add it to your calendar.');
  });

  $('#share-btn').addEventListener('click', async () => {
    const data = { title: EVENT.name, text: "You're invited to Ivy's all white birthday, Saturday 28 November at 3:00 PM.", url: location.href.split('#')[0] };
    try {
      if (navigator.share) { await navigator.share(data); return; }
      await navigator.clipboard.writeText(data.url);
      say('Link copied. Send it to the guest list.');
    } catch (e) {
      if (e && e.name !== 'AbortError') say('Copy this link: ' + data.url);
    }
  });

  /* ============ Pay Ksh 1,000 Modal (Direct M-Pesa + Paystack STK) ============ */
  const payModal = $('#pay-modal'), payStatus = $('#pay-status');
  let payReturn = null, pollTimer = null;

  function setPayStatus(msg, type = '') {
    payStatus.textContent = msg;
    payStatus.className = 'paymodal__status' + (type ? ' is-' + type : '');
  }

  function switchPayTab(tabName) {
    $$('[data-pay-tab]', payModal).forEach((t) => {
      const on = t.dataset.payTab === tabName;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $$('[data-pay-panel]', payModal).forEach((p) => {
      p.hidden = p.dataset.payPanel !== tabName;
    });
    setPayStatus('');
  }

  $$('[data-pay-tab]', payModal).forEach((t) => {
    t.addEventListener('click', () => switchPayTab(t.dataset.payTab));
  });

  function openPayModal() {
    payReturn = document.activeElement;
    payModal.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => payModal.classList.add('is-on'));
    $('#pay-close').focus();
  }

  function closePayModal() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    payModal.classList.remove('is-on');
    document.body.style.overflow = '';
    setTimeout(() => { payModal.hidden = true; }, 240);
    if (payReturn) payReturn.focus({ preventScroll: true });
  }

  $$('[data-open-pay]').forEach((btn) => btn.addEventListener('click', openPayModal));
  $('#pay-close').addEventListener('click', closePayModal);
  payModal.addEventListener('click', (e) => { if (e.target === payModal) closePayModal(); });
  addEventListener('keydown', (e) => { if (!payModal.hidden && e.key === 'Escape') closePayModal(); });

  // Auto-select Instant PIN Prompt tab if Paystack Live is active on Vercel
  fetch('/api/paystack-stk').then((r) => r.ok ? r.json() : null).then((cfg) => {
    if (cfg && cfg.configured && cfg.mode === 'live') switchPayTab('stk');
  }).catch(() => {});

  // 1-tap Copy M-Pesa number
  const copyBtn = $('#copy-mpesa');
  copyBtn.addEventListener('click', async () => {
    const raw = EVENT.mpesaDisplay.replace(/\s+/g, '');
    try {
      await navigator.clipboard.writeText(raw);
      copyBtn.textContent = 'Copied!';
      setPayStatus('Number copied (' + raw + '). Paste in M-Pesa Send Money.', 'ok');
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2200);
    } catch {
      setPayStatus('M-Pesa number: ' + raw);
    }
  });

  // Direct M-Pesa confirmation (WhatsApp + optional email alert)
  $('#direct-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#direct-name').value.trim();
    const code = $('#direct-code').value.trim();
    if (!name) return;

    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, code }),
    }).catch(() => {});

    const msg = "Hi Ivy! I've sent the Ksh 1,000 reservation fee to " + EVENT.mpesaDisplay +
      '. Name: ' + name + (code ? ' | M-Pesa Ref: ' + code : '') + '. See you on 28 November!';
    burst(window.innerWidth / 2, window.innerHeight / 2, 70);
    setPayStatus('Opening WhatsApp to confirm with Ivy...', 'ok');
    window.open('https://wa.me/' + EVENT.whatsapp + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  });

  // Paystack STK Push (M-Pesa PIN Prompt)
  const stkBtn = $('#stk-submit');
  $('#stk-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#stk-name').value.trim();
    const phone = $('#stk-phone').value.trim();
    const email = $('#stk-email').value.trim();
    if (!name || !phone) return;

    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    stkBtn.disabled = true;
    stkBtn.querySelector('span').textContent = 'Sending PIN prompt...';
    setPayStatus('Sending M-Pesa STK prompt to ' + phone + '...');

    try {
      const res = await fetch('/api/paystack-stk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email }),
      });
      const data = await res.json();

      if (data.fallback) {
        stkBtn.disabled = false;
        stkBtn.querySelector('span').textContent = 'Send M-Pesa PIN Prompt';
        switchPayTab('direct');
        setPayStatus('Instant PIN prompt is not active yet — send directly to ' + EVENT.mpesaDisplay + ' above.', 'err');
        return;
      }

      if (!res.ok || !data.ok) {
        stkBtn.disabled = false;
        stkBtn.querySelector('span').textContent = 'Send M-Pesa PIN Prompt';
        setPayStatus(data.error || 'Could not send prompt. Try Send to M-Pesa tab.', 'err');
        return;
      }

      setPayStatus(data.display_text || 'Check your phone and enter your M-Pesa PIN...');
      stkBtn.querySelector('span').textContent = 'Waiting for PIN...';

      const ref = data.reference;
      let attempts = 0;
      pollTimer = setInterval(async () => {
        attempts++;
        if (attempts > 45) {
          clearInterval(pollTimer); pollTimer = null;
          stkBtn.disabled = false;
          stkBtn.querySelector('span').textContent = 'Send M-Pesa PIN Prompt';
          setPayStatus('Timed out waiting for M-Pesa confirmation. If you paid, confirm on WhatsApp.', 'err');
          return;
        }
        try {
          const vr = await fetch('/api/paystack-verify?reference=' + encodeURIComponent(ref));
          const vd = await vr.json();
          if (vd.status === 'success') {
            clearInterval(pollTimer); pollTimer = null;
            stkBtn.disabled = false;
            stkBtn.querySelector('span').textContent = 'Paid — Thank you!';
            burst(window.innerWidth / 2, window.innerHeight / 2, 90);
            setPayStatus('Ksh 1,000 received! Ivy has been notified.', 'ok');
          } else if (vd.status === 'failed' || vd.status === 'abandoned') {
            clearInterval(pollTimer); pollTimer = null;
            stkBtn.disabled = false;
            stkBtn.querySelector('span').textContent = 'Send M-Pesa PIN Prompt';
            setPayStatus(vd.gateway_response || 'Payment was cancelled or failed. Try again.', 'err');
          }
        } catch { /* retry next tick */ }
      }, 3000);
    } catch {
      stkBtn.disabled = false;
      stkBtn.querySelector('span').textContent = 'Send M-Pesa PIN Prompt';
      setPayStatus('Network error. Please use the Send to M-Pesa tab.', 'err');
    }
  });
})();
