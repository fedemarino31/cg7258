// Reparación automática: corrige superposiciones y formas fuera de la grilla
// desplazando lo mínimo posible las traslaciones de las aristas involucradas.

import { clone, findNode, pathTo } from './doc.js';
import { allPolygons } from './evaluate.js';
import { findOverlaps, outsideGrid } from './collide.js';

function problems(doc) {
  const polys = allPolygons(doc);
  const overlaps = findOverlaps(polys);
  const outside = outsideGrid(polys, doc.grilla, 2);
  return { overlaps, outside, count: overlaps.length + outside.length };
}

/** Aristas candidatas a mover: los nodos del camino desde el hijo del ancestro común hasta cada nodo. */
function candidates(doc, ids) {
  const paths = ids.map((id) => pathTo(doc, id));
  let common = 0;
  while (paths.length > 1 && paths.every((p) => p[common + 1] && p[common + 1].id === paths[0][common + 1]?.id)) common++;
  const set = new Map();
  for (const p of paths) for (const n of p.slice(common + 1)) set.set(n.id, n);
  return [...set.values()];
}

const DIRS = [];
for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (dx || dy) DIRS.push([dx, dy]);

/** Aplica un desplazamiento (dx, dy) a la primera traslación de la fórmula (o la agrega al inicio). */
function shifted(doc, id, dx, dy) {
  const d = clone(doc);
  const n = findNode(d, id);
  const t = n.t.find((o) => o.op === 'T');
  if (t) {
    t.x += dx;
    t.y += dy;
  } else n.t.unshift({ op: 'T', x: dx, y: dy });
  return d;
}

/** Devuelve { doc, cambios } con el documento reparado (o el mejor intento). */
export function repair(original, maxRounds = 20) {
  let doc = clone(original);
  const cambios = [];
  for (let round = 0; round < maxRounds; round++) {
    const p = problems(doc);
    if (!p.count) break;
    const ids = p.overlaps.length ? [p.overlaps[0].a, p.overlaps[0].b] : [p.outside[0]];
    let best = null;
    for (const node of candidates(doc, ids)) {
      for (let step = 5; step <= 60; step += 5) {
        for (const [ux, uy] of DIRS) {
          const trial = shifted(doc, node.id, ux * step, uy * step);
          const q = problems(trial);
          if (q.count >= p.count) continue;
          const score = q.count * 1000 + Math.hypot(ux, uy) * step;
          if (!best || score < best.score) best = { score, trial, id: node.id, dx: ux * step, dy: uy * step };
        }
      }
    }
    if (!best) break;
    doc = best.trial;
    cambios.push({ id: best.id, dx: best.dx, dy: best.dy });
  }
  return { doc, cambios, ok: problems(doc).count === 0 };
}
