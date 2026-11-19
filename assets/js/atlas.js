// THE ATLAS
// One generated landscape, printed the way survey sheets were: in separate
// inks, one plate per layer of meaning.
//
//   base     paper, hypsometric tint, grid
//   terrain  relief shading (light from the north-west) + brown contours
//   water    rivers by flow, forest & cultivation symbols
//   people   houses, worn footpaths, the places people gather
//   econ     roads (ink casing, yellow fill) and markets
//
// Plates are rendered once to canvases and then moved with CSS transforms,
// so scrolling costs almost nothing. The same houses become the lights at
// night in the epilogue.

import { mulberry32, createNoise2D, clamp, lerp } from './noise.js';

const LEVELS = 30;
export const INK = {
  paper: [240, 232, 215],
  ink: '31,26,20',
  brown: '160,98,58',
  water: '47,110,149',
  green: '96,128,80',
  verm: '207,74,42',
  yellow: '226,169,58',
};

const mk = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

export class Terrain {
  constructor({ mobile = false, seed = 11 } = {}) {
    this.mobile = mobile;
    this.N = mobile ? 130 : 200;
    const N = this.N;
    const rand = mulberry32(seed);
    this.rand = rand;
    const n1 = createNoise2D(rand);
    const n2 = createNoise2D(mulberry32(seed * 31 + 7));
    this.noise = n1;
    const h = new Float32Array(N * N);
    let mn = Infinity, mx = -Infinity;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i / (N - 1)) * 2 - 1, y = (j / (N - 1)) * 2 - 1;
      let e = 0, amp = 1, f = 1.1, norm = 0;
      for (let o = 0; o < 6; o++) { e += amp * n1(x * f + 3.1, y * f - 1.7); norm += amp; amp *= 0.5; f *= 2.03; }
      e /= norm;
      const r = 1 - Math.abs(n2(x * 1.35 + 5, y * 1.35 + 2));
      e += 0.34 * r * r;
      e -= 0.42 * y;                                   // high ground to the north (top of the sheet)
      const vx = 0.2 * Math.sin(y * 2.3 + 0.6) + 0.035 * Math.sin(y * 7.0);
      const dv = x - vx;
      e -= 0.46 * Math.exp(-(dv * dv) / 0.03);         // a river valley running north–south
      h[j * N + i] = e; if (e < mn) mn = e; if (e > mx) mx = e;
    }
    for (let k = 0; k < h.length; k++) h[k] = (h[k] - mn) / (mx - mn);
    this.h = h;
    this.contours();
    this.water();
    this.settle();
    this.vegetation();
    this.households();
  }

  w(i) { return (i / (this.N - 1)) * 2 - 1; }
  hAt(x, y) {
    const N = this.N, h = this.h;
    const fx = clamp((x + 1) / 2 * (N - 1), 0, N - 1.001), fy = clamp((y + 1) / 2 * (N - 1), 0, N - 1.001);
    const i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j;
    const a = h[j * N + i], b = h[j * N + i + 1], c = h[(j + 1) * N + i + 1], d = h[(j + 1) * N + i];
    return lerp(lerp(a, b, tx), lerp(d, c, tx), ty);
  }
  slopeAt(x, y) {
    const e = 2 / (this.N - 1);
    return Math.hypot(this.hAt(x + e, y) - this.hAt(x - e, y), this.hAt(x, y + e) - this.hAt(x, y - e)) / (2 * e);
  }

  contours() {
    const N = this.N, h = this.h, segs = [], lv = [];
    const T = [[], [[3, 0]], [[0, 1]], [[3, 1]], [[1, 2]], [[3, 0], [1, 2]], [[0, 2]], [[3, 2]], [[2, 3]], [[0, 2]], [[0, 1], [2, 3]], [[1, 2]], [[1, 3]], [[0, 1]], [[0, 3]], []];
    const pt = [0, 0];
    const edge = (e, i, j, a, b, c, d, L) => {
      let t;
      if (e === 0) { t = (L - a) / (b - a); pt[0] = i + t; pt[1] = j; }
      else if (e === 1) { t = (L - b) / (c - b); pt[0] = i + 1; pt[1] = j + t; }
      else if (e === 2) { t = (L - c) / (d - c); pt[0] = i + 1 - t; pt[1] = j + 1; }
      else { t = (L - d) / (a - d); pt[0] = i; pt[1] = j + 1 - t; }
    };
    const s = 2 / (N - 1);
    for (let k = 1; k <= LEVELS; k++) {
      const L = k / (LEVELS + 1);
      for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
        const a = h[j * N + i], b = h[j * N + i + 1], c = h[(j + 1) * N + i + 1], d = h[(j + 1) * N + i];
        const cs = T[(a > L ? 1 : 0) | (b > L ? 2 : 0) | (c > L ? 4 : 0) | (d > L ? 8 : 0)];
        for (const [e1, e2] of cs) {
          edge(e1, i, j, a, b, c, d, L); const x1 = pt[0] * s - 1, y1 = pt[1] * s - 1;
          edge(e2, i, j, a, b, c, d, L); segs.push(x1, y1, pt[0] * s - 1, pt[1] * s - 1); lv.push(k);
        }
      }
    }
    this.seg = Float32Array.from(segs); this.segLv = Uint8Array.from(lv);
  }

  water() {
    const N = this.N, h = this.h, M = N * N;
    const filled = new Float32Array(M), seen = new Uint8Array(M), heap = [], hv = [];
    const push = (i, v) => { heap.push(i); hv.push(v); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (hv[p] <= hv[c]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; [hv[p], hv[c]] = [hv[c], hv[p]]; c = p; } };
    const pop = () => { const top = heap[0], tv = hv[0], li = heap.pop(), lvv = hv.pop(); if (heap.length) { heap[0] = li; hv[0] = lvv; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && hv[l] < hv[m]) m = l; if (r < heap.length && hv[r] < hv[m]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; [hv[m], hv[c]] = [hv[c], hv[m]]; c = m; } } return [top, tv]; };
    for (let i = 0; i < N; i++) for (const k of [i, (N - 1) * N + i, i * N, i * N + N - 1]) if (!seen[k]) { seen[k] = 1; filled[k] = h[k]; push(k, h[k]); }
    while (heap.length) {
      const [c, v] = pop(); const ci = c % N, cj = (c / N) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue; const n = nj * N + ni;
        if (seen[n]) continue; seen[n] = 1; const nv = Math.max(h[n], v + 1e-5); filled[n] = nv; push(n, nv);
      }
    }
    const down = new Int32Array(M).fill(-1);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i; let bi = -1;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue; const n = nj * N + ni;
        if (filled[n] < filled[k] && (bi < 0 || filled[n] < filled[bi])) bi = n;
      }
      down[k] = bi;
    }
    const order = Array.from({ length: M }, (_, i) => i).sort((a, b) => filled[b] - filled[a]);
    const acc = new Float32Array(M).fill(1);
    for (const k of order) if (down[k] >= 0) acc[down[k]] += acc[k];
    const thr = M * 0.0035, rivers = [], mask = new Uint8Array(M), lakes = [];
    const mid = (a, b) => [(this.w(a % N) + this.w(b % N)) / 2, (this.w((a / N) | 0) + this.w((b / N) | 0)) / 2];
    for (let k = 0; k < M; k++) {
      const depth = filled[k] - h[k];
      if (depth > 0.018 && acc[k] > thr * 0.5) lakes.push(this.w(k % N), this.w((k / N) | 0), depth);
      if (acc[k] <= thr || down[k] < 0) continue;
      // midpoint smoothing: each segment becomes a curve through the cell centre
      const d = down[k], dd = down[d];
      const [sx, sy] = mid(k, d), [ex, ey] = dd >= 0 ? mid(d, dd) : [this.w(d % N), this.w((d / N) | 0)];
      rivers.push(sx, sy, this.w(d % N), this.w((d / N) | 0), ex, ey, Math.log(acc[k] / thr));
      mask[k] = 1;
    }
    this.lakes = lakes;
    this.rivers = Float32Array.from(rivers);
    const dist = new Float32Array(M).fill(1e9), q = [];
    for (let k = 0; k < M; k++) if (mask[k]) { dist[k] = 0; q.push(k); }
    for (let qi = 0; qi < q.length; qi++) {
      const k = q[qi], i = k % N, j = (k / N) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        const n = nj * N + ni; if (dist[n] > dist[k] + 1) { dist[n] = dist[k] + 1; q.push(n); }
      }
    }
    this.waterDist = dist;
  }

  settle() {
    const N = this.N, h = this.h, rand = this.rand, cand = [];
    for (let j = 3; j < N - 3; j += 2) for (let i = 3; i < N - 3; i += 2) {
      const x = this.w(i), y = this.w(j), k = j * N + i, hh = h[k];
      if (hh < 0.1 || hh > 0.58) continue;
      const sl = this.slopeAt(x, y); if (sl > 1.4) continue;
      const wd = this.waterDist[k] / N;
      cand.push({ x, y, score: (1 - sl / 1.4) * Math.exp(-(wd * wd) / 0.004) * (0.6 + rand() * 0.8) * (1.15 - Math.abs(x) * 0.35) });
    }
    cand.sort((a, b) => b.score - a.score);
    const towns = [];
    for (const c of cand) {
      if (towns.length >= 17) break;
      if (towns.every((t) => Math.hypot(t.x - c.x, t.y - c.y) > 0.19)) towns.push({ x: c.x, y: c.y, size: 0 });
    }
    towns.forEach((t, i) => { t.size = clamp(1 - i / towns.length + (rand() - 0.5) * 0.3, 0.15, 1); });
    this.towns = towns;
    const inTree = [0], edges = [];
    while (inTree.length < towns.length) {
      let best = null;
      for (const a of inTree) for (let b = 0; b < towns.length; b++) {
        if (inTree.includes(b)) continue;
        const d = Math.hypot(towns[a].x - towns[b].x, towns[a].y - towns[b].y);
        if (!best || d < best.d) best = { a, b, d };
      }
      inTree.push(best.b); edges.push(best);
    }
    // roads bend gently around slopes
    this.roads = edges.map((e) => this.route(towns[e.a], towns[e.b], 30, 0.03));
    const paths = [];
    towns.forEach((t, i) => {
      towns.map((u, k) => ({ k, d: Math.hypot(u.x - t.x, u.y - t.y) })).filter((o) => o.k !== i)
        .sort((a, b) => a.d - b.d).slice(0, 2).forEach((o) => { if (o.k > i || o.d > 0.3) paths.push(this.route(t, towns[o.k], 22, 0.06)); });
    });
    this.paths = paths;
  }

  route(a, b, n, wob) {
    const pts = [], nx = -(b.y - a.y), ny = b.x - a.x, nl = Math.hypot(nx, ny) || 1;
    const bend = (this.rand() - 0.5) * wob * 2, bend2 = (this.rand() - 0.5) * wob;
    for (let s = 0; s <= n; s++) {
      const t = s / n, off = Math.sin(t * Math.PI) * bend + Math.sin(t * Math.PI * 2) * bend2;
      pts.push(lerp(a.x, b.x, t) + (nx / nl) * off, lerp(a.y, b.y, t) + (ny / nl) * off);
    }
    return pts;
  }

  vegetation() {
    const veg = [], rand = this.rand, count = this.mobile ? 1400 : 2600;
    let tries = 0;
    while (veg.length < count * 2 && tries++ < count * 30) {
      const x = rand() * 2 - 1, y = rand() * 2 - 1, hh = this.hAt(x, y);
      if (hh < 0.18 || hh > 0.8) continue;
      if (this.noise(x * 3.2 + 9, y * 3.2 - 4) < 0.08) continue;
      if (this.slopeAt(x, y) > 2.2) continue;
      veg.push(x, y);
    }
    this.veg = veg;
  }

  households() {
    const L = [], rand = this.rand;
    const gauss = () => { let u = 0, v = 0; while (!u) u = rand(); while (!v) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    this.towns.forEach((t, ti) => {
      const n = Math.round(22 + t.size * 70), sig = 0.018 + t.size * 0.036;
      for (let k = 0; k < n; k++) {
        const x = t.x + gauss() * sig, y = t.y + gauss() * sig * 0.9;
        if (Math.abs(x) > 1 || Math.abs(y) > 1) continue;
        if (this.hAt(x, y) > 0.7 || this.slopeAt(x, y) > 2.4) continue;
        const r = Math.hypot(x - t.x, y - t.y) / (sig * 2.5);
        const quiet = rand() < 0.28;
        L.push({ x, y, rot: rand() * 1.2, s: 0.7 + rand() * 0.6, order: quiet ? 1 + rand() * 0.25 : clamp((ti / this.towns.length) * 0.55 + r * 0.25 + rand() * 0.25, 0, 0.98), b: 0.55 + rand() * 0.45, ph: rand() * 6.28, f: 0.6 + rand() * 1.4 });
      }
    });
    const N = this.N; let added = 0, tries = 0;
    while (added < 150 && tries++ < 20000) {
      const i = 2 + ((rand() * (N - 4)) | 0), j = 2 + ((rand() * (N - 4)) | 0), k = j * N + i, wd = this.waterDist[k];
      if (wd < 1 || wd > 5 || this.h[k] > 0.62) continue;
      const quiet = rand() < 0.45;
      L.push({ x: this.w(i), y: this.w(j), rot: rand(), s: 0.6 + rand() * 0.4, order: quiet ? 1 + rand() * 0.25 : 0.45 + rand() * 0.5, b: 0.4 + rand() * 0.4, ph: rand() * 6.28, f: 0.5 + rand() });
      added++;
    }
    this.homes = L;
  }

  /* -------------------------------------------------------------- printing */

  // One pass over the land produces three images: the tinted paper, the
  // day relief (transparent), and the moonlit relief for the night sheet.
  shade(R) {
    const base = new ImageData(R, R), day = new ImageData(R, R), night = new ImageData(R, R);
    const L = [-0.62, -0.62, 0.48], ln = Math.hypot(...L); L[0] /= ln; L[1] /= ln; L[2] /= ln;
    const e = 2.4 * 2 / R, zs = 2.4;
    const low = [233, 230, 210], high = [236, 220, 192], paper = INK.paper;
    for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) {
      const x = (i / (R - 1)) * 2 - 1, y = (j / (R - 1)) * 2 - 1;
      const hh = this.hAt(x, y);
      const dx = (this.hAt(x + e, y) - this.hAt(x - e, y)) / (2 * e) * zs * 0.25;
      const dy = (this.hAt(x, y + e) - this.hAt(x, y - e)) / (2 * e) * zs * 0.25;
      const nl = Math.hypot(dx, dy, 1);
      const sh = clamp((-dx * L[0] - dy * L[1] + L[2]) / nl);
      const o = (j * R + i) * 4;
      // paper with a whisper of elevation tint
      const t = clamp((hh - 0.15) / 0.8);
      base.data[o] = lerp(lerp(paper[0], low[0], 0.35), high[0], t * 0.6);
      base.data[o + 1] = lerp(lerp(paper[1], low[1], 0.35), high[1], t * 0.6);
      base.data[o + 2] = lerp(lerp(paper[2], low[2], 0.35), high[2], t * 0.6);
      base.data[o + 3] = 255;
      // relief: violet-brown shadows, cream lights (Swiss style, very soft)
      const mid = 0.62;
      if (sh < mid) { day.data[o] = 96; day.data[o + 1] = 84; day.data[o + 2] = 98; day.data[o + 3] = Math.min(92, (mid - sh) * 170); }
      else { day.data[o] = 255; day.data[o + 1] = 251; day.data[o + 2] = 238; day.data[o + 3] = Math.min(70, (sh - mid) * 200); }
      // night: indigo ground, moonlit slopes
      const m = clamp((sh - 0.35) * 1.6);
      night.data[o] = lerp(15, 30, m) + hh * 5;
      night.data[o + 1] = lerp(21, 38, m) + hh * 5;
      night.data[o + 2] = lerp(36, 58, m) + hh * 7;
      night.data[o + 3] = 255;
    }
    return { base, day, night };
  }

  printPlates(S, canvases) {
    const R = this.N;
    const img = this.shade(R);
    this._night = img.night; this._R = R;
    const tmp = mk(R);
    const tctx = tmp.getContext('2d');
    const P = (x) => (x + 1) * S / 2;
    const u = S / 1000; // one "map unit" in plate pixels

    // ---- base: paper + grid
    {
      const c = canvases.base; c.width = c.height = S; const ctx = c.getContext('2d');
      tctx.putImageData(img.base, 0, 0);
      ctx.imageSmoothingQuality = 'high'; ctx.filter = `blur(${(S / R * 0.8).toFixed(1)}px)`; ctx.drawImage(tmp, -10, -10, S + 20, S + 20); ctx.filter = 'none';
      ctx.strokeStyle = `rgba(${INK.water},.16)`; ctx.lineWidth = 0.8 * u;
      for (let g = -1; g <= 1.001; g += 0.25) {
        ctx.beginPath(); ctx.moveTo(P(g), 0); ctx.lineTo(P(g), S); ctx.moveTo(0, P(g)); ctx.lineTo(S, P(g)); ctx.stroke();
      }
    }
    // ---- terrain: relief + contours + spot heights
    {
      const c = canvases.terrain; c.width = c.height = S; const ctx = c.getContext('2d');
      tctx.clearRect(0, 0, R, R); tctx.putImageData(img.day, 0, 0);
      ctx.imageSmoothingQuality = 'high'; ctx.filter = `blur(${(S / R * 0.6).toFixed(1)}px)`; ctx.drawImage(tmp, 0, 0, S, S); ctx.filter = 'none';
      const seg = this.seg, lv = this.segLv;
      const idx = new Path2D(), reg = new Path2D();
      for (let k = 0, m = 0; k < seg.length; k += 4, m++) {
        const p = lv[m] % 5 === 0 ? idx : reg;
        p.moveTo(P(seg[k]), P(seg[k + 1])); p.lineTo(P(seg[k + 2]), P(seg[k + 3]));
      }
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(${INK.brown},.55)`; ctx.lineWidth = 0.75 * u; ctx.stroke(reg);
      ctx.strokeStyle = `rgba(${INK.brown},.9)`; ctx.lineWidth = 1.5 * u; ctx.stroke(idx);
      // contour values, set along the line with a paper halo
      ctx.font = `italic ${9.5 * u}px Zodiak, Georgia, serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const placed = [];
      for (let k = 0, m = 0; k < seg.length; k += 4, m++) {
        if (lv[m] % 5 !== 0 || (m * 7919) % 97 > 1) continue;
        const x = (seg[k] + seg[k + 2]) / 2, y = (seg[k + 1] + seg[k + 3]) / 2;
        if (Math.abs(x) > 0.92 || Math.abs(y) > 0.92) continue;
        if (placed.some((q) => Math.hypot(q[0] - x, q[1] - y) < 0.2)) continue;
        placed.push([x, y]);
        let a = Math.atan2(seg[k + 3] - seg[k + 1], seg[k + 2] - seg[k]);
        if (a > Math.PI / 2) a -= Math.PI; if (a < -Math.PI / 2) a += Math.PI;
        ctx.save(); ctx.translate(P(x), P(y)); ctx.rotate(a);
        const label = String(200 + lv[m] * 20);
        ctx.lineWidth = 3.5 * u; ctx.strokeStyle = 'rgba(240,232,215,.95)'; ctx.strokeText(label, 0, 0);
        ctx.fillStyle = `rgba(${INK.brown},1)`; ctx.fillText(label, 0, 0);
        ctx.restore();
      }
      // spot heights on the summits
      ctx.font = `${8.5 * u}px Ranade, sans-serif`; ctx.fillStyle = `rgba(${INK.ink},.75)`;
      let peaks = 0;
      for (let j = 6; j < this.N - 6 && peaks < 9; j += 3) for (let i = 6; i < this.N - 6 && peaks < 9; i += 3) {
        const hh = this.h[j * this.N + i]; if (hh < 0.72) continue;
        let top = true;
        for (let dj = -4; dj <= 4 && top; dj++) for (let di = -4; di <= 4; di++) if (this.h[(j + dj) * this.N + i + di] > hh) { top = false; break; }
        if (!top) continue; peaks++;
        const x = P(this.w(i)), y = P(this.w(j));
        ctx.beginPath(); ctx.moveTo(x, y - 3 * u); ctx.lineTo(x + 2.6 * u, y + 1.6 * u); ctx.lineTo(x - 2.6 * u, y + 1.6 * u); ctx.closePath(); ctx.fill();
        ctx.fillText(String(Math.round(200 + hh * 640)), x + 12 * u, y);
      }
    }
    // ---- water & living systems
    {
      const c = canvases.water; c.width = c.height = S; const ctx = c.getContext('2d');
      // cultivation / forest symbols (little open circles, as on old sheets)
      ctx.strokeStyle = `rgba(${INK.green},.7)`; ctx.lineWidth = 0.7 * u;
      const v = this.veg;
      ctx.beginPath();
      for (let k = 0; k < v.length; k += 2) { const x = P(v[k]), y = P(v[k + 1]); ctx.moveTo(x + 1.7 * u, y); ctx.arc(x, y, 1.7 * u, 0, 6.283); }
      ctx.stroke();
      ctx.fillStyle = `rgba(${INK.green},.08)`;
      for (let k = 0; k < v.length; k += 2) { ctx.beginPath(); ctx.arc(P(v[k]), P(v[k + 1]), 7 * u, 0, 6.283); ctx.fill(); }
      // rivers, widening with the water they carry
      // still water first: tinted, with a firmer shoreline
      const lk = this.lakes, cell = S / this.N;
      ctx.fillStyle = `rgba(${INK.water},.22)`;
      ctx.beginPath(); for (let k = 0; k < lk.length; k += 3) { ctx.moveTo(P(lk[k]) + cell * 0.8, P(lk[k + 1])); ctx.arc(P(lk[k]), P(lk[k + 1]), cell * 0.8, 0, 6.283); } ctx.fill();
      const rv = this.rivers; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let k = 0; k < rv.length; k += 7) {
        ctx.strokeStyle = `rgba(${INK.water},${clamp(0.5 + rv[k + 6] * 0.12, 0, 0.9)})`;
        ctx.lineWidth = (0.55 + rv[k + 6] * 0.5) * u;
        ctx.beginPath(); ctx.moveTo(P(rv[k]), P(rv[k + 1])); ctx.quadraticCurveTo(P(rv[k + 2]), P(rv[k + 3]), P(rv[k + 4]), P(rv[k + 5])); ctx.stroke();
      }
      // water lettering, italic as cartographers set it
      ctx.font = `italic ${11 * u}px Zodiak, Georgia, serif`; ctx.fillStyle = `rgba(${INK.water},.95)`;
      const big = []; for (let k = 0; k < rv.length; k += 7) if (rv[k + 6] > 2.6 && Math.abs(rv[k + 1]) < 0.6) big.push(k);
      if (big.length) {
        const k = big[(big.length / 2) | 0];
        ctx.save(); ctx.translate(P(rv[k]) + 14 * u, P(rv[k + 1])); ctx.rotate(Math.atan2(rv[k + 5] - rv[k + 1], rv[k + 4] - rv[k]) - Math.PI / 2);
        ctx.fillText('r i v e r', 0, 0); ctx.restore();
      }
    }
    // ---- people: houses, worn paths, places
    {
      const c = canvases.people; c.width = c.height = S; const ctx = c.getContext('2d');
      ctx.setLineDash([3.5 * u, 3.5 * u]); ctx.strokeStyle = `rgba(${INK.verm},.8)`; ctx.lineWidth = 1.4 * u;
      for (const r of this.paths) { ctx.beginPath(); for (let k = 0; k < r.length; k += 2) k ? ctx.lineTo(P(r[k]), P(r[k + 1])) : ctx.moveTo(P(r[k]), P(r[k + 1])); ctx.stroke(); }
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(${INK.verm},.92)`;
      for (const o of this.homes) {
        if (o.order > 1) continue;
        ctx.save(); ctx.translate(P(o.x), P(o.y)); ctx.rotate(o.rot); const s = 3 * u * o.s; ctx.fillRect(-s / 2, -s / 2, s, s * 0.8); ctx.restore();
      }
      const notes = ['school', 'well', 'health post', 'temple', 'school', 'ford'];
      ctx.font = `italic ${9.5 * u}px Zodiak, Georgia, serif`; ctx.fillStyle = `rgba(${INK.ink},.85)`;
      this.towns.slice(1, 7).forEach((t, i) => {
        const x = P(t.x) + 18 * u, y = P(t.y) - 14 * u;
        ctx.lineWidth = 3 * u; ctx.strokeStyle = 'rgba(240,232,215,.9)'; ctx.strokeText(notes[i], x, y); ctx.fillText(notes[i], x, y);
      });
    }
    // ---- economy: roads and markets
    {
      const c = canvases.econ; c.width = c.height = S; const ctx = c.getContext('2d');
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const line = (r) => { ctx.beginPath(); for (let k = 0; k < r.length; k += 2) k ? ctx.lineTo(P(r[k]), P(r[k + 1])) : ctx.moveTo(P(r[k]), P(r[k + 1])); ctx.stroke(); };
      ctx.strokeStyle = `rgba(${INK.ink},.85)`; ctx.lineWidth = 3.8 * u; this.roads.forEach(line);
      ctx.strokeStyle = `rgba(${INK.yellow},1)`; ctx.lineWidth = 2.2 * u; this.roads.forEach(line);
      this.towns.forEach((t, i) => {
        if (t.size < 0.6) return;
        const x = P(t.x), y = P(t.y), s = 6 * u;
        ctx.fillStyle = 'rgba(240,232,215,1)'; ctx.fillRect(x - s, y - s, 2 * s, 2 * s);
        ctx.strokeStyle = `rgba(${INK.ink},1)`; ctx.lineWidth = 1.2 * u; ctx.strokeRect(x - s, y - s, 2 * s, 2 * s);
        ctx.fillStyle = `rgba(${INK.ink},1)`; ctx.beginPath(); ctx.arc(x, y, 1.8 * u, 0, 6.283); ctx.fill();
        if (i === 0) {
          ctx.font = `italic ${10.5 * u}px Zodiak, Georgia, serif`;
          ctx.lineWidth = 3 * u; ctx.strokeStyle = 'rgba(240,232,215,.95)';
          ctx.strokeText('weekly haat', x + 12 * u, y + 4 * u); ctx.fillText('weekly haat', x + 12 * u, y + 4 * u);
        }
      });
    }
  }

  // The simple "surface": what a place looks like from far away.
  drawSurface(c, size, ox, oy) {
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    const P = (v, o) => o + (v + 1) * size / 2;
    ctx.strokeStyle = `rgba(${INK.ink},.32)`; ctx.lineWidth = 1;
    const seg = this.seg, lv = this.segLv;
    ctx.beginPath();
    for (let k = 0, m = 0; k < seg.length; k += 4, m++) {
      if (lv[m] !== 10 && lv[m] !== 20) continue;
      ctx.moveTo(P(seg[k], ox), P(seg[k + 1], oy)); ctx.lineTo(P(seg[k + 2], ox), P(seg[k + 3], oy));
    }
    ctx.stroke();
    ctx.strokeStyle = `rgba(${INK.water},.55)`; ctx.lineWidth = 1.4;
    const rv = this.rivers; ctx.beginPath();
    for (let k = 0; k < rv.length; k += 7) { if (rv[k + 6] < 2.2) continue; ctx.moveTo(P(rv[k], ox), P(rv[k + 1], oy)); ctx.quadraticCurveTo(P(rv[k + 2], ox), P(rv[k + 3], oy), P(rv[k + 4], ox), P(rv[k + 5], oy)); }
    ctx.stroke();
  }

  // The night sheet: built only when the visitor gets near the end.
  printNight(S) {
    const c = mk(S), ctx = c.getContext('2d'), R = this._R, tmp = mk(R);
    tmp.getContext('2d').putImageData(this._night, 0, 0);
    ctx.imageSmoothingQuality = 'high'; ctx.filter = `blur(${(S / R * 0.6).toFixed(1)}px)`; ctx.drawImage(tmp, -8, -8, S + 16, S + 16); ctx.filter = 'none';
    const P = (x) => (x + 1) * S / 2, u = S / 1000;
    const seg = this.seg, lv = this.segLv, p = new Path2D();
    const p2 = new Path2D();
    for (let k = 0, m = 0; k < seg.length; k += 4, m++) { const q = lv[m] % 5 ? p2 : p; q.moveTo(P(seg[k]), P(seg[k + 1])); q.lineTo(P(seg[k + 2]), P(seg[k + 3])); }
    ctx.strokeStyle = 'rgba(160,178,210,.09)'; ctx.lineWidth = 0.7 * u; ctx.stroke(p2);
    ctx.strokeStyle = 'rgba(170,186,215,.2)'; ctx.lineWidth = 1.1 * u; ctx.stroke(p);
    const rv = this.rivers; ctx.lineCap = 'round';
    for (let k = 0; k < rv.length; k += 7) {
      ctx.strokeStyle = `rgba(140,170,200,${clamp(0.16 + rv[k + 6] * 0.05, 0, 0.32)})`; ctx.lineWidth = (0.5 + rv[k + 6] * 0.45) * u;
      ctx.beginPath(); ctx.moveTo(P(rv[k]), P(rv[k + 1])); ctx.quadraticCurveTo(P(rv[k + 2]), P(rv[k + 3]), P(rv[k + 4]), P(rv[k + 5])); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(150,140,130,.12)'; ctx.lineWidth = 1.4 * u;
    for (const r of this.roads) { ctx.beginPath(); for (let k = 0; k < r.length; k += 2) k ? ctx.lineTo(P(r[k]), P(r[k + 1])) : ctx.moveTo(P(r[k]), P(r[k + 1])); ctx.stroke(); }
    this.nightTex = c;
    return c;
  }
}

export function glowSprite() {
  const s = 64, c = mk(s), g = c.getContext('2d'), gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, 'rgba(255,238,200,1)');
  gr.addColorStop(0.12, 'rgba(252,214,150,0.95)');
  gr.addColorStop(0.34, 'rgba(232,150,80,0.30)');
  gr.addColorStop(1, 'rgba(207,74,42,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  return c;
}
