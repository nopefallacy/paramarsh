// PARAMARSH — Beyond the Surface
// One survey sheet. Looked at through a glass, pulled apart into its inks,
// put back in register, and printed again at night with its lights on.

import { Terrain, glowSprite } from './atlas.js';
import { Rings, STAGE_QUESTIONS } from './rings.js';
import { Ripple, ZONES } from './ripple.js';
import { buildStrata, STRATA } from './strata.js';
import { clamp, lerp, span, smooth } from './noise.js';

const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ------------------------------------------------------------ preferences */
let prefReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
try { const v = localStorage.getItem('pm-reduce'); if (v !== null) prefReduce = v === '1'; } catch (e) { /* storage unavailable */ }
const REDUCE = prefReduce;
const MOBILE = window.matchMedia('(max-width: 860px)').matches;
const COARSE = window.matchMedia('(pointer: coarse)').matches;
if (REDUCE) document.documentElement.classList.add('is-static');

const motionBtn = $('#motion-toggle');
if (motionBtn) {
  motionBtn.setAttribute('aria-pressed', String(REDUCE));
  motionBtn.textContent = REDUCE ? 'Turn motion back on' : 'Reduce motion';
  motionBtn.addEventListener('click', () => { try { localStorage.setItem('pm-reduce', REDUCE ? '0' : '1'); } catch (e) { /* ignore */ } location.reload(); });
}
if (!gsap || !ScrollTrigger) { document.documentElement.classList.add('is-static'); throw new Error('GSAP failed to load.'); }
gsap.registerPlugin(ScrollTrigger);

/* ----------------------------------------------------------------- scroll */
let lenis = null;
if (!REDUCE && window.Lenis) {
  lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}
window.__pm = { get lenis() { return lenis; } };
const scrollToTarget = (id) => {
  const el = document.getElementById(id); if (!el) return;
  if (lenis) lenis.scrollTo(el, { duration: 2.4, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else el.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth' });
};
$$('[data-jump], .margin__index a').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.dataset.jump || a.getAttribute('href').slice(1);
  if (!document.getElementById(id)) return;
  e.preventDefault(); scrollToTarget(id);
}));

const menuBtn = $('.nav__menu'), drawer = $('#drawer');
menuBtn?.addEventListener('click', () => {
  const open = menuBtn.getAttribute('aria-expanded') === 'true';
  menuBtn.setAttribute('aria-expanded', String(!open)); menuBtn.textContent = open ? 'Menu' : 'Close';
  drawer.hidden = open; if (lenis) open ? lenis.start() : lenis.stop();
});
drawer?.addEventListener('click', (e) => { if (e.target.tagName === 'A') menuBtn.click(); });

/* ================================================================ ATLAS */
const atlas = $('#atlas'), stack = $('#stack'), surface = $('#surface'), loupe = $('#loupe');
const plateEls = $$('.plate');
const plateCanvases = Object.fromEntries(plateEls.map((p) => [p.dataset.plate, p.querySelector('canvas')]));
const terrain = new Terrain({ mobile: MOBILE });

let VW = innerWidth, VH = innerHeight, MAP = 0;
function layoutAtlas() {
  VW = innerWidth; VH = innerHeight;
  MAP = Math.round(Math.max(VW, VH) * 1.1);
  stack.style.setProperty('--map', `${MAP}px`);
  const sc = surface.querySelector('canvas'), dpr = Math.min(devicePixelRatio || 1, 2);
  sc.width = Math.round(VW * dpr); sc.height = Math.round(VH * dpr);
  terrain.drawSurface(sc, MAP * dpr, (VW - MAP) / 2 * dpr, (VH - MAP) / 2 * dpr);
}
layoutAtlas();

const fontsReady = Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 2500))]);
fontsReady.then(() => {
  const S = MOBILE ? 1100 : Math.min(1900, Math.round(MAP * Math.min(devicePixelRatio || 1, 1.4)));
  terrain.printPlates(S, plateCanvases);
  atlas.classList.add('is-printed');
});

/* — The press: plates, their order, and how they misregister — */
const ORDER = ['base', 'terrain', 'water', 'people', 'econ'];
const MISREG = { base: [0, 0, 0], terrain: [-14, 9, -0.5], water: [12, -10, 0.45], people: [-9, -13, 0.35], econ: [15, 12, -0.4] };
const ST = { p: 0, reg: 1, hi: -1, hiAmt: 0 };
const vis = { base: 1, terrain: 1, water: 1, people: 1, econ: 1 };
window.__pm.ST = ST;
let lastStack = '';

function applyStack() {
  const p = ST.p, ep = smooth(p);
  const gapF = MOBILE ? 0.15 : 0.16;
  const kEx = Math.min((VW * (MOBILE ? 0.8 : 0.42)) / (MAP * 1.41), (VH * (MOBILE ? 0.5 : 0.66)) / (MAP * 1.41 * 0.56 + MAP * gapF * 4 * 0.83));
  const k = lerp(1, kEx, ep);
  // keep the middle of the stack, not the bottom plate, at the centre of the view
  const lift = 2 * MAP * gapF * 0.83 * kEx;
  const tx = lerp(0, MOBILE ? 0 : VW * 0.13, ep), ty = lerp(0, (MOBILE ? -VH * 0.14 : VH * 0.02) + lift, ep);
  const sig = `${p.toFixed(4)}|${ST.reg.toFixed(4)}|${ST.hi}|${ST.hiAmt.toFixed(3)}|${ORDER.map((n) => vis[n].toFixed(3)).join(',')}`;
  if (sig === lastStack) return; lastStack = sig;
  stack.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) rotateX(${(56 * ep).toFixed(2)}deg) rotateZ(${(-38 * ep).toFixed(2)}deg) scale3d(${k.toFixed(4)}, ${k.toFixed(4)}, ${k.toFixed(4)})`;
  stack.style.setProperty('--k', k.toFixed(4));
  const gap = MAP * gapF * ep;
  plateEls.forEach((el, i) => {
    const name = el.dataset.plate, [mx, my, mr] = MISREG[name], m = 1 - ST.reg;
    el.style.transform = `translate3d(${(mx * m / k).toFixed(1)}px, ${(my * m / k).toFixed(1)}px, ${(i * gap).toFixed(1)}px) rotate(${(mr * m).toFixed(3)}deg)`;
    const dim = ST.hi < 0 || i === 0 ? 1 : lerp(1, i === ST.hi ? 1 : 0.16, ST.hiAmt);
    el.style.opacity = (vis[name] * dim).toFixed(3);
    el.style.setProperty('--film', (ep * (i ? (i === ST.hi ? lerp(0.42, 0.7, ST.hiAmt) : 0.42) : 0)).toFixed(3));
    el.style.setProperty('--film-on', ep.toFixed(3));
  });
}

/* — The glass — */
const glass = { x: VW * 0.68, y: VH * 0.62, tx: VW * 0.68, ty: VH * 0.62, r: 0, user: false, lastMove: 0 };
const R0 = MOBILE ? 84 : 128;
window.addEventListener('pointermove', (e) => {
  glass.tx = e.clientX; glass.ty = e.clientY; glass.user = true; glass.lastMove = performance.now();
  nightPtr.tx = e.clientX; nightPtr.ty = e.clientY;
}, { passive: true });
window.addEventListener('pointerdown', (e) => { nightPtr.tx = e.clientX; nightPtr.ty = e.clientY; }, { passive: true });
document.addEventListener('pointerleave', () => { glass.user = false; nightPtr.tx = -9999; nightPtr.ty = -9999; });

function updateGlass(pro, now) {
  const diag = Math.hypot(VW, VH);
  const grow = smooth(span(pro, 0.5, 0.72));
  const on = span(pro, 0.12, 0.2);
  const r = REDUCE ? (pro > 0.5 ? diag : pro > 0.15 ? R0 : 0) : lerp(R0 * on, diag, grow);
  // when nobody is steering, the glass wanders the sheet on its own
  const idle = !glass.user || COARSE || now - glass.lastMove > 4000;
  if (idle) {
    const t = now * 0.00011;
    glass.tx = VW * (MOBILE ? 0.5 : 0.66) + Math.sin(t * 2.1) * VW * (MOBILE ? 0.22 : 0.14);
    glass.ty = VH * (MOBILE ? 0.42 : 0.58) + Math.sin(t * 1.3 + 1) * VH * 0.12;
  }
  const ease = REDUCE ? 1 : idle ? 0.04 : 0.16;
  glass.x += (glass.tx - glass.x) * ease; glass.y += (glass.ty - glass.y) * ease;
  // as the glass grows to fill the sheet, it drifts to centre
  const cx = lerp(glass.x, VW / 2, grow), cy = lerp(glass.y, VH / 2, grow);
  surface.style.setProperty('--mx', `${cx.toFixed(1)}px`);
  surface.style.setProperty('--my', `${cy.toFixed(1)}px`);
  surface.style.setProperty('--r', `${r.toFixed(1)}px`);
  surface.style.visibility = r >= diag - 1 ? 'hidden' : 'visible';
  loupe.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
  loupe.style.setProperty('--r', `${Math.max(r, 1).toFixed(1)}px`);
  loupe.style.opacity = (on * (1 - span(pro, 0.56, 0.66))).toFixed(3);
}

/* ================================================================ TITLE */
function splitWords(el) {
  const words = el.textContent.trim().split(/\s+/);
  el.textContent = '';
  return words.map((w, i) => { const s = document.createElement('span'); s.className = 'w'; s.textContent = w + (i < words.length - 1 ? ' ' : ''); el.appendChild(s); return s; });
}
const t1 = splitWords($('.beat--title .t1')), t2 = splitWords($('.beat--title .t2'));
gsap.set('.beat--title', { opacity: 1 });
if (!REDUCE) {
  // key plate first: ink settles into the paper, word by word
  gsap.fromTo(t1, { opacity: 0, filter: 'blur(7px)' }, { opacity: 1, filter: 'blur(0px)', duration: 1.1, ease: 'power2.out', stagger: 0.09, delay: 0.5 });
  // then the vermilion plate goes through the press, slightly off register, and settles
  gsap.fromTo(t2, { opacity: 0, x: 7, y: -5 }, { opacity: 1, duration: 0.5, ease: 'power1.out', stagger: 0.05, delay: 2.1 });
  gsap.to(t2, { x: 0, y: 0, duration: 1.1, ease: 'back.out(3)', delay: 2.6, stagger: 0.03 });
}

/* ========================================================== SCROLL STATES */
const T = {};
const mk = (name, trigger, start, end) => { T[name] = ScrollTrigger.create({ trigger, start, end }); };
mk('pro', '#prologue', 'top top', 'bottom bottom');
mk('name', '#name', 'top bottom', 'bottom top');
mk('compIn', '#competence', 'top bottom', 'top top');
mk('comp', '#competence', 'top top', 'bottom bottom');
mk('compOut', '#competence', 'bottom bottom', 'bottom top');
mk('cons', '#consistency', 'top top', 'bottom bottom');
mk('consVis', '#consistency', 'top bottom', 'bottom top');
mk('tr', '#transparency', 'top top', 'bottom bottom');
mk('ben', '#benevolence', 'top top', 'bottom bottom');
mk('benVis', '#benevolence', 'top bottom', 'bottom top');
mk('epiIn', '#epilogue', 'top bottom', 'top top');
mk('epi', '#epilogue', 'top top', 'bottom bottom');
mk('epiOut', '#epilogue', 'bottom bottom', 'bottom top');

function applyBeats(list, p) {
  for (const b of list) {
    const [a, z] = b.dataset.beat.split(',').map(Number);
    const fl = Math.min(0.045, (z - a) * 0.3);
    const inn = a <= 0 ? 1 : span(p, a, a + fl), out = z >= 1 ? 0 : span(p, z - fl, z);
    const o = Math.min(inn, 1 - out);
    b.style.opacity = o.toFixed(3);
    b.style.visibility = o < 0.01 ? 'hidden' : 'visible';
    if (!REDUCE) b.style.setProperty('--by', `${((1 - inn) * 18 - out * 18).toFixed(1)}px`);
  }
}
const proBeats = $$('#prologue [data-beat]'), epiBeats = $$('#epilogue [data-beat]');

/* ================================================= 01 · COMPETENCE plates */
const layerBtns = $$('.layer');
const LAYER_I = { terrain: 1, water: 2, people: 3, econ: 4 };
function pressTo(p, dur = 1.8) { gsap.to(ST, { p, duration: REDUCE ? 0 : dur, ease: 'power3.inOut', overwrite: 'auto' }); }
function highlight(i) {
  ST.hi = i < 0 ? ST.hi : i;
  gsap.to(ST, { hiAmt: i < 0 ? 0 : 1, duration: REDUCE ? 0 : 0.8, ease: 'power2.out', overwrite: 'auto', onComplete: () => { if (i < 0) ST.hi = -1; } });
  layerBtns.forEach((b) => b.classList.toggle('is-focus', LAYER_I[b.dataset.layer] === i));
}
function setVis(name, on) {
  gsap.to(vis, { [name]: on ? 1 : 0, duration: REDUCE ? 0 : 0.6, ease: 'power2.out' });
  layerBtns.find((b) => b.dataset.layer === name)?.setAttribute('aria-pressed', String(on));
}
// Plates come back down off-register and settle, like a sheet through a press.
function register() {
  if (REDUCE) { ST.reg = 1; return; }
  gsap.killTweensOf(ST, 'reg');
  ST.reg = 0;
  gsap.to(ST, { reg: 1, duration: 1.6, delay: 0.9, ease: 'elastic.out(1, 0.55)' });
}
layerBtns.forEach((b) => b.addEventListener('click', () => {
  const name = b.dataset.layer, on = b.getAttribute('aria-pressed') !== 'true';
  setVis(name, on);
  if (on) highlight(LAYER_I[name]); else highlight(-1);
}));

let compStep = -1;
function onCompStep(i) {
  if (i === compStep) return;
  const prev = compStep; compStep = i;
  ORDER.slice(1).forEach((n) => setVis(n, true));
  if (i >= 0 && i <= 4) { pressTo(1); highlight(i === 0 ? -1 : i); }
  if (i >= 5) { highlight(-1); if (ST.p > 0.02 || prev < 5) { pressTo(0, 1.6); register(); } }
}

/* ================================================= 02 · CONSISTENCY rings */
const rings = new Rings($('#rings'));
const qStage = $('#q-stage'), qText = $('#q-text'), ringN = $('#ring-n'), ringT = $('#ring-t');
let stage = -1, lastAuto = -1;
function setStage(i) {
  if (i === stage) return; stage = i; rings.state.stage = i;
  rings.btns.forEach((b, k) => { b.classList.toggle('is-active', k === i); b.setAttribute('aria-pressed', String(k === i)); });
  const [n, q] = STAGE_QUESTIONS[i];
  if (REDUCE) { qStage.textContent = n; qText.textContent = q; return; }
  gsap.to(qText, { opacity: 0, filter: 'blur(4px)', duration: 0.2, onComplete: () => { qStage.textContent = n; qText.textContent = q; gsap.to(qText, { opacity: 1, filter: 'blur(0px)', duration: 0.6, ease: 'power2.out' }); } });
}
rings.btns.forEach((b, i) => b.addEventListener('click', () => setStage(i)));
setStage(0);
const fmt = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
function updateRings() {
  const p = T.cons.progress;
  rings.state.count = REDUCE ? 50 : 1 + span(p, 0.02, 0.88) * 49;
  const mins = lerp(8 * 60 + 40, 11 * 60 + 56, p);
  rings.state.light = -Math.PI + ((mins / 60 - 6) / 12) * Math.PI;
  ringN.textContent = String(Math.min(50, Math.floor(rings.state.count))).padStart(2, '0');
  ringT.textContent = fmt(mins);
  const auto = Math.min(5, Math.floor(span(p, 0.3, 0.86) * 6));
  if (auto !== lastAuto) { lastAuto = auto; setStage(auto); }
}

/* =============================================== 03 · TRANSPARENCY strata */
const spN = $('#sp-n'), spName = $('#sp-name'), spLead = $('#sp-lead'), spEg = $('#sp-eg');
let stratum = -2;
const strata = buildStrata($('#strata'), (i) => selectStratum(i));
function selectStratum(i) {
  if (i === stratum) return; stratum = i; strata.select(i);
  const d = STRATA[Math.max(0, i)];
  const apply = () => {
    spN.textContent = i < 0 ? '00' : `0${i + 1}`;
    spName.textContent = i < 0 ? 'Beneath the surface' : d.name;
    spLead.textContent = i < 0 ? 'Four layers sit under every conclusion. Select one to look inside.' : d.lead;
    spEg.textContent = i < 0 ? 'Methods, sources, decisions and limitations behind the road on the ridge.' : d.eg;
  };
  if (REDUCE) return apply();
  gsap.to('.stratum-panel', { opacity: 0, duration: 0.18, onComplete: () => { apply(); gsap.to('.stratum-panel', { opacity: 1, duration: 0.45 }); } });
}
selectStratum(-1);

/* =============================================== 04 · BENEVOLENCE ripple */
const ripple = new Ripple($('#ripple'));
const zpName = $('#zp-name'), zpText = $('#zp-text');
let zone = -2;
function setZone(i) {
  if (i === zone) return; zone = i; ripple.state.active = i;
  const apply = () => {
    zpName.textContent = i < 0 ? 'Who a decision reaches' : ZONES[i][0];
    zpText.textContent = i < 0 ? 'A person first. Then the people around them. Then the land and water they all depend on.' : ZONES[i][1];
  };
  if (REDUCE) return apply();
  gsap.to('.zone-panel', { opacity: 0, duration: 0.18, onComplete: () => { apply(); gsap.to('.zone-panel', { opacity: 1, duration: 0.45 }); } });
}
ripple.btns.forEach((b, i) => b.addEventListener('click', () => setZone(i)));
setZone(-1);

/* ========================================================= step triggers */
function bindSteps(sel, fn) {
  $$(`${sel} .step`).forEach((step) => ScrollTrigger.create({
    trigger: step, start: 'top 55%', end: 'bottom 45%',
    onToggle: (self) => { if (self.isActive) fn(step, Number(step.dataset.step)); },
  }));
}
bindSteps('#competence', (s, i) => onCompStep(i));
bindSteps('#transparency', (s, i) => { if (s.dataset.stratum !== undefined) selectStratum(Number(s.dataset.stratum)); else if (i <= 1) selectStratum(-1); });
bindSteps('#benevolence', (s, i) => { if (s.dataset.zone !== undefined) setZone(Number(s.dataset.zone)); else if (i <= 1 || i >= 5) setZone(-1); });
// scrolling back up into the prologue puts the sheet back together
ScrollTrigger.create({ trigger: '#competence', start: 'top 60%', onLeaveBack: () => { compStep = -1; pressTo(0, 1.2); highlight(-1); ORDER.slice(1).forEach((n) => setVis(n, true)); } });

/* ================================================================ NIGHT */
const nightC = $('#night'), nctx = nightC.getContext('2d');
const nightPtr = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
const sprite = glowSprite();
let nightDpr = Math.min(devicePixelRatio || 1, 1.5);
function sizeNight() { nightC.width = Math.round(VW * nightDpr); nightC.height = Math.round(VH * nightDpr); nctx.setTransform(nightDpr, 0, 0, nightDpr, 0, 0); }
sizeNight();
let nightReady = false;
function ensureNight() {
  if (nightReady || !terrain._night) return;
  terrain.printNight(MOBILE ? 1100 : 1700); nightReady = true;
}
function drawNight(e, lightsP, now) {
  ensureNight(); if (!nightReady) return;
  const zoom = lerp(1.32, 1.02, smooth(e));
  const M = Math.max(VW, VH) * 1.1 * zoom;
  const ox = (VW - M) / 2 + lerp(-VW * 0.04, 0, e), oy = (VH - M) / 2 + lerp(VH * 0.05, 0, e);
  nctx.globalCompositeOperation = 'source-over'; nctx.globalAlpha = 1;
  nctx.drawImage(terrain.nightTex, ox, oy, M, M);
  nightPtr.x += (nightPtr.tx - nightPtr.x) * 0.12; nightPtr.y += (nightPtr.ty - nightPtr.y) * 0.12;
  nctx.globalCompositeOperation = 'lighter';
  const lv = lightsP * 1.28, homes = terrain.homes, base = MOBILE ? 13 : 17;
  for (let k = 0; k < homes.length; k++) {
    const o = homes[k];
    const x = ox + (o.x + 1) / 2 * M, y = oy + (o.y + 1) / 2 * M;
    if (x < -30 || y < -30 || x > VW + 30 || y > VH + 30) continue;
    const near = clamp(1 - Math.hypot(x - nightPtr.x, y - nightPtr.y) / 170);
    let v = clamp((lv - o.order) * 7);
    if (lightsP > 0.15) v = Math.max(v, near * near * clamp(lightsP * 3));
    if (v <= 0.01) continue;
    const flick = REDUCE ? 1 : 0.82 + 0.18 * Math.sin(now * 0.001 * o.f + o.ph);
    nctx.globalAlpha = clamp(v * o.b * flick * (0.85 + near * 0.4));
    const s = (base + near * 10) * o.s * zoom;
    nctx.drawImage(sprite, x - s / 2, y - s / 2, s, s);
  }
  nctx.globalAlpha = 1; nctx.globalCompositeOperation = 'source-over';
}

/* ================================================================== SKY */
const skySecs = $$('[data-sky]');
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
let stops = [];
function measure() {
  stops = skySecs.map((s) => ({
    top: s.offsetTop, h: s.offsetHeight, col: hex(s.dataset.sky), theme: s.dataset.theme, id: s.id, name: s.dataset.name, note: s.dataset.note,
    clock: s.dataset.clock.split('-').map((c) => { const [h, m] = c.split(':').map(Number); return h * 60 + m; }),
  }));
}
measure();
ScrollTrigger.addEventListener('refresh', measure);

const nav = $('#nav'), margin = $('#margin'), sheet = $('.sheet');
const clock = $('#clock'), clockNote = $('#clock-note'), sheetN = $('#sheet-n'), sheetName = $('#sheet-name'), sun = $('#sun');
const idx = $$('.margin__index a');
const SHEET_OF = { prologue: ['00', 'prologue'], name: ['00', 'prologue'], competence: ['01', 'competence'], consistency: ['02', 'consistency'], transparency: ['03', 'transparency'], benevolence: ['04', 'benevolence'], epilogue: ['05', 'epilogue'], close: ['05', 'epilogue'] };
let lastSky = '', lastFrame = '', lastSec = '', lastClock = '';

function updateSky() {
  const y = window.scrollY, mid = y + VH * 0.5;
  let i = 0; for (let k = 0; k < stops.length; k++) if (stops[k].top <= mid) i = k;
  const cur = stops[i]; if (!cur) return;
  let col = cur.col; const w = VH * 0.45, next = stops[i + 1], prev = stops[i - 1];
  if (next && mid > next.top - w) { const t = smooth(clamp((mid - (next.top - w)) / (2 * w))); col = cur.col.map((c, k) => lerp(c, next.col[k], t)); }
  else if (prev && mid < cur.top + w) { const t = smooth(clamp(0.5 + (mid - cur.top) / (2 * w))); col = prev.col.map((c, k) => lerp(c, cur.col[k], t)); }
  const sky = `rgb(${col.map((c) => c | 0).join(',')})`;
  if (sky !== lastSky) {
    lastSky = sky; document.body.style.backgroundColor = sky;
    nav.style.setProperty('--sky', sky); margin.style.setProperty('--sky', sky);
    const lum = (col[0] * 0.3 + col[1] * 0.59 + col[2] * 0.11) / 255;
    const frame = lum < 0.45 ? '#EEE6D4' : '#1F1A14';
    if (frame !== lastFrame) { lastFrame = frame; for (const el of [nav, margin, sheet]) el.style.setProperty('--frame', frame); }
  }
  if (cur.id !== lastSec) {
    lastSec = cur.id;
    const [n, rail] = SHEET_OF[cur.id];
    sheetN.textContent = n; sheetName.textContent = cur.name; clockNote.textContent = cur.note;
    idx.forEach((a) => a.classList.toggle('is-active', a.dataset.rail === rail));
  }
  const mins = lerp(cur.clock[0], cur.clock[1], clamp((mid - cur.top) / cur.h));
  const c = fmt(mins);
  if (c !== lastClock) { lastClock = c; clock.textContent = c; sun.style.setProperty('--sun-fill', mins > 360 && mins < 1130 ? 'var(--verm)' : 'transparent'); }
}

/* ============================================================== REVEALS */
if (!REDUCE) {
  $$('[data-reveal]').forEach((el) => gsap.to(el, { opacity: 1, y: 0, duration: 1.3, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 82%', once: true } }));
  $$('.step .card, .bridge').forEach((el) => gsap.from(el, { opacity: 0, y: 30, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 82%', toggleActions: 'play none none reverse' } }));
  // what is observed is drawn first; what is inferred appears after
  const draws = $$('.name__figure .draw');
  draws.forEach((p) => { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; });
  const flame = $('.name__figure .flame'), labels = $$('.name__figure .fig-label > *');
  gsap.set(flame, { opacity: 0, scale: 0.6, transformOrigin: '50% 100%' }); gsap.set(labels, { opacity: 0 });
  gsap.timeline({ scrollTrigger: { trigger: '.name__figure', start: 'top 70%', once: true } })
    .to(draws, { strokeDashoffset: 0, duration: 2.2, ease: 'power2.inOut', stagger: 0.25 })
    .to(labels.slice(0, 2), { opacity: 1, duration: 0.6 }, '-=0.6')
    .to(flame, { opacity: 1, scale: 1, duration: 1.4, ease: 'power2.out' }, '+=0.4')
    .to(labels.slice(2), { opacity: 1, duration: 0.6, stagger: 0.15 }, '-=0.7');
  const rs = $$('.bigmark g circle');
  rs.forEach((c) => { const L = c.getTotalLength(); c.style.strokeDasharray = L; c.style.strokeDashoffset = L; });
  gsap.set('.bigmark__light', { scale: 0, transformOrigin: '229.5px 175.5px' });
  gsap.set('.bigmark__key li', { opacity: 0, x: -8 });
  gsap.timeline({ scrollTrigger: { trigger: '.close__mark', start: 'top 75%', once: true } })
    .to(rs, { strokeDashoffset: 0, duration: 1.8, ease: 'power2.inOut', stagger: 0.28 })
    .to('.bigmark__key li', { opacity: 1, x: 0, duration: 0.6, stagger: 0.18 }, 0.4)
    .to('.bigmark__light', { scale: 1, duration: 1.4, ease: 'elastic.out(1, 0.6)' }, '-=0.4');
}

/* =============================================================== RESIZE */
let rz;
window.addEventListener('resize', () => {
  clearTimeout(rz);
  rz = setTimeout(() => {
    if (Math.abs(innerWidth - VW) < 2 && Math.abs(innerHeight - VH) < 140) return;
    layoutAtlas(); sizeNight(); rings.resize(); ripple.resize(); lastStack = ''; measure(); ScrollTrigger.refresh();
  }, 180);
});

/* ================================================================= TICK */
const t0 = performance.now();
let lastNightOp = -1;
gsap.ticker.add(() => {
  const now = performance.now() - t0;
  updateSky();
  const pro = T.pro.progress, nm = T.name.progress, compOut = T.compOut.progress;
  applyBeats(proBeats, pro);
  applyBeats(epiBeats, T.epi.progress);

  // atlas visibility: prologue → (dims under the name) → competence → gone
  let aOp = 0;
  if (T.comp.progress > 0 || T.compIn.progress > 0.5) aOp = 1 - smooth(compOut);
  else if (nm > 0 && pro >= 1) aOp = 1 - Math.min(span(nm, 0.04, 0.22), 1 - span(nm, 0.8, 0.98));
  else aOp = 1;
  if (!atlas.classList.contains('is-printed')) aOp = Math.min(aOp, 1);
  atlas.style.opacity = aOp.toFixed(3);
  if (aOp > 0.001) { updateGlass(pro, now); applyStack(); }

  // night
  const ei = T.epiIn.progress, e = T.epi.progress, eo = T.epiOut.progress;
  const nOp = smooth(ei) * (1 - smooth(eo));
  if (Math.abs(nOp - lastNightOp) > 0.001) { nightC.style.opacity = nOp.toFixed(3); lastNightOp = nOp; }
  if (nOp > 0.001) drawNight(e, REDUCE ? (e > 0.2 ? 1 : 0) : span(e, 0.18, 0.86), REDUCE ? 0 : now);
  else if (ei === 0 && T.benVis.isActive && !nightReady) ensureNight();

  if (T.consVis.isActive) { updateRings(); rings.render(); }
  if (T.tr.progress > 0 && T.tr.progress < 1) strata.explode(REDUCE ? 1 : smooth(span(T.tr.progress, 0.1, 0.26)));
  if (T.benVis.isActive) { ripple.state.reveal = REDUCE ? 1 : 0.06 + span(T.ben.progress, 0.08, 0.66) * 0.94; ripple.render(REDUCE ? 0 : now); }
});

updateRings(); rings.render(); ripple.render(0); strata.explode(0);
window.addEventListener('load', () => ScrollTrigger.refresh());
