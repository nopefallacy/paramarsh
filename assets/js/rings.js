// CONSISTENCY — tree rings.
// Fifty project cycles laid down one ring at a time. Ring widths vary with the
// "weather" (some cycles are harder than others) but every ring closes, and the
// line quality never changes. A light source sweeps around them as the reader
// scrolls: the day changes, the structure holds.

import { createNoise2D, mulberry32, clamp, lerp } from './noise.js';

const RINGS = 50;
const STAGES = 6;

export class Rings {
  constructor(root) {
    this.root = root;
    this.c = root.querySelector('canvas');
    this.ctx = this.c.getContext('2d');
    this.btns = [...root.querySelectorAll('.stage-btn')];
    const rand = mulberry32(42);
    this.noise = createNoise2D(rand);
    // ring widths: narrow in "hard years", wide in generous ones
    const w = [];
    for (let k = 0; k < RINGS; k++) w.push(0.55 + 0.9 * (0.5 + 0.5 * this.noise(k * 0.31, 3.7)) + (rand() - 0.5) * 0.2);
    const pith = 3.2;
    let acc = pith; this.radii = w.map((x) => (acc += x));
    this.total = acc;
    this.state = { count: 1, light: -2.2, stage: 0 };
    this.resize();
  }

  resize() {
    const r = this.root.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.size = r.width; this.dpr = dpr;
    this.c.width = Math.round(r.width * dpr); this.c.height = Math.round(r.width * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.R = r.width * 0.38;
    // place stage buttons around the outer edge
    this.btns.forEach((b, i) => {
      const a = this.stageAngle(i), rr = this.R * 1.17;
      b.style.setProperty('--x', `${r.width / 2 + Math.cos(a) * rr}px`);
      b.style.setProperty('--y', `${r.width / 2 + Math.sin(a) * rr}px`);
    });
  }

  stageAngle(i) { return -Math.PI / 2 + (i / STAGES) * Math.PI * 2; }

  radiusAt(k, th) {
    // coherent wobble: neighbouring rings share a shape, slowly drifting outward
    const n = this.noise(Math.cos(th) * 1.25 + k * 0.035, Math.sin(th) * 1.25 - k * 0.02);
    const n2 = this.noise(Math.cos(th) * 3.1 + 10, Math.sin(th) * 3.1 + k * 0.05);
    return (this.radii[k] / this.total) * this.R * (1 + 0.045 * n + 0.012 * n2) ;
  }

  render() {
    const ctx = this.ctx, S = this.size, cx = S / 2, cy = S / 2, s = this.state;
    ctx.clearRect(0, 0, S, S);
    const L = s.light;

    // the light falling across the section
    const lx = cx + Math.cos(L) * this.R * 1.6, ly = cy + Math.sin(L) * this.R * 1.6;
    const g = ctx.createRadialGradient(lx, ly, this.R * 0.2, lx, ly, this.R * 2.6);
    g.addColorStop(0, 'rgba(255,250,238,0.9)');
    g.addColorStop(0.5, 'rgba(246,238,220,0.3)');
    g.addColorStop(1, 'rgba(238,229,209,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, this.R * 1.06, 0, Math.PI * 2); ctx.fill();

    // shadow side
    const sx = cx - Math.cos(L) * this.R, sy = cy - Math.sin(L) * this.R;
    const g2 = ctx.createRadialGradient(sx, sy, 0, sx, sy, this.R * 1.5);
    g2.addColorStop(0, 'rgba(84,66,92,0.13)'); g2.addColorStop(1, 'rgba(84,66,92,0)');
    ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(cx, cy, this.R * 1.06, 0, Math.PI * 2); ctx.fill();

    // pith
    ctx.fillStyle = 'rgba(31,26,20,.85)';
    ctx.beginPath(); ctx.arc(cx, cy, 2.2, 0, Math.PI * 2); ctx.fill();

    const full = Math.floor(s.count), frac = s.count - full;
    const STEPS = 160, BINS = 4;
    const paths = Array.from({ length: BINS }, () => new Path2D());
    const strong = Array.from({ length: BINS }, () => new Path2D());
    const drawRing = (k, portion) => {
      const end = Math.max(2, Math.round(STEPS * portion));
      const target = k % 10 === 9 ? strong : paths;
      for (let i = 0; i < end; i++) {
        const a0 = -Math.PI / 2 + (i / STEPS) * Math.PI * 2, a1 = -Math.PI / 2 + ((i + 1) / STEPS) * Math.PI * 2;
        const r0 = this.radiusAt(k, a0), r1 = this.radiusAt(k, a1);
        const lit = Math.max(0, Math.cos((a0 + a1) / 2 - L));
        const b = Math.min(BINS - 1, (lit * BINS) | 0);
        target[b].moveTo(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0);
        target[b].lineTo(cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1);
      }
    };
    for (let k = 0; k < Math.min(full, RINGS); k++) drawRing(k, 1);
    if (full < RINGS && frac > 0) drawRing(full, frac);

    // lit side is bleached a little; shadow side is crisper ink
    const alphas = [0.78, 0.62, 0.48, 0.36];
    for (let b = 0; b < BINS; b++) {
      ctx.strokeStyle = `rgba(31,26,20,${alphas[b]})`; ctx.lineWidth = 0.75; ctx.stroke(paths[b]);
      ctx.strokeStyle = `rgba(31,26,20,${Math.min(1, alphas[b] + 0.2)})`; ctx.lineWidth = 1.3; ctx.stroke(strong[b]);
    }

    // the newest ring is drawn in ochre while it grows
    if (full < RINGS) {
      const k = full, end = Math.max(2, Math.round(STEPS * (frac || 0.001)));
      ctx.beginPath();
      for (let i = 0; i <= end; i++) {
        const a = -Math.PI / 2 + (i / STEPS) * Math.PI * 2, r = this.radiusAt(k, a);
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = 'rgba(207,74,42,.95)'; ctx.lineWidth = 1.6; ctx.stroke();
    }

    // the active stage: one radius cutting through every ring —
    // the same question, asked on every project
    const a = this.stageAngle(s.stage);
    const outer = this.radiusAt(Math.max(0, Math.min(full, RINGS - 1)), a);
    ctx.save();
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = 'rgba(207,74,42,.9)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * this.R * 1.08, cy + Math.sin(a) * this.R * 1.08); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(207,74,42,1)';
    ctx.beginPath(); ctx.arc(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer, 3, 0, Math.PI * 2); ctx.fill();

    // stage ticks
    ctx.strokeStyle = 'rgba(31,26,20,.35)'; ctx.lineWidth = 1;
    for (let i = 0; i < STAGES; i++) {
      const aa = this.stageAngle(i);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(aa) * this.R * 1.04, cy + Math.sin(aa) * this.R * 1.04);
      ctx.lineTo(cx + Math.cos(aa) * this.R * 1.09, cy + Math.sin(aa) * this.R * 1.09);
      ctx.stroke();
    }

    // the sun, travelling around the outside
    const sunR = this.R * 1.32;
    const sxp = cx + Math.cos(L) * sunR, syp = cy + Math.sin(L) * sunR;
    ctx.fillStyle = 'rgba(207,74,42,1)';
    ctx.beginPath(); ctx.arc(sxp, syp, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(207,74,42,.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(sxp, syp, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([1, 5]);
    ctx.strokeStyle = 'rgba(31,26,20,.18)';
    ctx.beginPath(); ctx.arc(cx, cy, sunR, -Math.PI, 0.25); ctx.stroke();
    ctx.setLineDash([]);
  }
}

export const STAGE_QUESTIONS = [
  ['Brief', 'What are we actually being asked, and what should we be asking?'],
  ['Research', 'What do we know, how do we know it, and what are we missing?'],
  ['Planning', 'Which options are realistic here, and who carries the cost of each?'],
  ['Implementation', 'Are we still doing what we said we would? If not, why not, and who needs to know?'],
  ['Evaluation', 'Did it work? For whom? And how would we know if it hadn’t?'],
  ['Learning', 'What will we do differently on the next ring?'],
];
