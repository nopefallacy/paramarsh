// BENEVOLENCE — the ripple.
// A decision dropped into still water. Seen up close, the rings it sends out
// read like a fingerprint: every decision lands on someone in particular.
// Three zones: one person, a community (some voices not yet heard, drawn
// dashed), and the world around them.

import { createNoise2D, mulberry32, clamp } from './noise.js';

export const ZONES = [
  ['One person', 'How far someone walks for water. How safe the way home is after dark. How many hours of the day are still their own.'],
  ['A community', 'Who gains, who pays, and who wasn’t in the room when it was decided? The same change can be a gift to one street and a burden to the next.'],
  ['The world around', 'Rivers, soil, air, the seasons. What will this place need in thirty years that we could take from it now?'],
];

export class Ripple {
  constructor(root) {
    this.root = root;
    this.c = root.querySelector('canvas');
    this.ctx = this.c.getContext('2d');
    this.btns = [...root.querySelectorAll('.zone-btn')];
    const rand = mulberry32(9);
    this.noise = createNoise2D(rand);
    this.state = { reveal: 0, active: -1 };
    this.zr = [0.2, 0.58, 0.96]; // zone outer radii (fraction of R)

    // inhabitants
    const people = [];
    for (let i = 0; i < 4; i++) { const a = rand() * 6.28, r = 0.08 + rand() * 0.09; people.push({ a, r, z: 0, unheard: false }); }
    for (let i = 0; i < 74; i++) { const a = rand() * 6.28, r = 0.25 + rand() * 0.3; people.push({ a, r, z: 1, unheard: rand() < 0.16 }); }
    this.people = people;
    const world = [];
    for (let i = 0; i < 46; i++) { const a = rand() * 6.28, r = 0.64 + rand() * 0.3; world.push({ a, r, kind: rand() < 0.6 ? 'tree' : 'water', s: 0.7 + rand() * 0.6 }); }
    this.world = world;
    this.resize();
  }

  resize() {
    const r = this.root.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.size = r.width; this.R = r.width * 0.46;
    this.c.width = Math.round(r.width * dpr); this.c.height = Math.round(r.width * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const angles = [-0.62, -0.95, -1.25];
    this.btns.forEach((b, i) => {
      const rr = this.zr[i] * this.R, a = angles[i];
      b.style.setProperty('--x', `${r.width / 2 + Math.cos(a) * rr}px`);
      b.style.setProperty('--y', `${r.width / 2 + Math.sin(a) * rr}px`);
    });
  }

  render(t) {
    const ctx = this.ctx, S = this.size, cx = S / 2, cy = S / 2, R = this.R, s = this.state;
    ctx.clearRect(0, 0, S, S);
    const reach = clamp(s.reveal) * R;           // how far the ripple has travelled
    const act = s.active;
    const zoneOf = (r) => (r < this.zr[0] ? 0 : r < this.zr[1] ? 1 : 2);
    const dimFor = (z) => (act < 0 || act === z ? 1 : 0.32);

    // warm pool of light at the centre
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, 'rgba(246,206,140,0.5)'); g.addColorStop(0.6, 'rgba(239,217,180,0.14)'); g.addColorStop(1, 'rgba(239,217,180,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.fill();

    // fingerprint-like wavefronts travelling outward
    const LINES = 54, spacing = R / LINES, speed = 0.010;
    const phase = (t * speed * 0.001 * LINES) % 1;
    for (let i = 0; i < LINES; i++) {
      const base = (i + phase) * spacing;
      if (base > reach || base < 2) continue;
      const fr = base / R;
      const a = (1 - fr * 0.8) * 0.7 * clamp((reach - base) / (R * 0.08)) * dimFor(zoneOf(fr));
      if (a < 0.01) continue;
      ctx.beginPath();
      const STEPS = 120;
      for (let k = 0; k <= STEPS; k++) {
        const th = (k / STEPS) * 6.283;
        const n = this.noise(Math.cos(th) * fr * 2.4 + 3, Math.sin(th) * fr * 2.4 - 2);
        const rr = base * (1 + 0.07 * n * fr);
        const x = cx + Math.cos(th) * rr, y = cy + Math.sin(th) * rr * 0.94;
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = `rgba(43,34,25,${a.toFixed(3)})`; ctx.lineWidth = 0.9; ctx.stroke();
    }

    // zone boundaries
    this.zr.forEach((zr, i) => {
      const rr = zr * R; if (rr > reach + 1) return;
      ctx.setLineDash(i === 2 ? [2, 5] : []);
      ctx.strokeStyle = `rgba(207,74,42,${(act === i ? 0.9 : 0.45).toFixed(2)})`;
      ctx.lineWidth = act === i ? 1.5 : 1;
      ctx.beginPath(); ctx.ellipse(cx, cy, rr, rr * 0.94, 0, 0, 6.283); ctx.stroke();
    });
    ctx.setLineDash([]);

    // people
    for (const p of this.people) {
      const rr = p.r * R; if (rr > reach) continue;
      const x = cx + Math.cos(p.a) * rr, y = cy + Math.sin(p.a) * rr * 0.94;
      const d = dimFor(p.z);
      const appear = clamp((reach - rr) / (R * 0.06));
      if (p.unheard) {
        ctx.setLineDash([1.5, 2]); ctx.strokeStyle = `rgba(43,34,25,${(0.75 * d * appear).toFixed(3)})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, 3.6, 0, 6.283); ctx.stroke(); ctx.setLineDash([]);
      } else {
        ctx.fillStyle = p.z === 0 ? `rgba(207,74,42,${(d * appear).toFixed(3)})` : `rgba(43,34,25,${(0.78 * d * appear).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(x, y, p.z === 0 ? 4.4 : 2.6, 0, 6.283); ctx.fill();
      }
    }

    // the world: trees and water marks
    for (const w of this.world) {
      const rr = w.r * R; if (rr > reach) continue;
      const x = cx + Math.cos(w.a) * rr, y = cy + Math.sin(w.a) * rr * 0.94;
      const a = 0.7 * dimFor(2) * clamp((reach - rr) / (R * 0.06));
      ctx.strokeStyle = `rgba(96,128,80,${a.toFixed(3)})`; ctx.lineWidth = 1;
      if (w.kind === 'tree') {
        ctx.beginPath(); ctx.moveTo(x, y + 5 * w.s); ctx.lineTo(x, y - 1 * w.s); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y - 4 * w.s, 3.2 * w.s, 0, 6.283); ctx.stroke();
      } else {
        ctx.beginPath();
        for (let k = 0; k < 3; k++) { ctx.moveTo(x - 6 * w.s, y + k * 3 - 3); ctx.quadraticCurveTo(x - 3 * w.s, y + k * 3 - 5, x, y + k * 3 - 3); ctx.quadraticCurveTo(x + 3 * w.s, y + k * 3 - 1, x + 6 * w.s, y + k * 3 - 3); }
        ctx.stroke();
      }
    }

    // the decision itself
    ctx.fillStyle = 'rgba(43,34,25,1)';
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 6.283); ctx.fill();
    ctx.strokeStyle = 'rgba(43,34,25,.5)';
    ctx.beginPath(); ctx.arc(cx, cy, 8, 0, 6.283); ctx.stroke();

    this.btns.forEach((b, i) => {
      b.classList.toggle('is-shown', this.zr[i] * R * 0.8 < reach);
      b.classList.toggle('is-active', act === i);
    });
  }
}
