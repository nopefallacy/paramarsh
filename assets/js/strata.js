// TRANSPARENCY — a geological cross-section of a conclusion.
// Four strata beneath the clean surface: methods, sources, decisions,
// limitations. Limitations is drawn the way geologists draw a contact they
// have not observed: dashed, with a question mark.

export const STRATA = [
  {
    name: 'Methods',
    lead: 'How the question was approached and tested. Which tools, which comparisons, and why those.',
    eg: 'Three possible routes compared on gradient, flood exposure, cost and walking time to the nearest market.',
  },
  {
    name: 'Sources',
    lead: 'Where the information came from, how recent it is, and how much weight it can bear.',
    eg: 'A terrain survey, flood records that are patchy in earlier years, and conversations with the people who use the existing track every day.',
  },
  {
    name: 'Decisions',
    lead: 'Where the evidence ran out and judgement began, and whose judgement it was.',
    eg: 'The western route was cheaper. It was set aside because it crosses land that floods most seasons. A judgement, written down with its reasons.',
  },
  {
    name: 'Limitations',
    lead: 'What we don’t know, what the data can’t support, and what should be checked again. The layer most reports leave out.',
    eg: 'Flood frequency is estimated from a short record. If rainfall patterns shift, the ridge route should be reviewed.',
  },
];

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
};

export function buildStrata(svg, onSelect) {
  const W = 800, X0 = 150, X1 = 780;
  const defs = el('defs', {}, svg);

  // geological fills
  const p1 = el('pattern', { id: 'pat-methods', width: 9, height: 9, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(35)' }, defs);
  el('line', { x1: 0, y1: 0, x2: 0, y2: 9, stroke: 'currentColor', 'stroke-width': 0.8, opacity: 0.55 }, p1);
  const p2 = el('pattern', { id: 'pat-sources', width: 10, height: 10, patternUnits: 'userSpaceOnUse' }, defs);
  el('circle', { cx: 2, cy: 2, r: 1, fill: 'currentColor', opacity: 0.55 }, p2);
  el('circle', { cx: 7, cy: 7, r: 0.8, fill: 'currentColor', opacity: 0.4 }, p2);
  const p3 = el('pattern', { id: 'pat-decisions', width: 22, height: 12, patternUnits: 'userSpaceOnUse' }, defs);
  el('line', { x1: 2, y1: 3, x2: 12, y2: 3, stroke: 'currentColor', 'stroke-width': 0.9, opacity: 0.55 }, p3);
  el('line', { x1: 13, y1: 9, x2: 21, y2: 9, stroke: 'currentColor', 'stroke-width': 0.9, opacity: 0.55 }, p3);
  const p4 = el('pattern', { id: 'pat-limits', width: 26, height: 26, patternUnits: 'userSpaceOnUse' }, defs);
  el('circle', { cx: 6, cy: 6, r: 0.7, fill: 'currentColor', opacity: 0.35 }, p4);
  el('circle', { cx: 19, cy: 17, r: 0.7, fill: 'currentColor', opacity: 0.25 }, p4);
  const fills = ['url(#pat-methods)', 'url(#pat-sources)', 'url(#pat-decisions)', 'url(#pat-limits)'];

  // boundary curves
  const base = [18, 128, 236, 344, 470];
  const amp = [6, 14, 10, 18, 22];
  const curve = (b, x) => base[b] + Math.sin(x * 0.011 + b * 1.7) * amp[b] + Math.sin(x * 0.027 + b) * amp[b] * 0.35;
  const line = (b, rev) => {
    const pts = [];
    for (let x = X0; x <= X1; x += 10) pts.push([x, curve(b, x)]);
    if (rev) pts.reverse();
    return pts.map((p, i) => `${i ? 'L' : (rev ? 'L' : 'M')}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  };

  const groups = [];
  for (let i = 0; i < 4; i++) {
    const g = el('g', { class: 'stratum', 'data-i': i, tabindex: 0, role: 'button', 'aria-label': `Stratum ${i + 1}: ${STRATA[i].name}` }, svg);
    const d = `${line(i)} ${line(i + 1, true)} Z`;
    el('path', { d, fill: fills[i], class: 'stratum__fill' }, g);
    el('path', { d, fill: 'transparent', stroke: 'none', class: 'stratum__hit' }, g);
    // upper contact: solid when observed, dashed when inferred
    el('path', { d: line(i), fill: 'none', stroke: 'currentColor', 'stroke-width': i === 0 ? 1.4 : 1, class: 'stratum__band' }, g);
    if (i === 3) {
      el('path', { d: line(4), fill: 'none', stroke: 'currentColor', 'stroke-width': 1, 'stroke-dasharray': '6 6', opacity: 0.8 }, g);
      [260, 470, 650].forEach((x) => { const t = el('text', { x, y: curve(4, x) - 8, class: 'q' }, g); t.textContent = '?'; });
      [380, 560].forEach((x) => { const t = el('text', { x, y: curve(3, x) + 46, class: 'q' }, g); t.textContent = '?'; });
    }
    // label + leader
    const midY = (curve(i, X0) + curve(i + 1, X0)) / 2;
    const lab = el('text', { x: 0, y: midY + 4, class: 'stratum__label' }, g);
    lab.textContent = `0${i + 1} ${STRATA[i].name}`;
    el('line', { x1: 118, y1: midY, x2: X0 + 18, y2: midY, stroke: 'currentColor', 'stroke-width': 0.8, 'stroke-dasharray': i === 3 ? '2 3' : null || '' }, g);
    el('circle', { cx: X0 + 20, cy: midY, r: 2.4, fill: 'currentColor' }, g);
    g.addEventListener('click', () => onSelect(i, true));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(i, true); } });
    groups.push(g);
  }

  // the cut line on the right, like a section drawing
  el('line', { x1: X1, y1: base[0] - 10, x2: X1, y2: base[4] + 30, stroke: 'currentColor', 'stroke-width': 0.6, opacity: 0.4 }, svg);
  const cap = el('text', { x: X1, y: base[4] + 50, 'text-anchor': 'end', class: 'stratum__label', opacity: 0.5 }, svg);
  cap.textContent = 'Section A–A′';

  return {
    groups,
    explode(p) { groups.forEach((g, i) => g.setAttribute('transform', `translate(0 ${(i * 16 * p).toFixed(2)})`)); },
    select(i) {
      svg.classList.toggle('has-active', i >= 0);
      groups.forEach((g, k) => g.classList.toggle('is-active', k === i));
    },
  };
}
