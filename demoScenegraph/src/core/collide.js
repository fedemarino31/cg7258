// Detección de superposiciones y de formas fuera de la grilla.

import polygonClipping from 'polygon-clipping';
import { allPolygons, evaluate, worldPolygon } from './evaluate.js';
import { isSingular } from './formula.js';
import { walk } from './doc.js';

export const EPS_AREA = 0.5; // unidades² de tolerancia (bordes que se tocan; ~imperceptible en pantalla)

function area(multi) {
  let a = 0;
  for (const poly of multi) {
    poly.forEach((ring, i) => {
      let s = 0;
      for (let j = 0; j < ring.length - 1; j++) {
        s += ring[j][0] * ring[j + 1][1] - ring[j + 1][0] * ring[j][1];
      }
      a += (i === 0 ? 1 : -1) * Math.abs(s / 2);
    });
  }
  return a;
}

export function polygonArea(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    s += x0 * y1 - x1 * y0;
  }
  return Math.abs(s / 2);
}

/** Área de la intersección de dos polígonos (puede ser no convexos). */
export function overlapArea(a, b) {
  try {
    return area(polygonClipping.intersection([a], [b]));
  } catch {
    return 0;
  }
}

function bbox(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1 };
}

const bboxOverlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** Pares de polígonos [{id, poly}] que se superponen más que la tolerancia. */
export function findOverlaps(polys, eps = EPS_AREA) {
  const boxes = polys.map((p) => bbox(p.poly));
  const res = [];
  for (let i = 0; i < polys.length; i++) {
    for (let j = i + 1; j < polys.length; j++) {
      if (!bboxOverlap(boxes[i], boxes[j])) continue;
      const a = overlapArea(polys[i].poly, polys[j].poly);
      if (a > eps) res.push({ a: polys[i].id, b: polys[j].id, area: a });
    }
  }
  return res;
}

export function outsideGrid(polys, grilla, margin = 0) {
  const lo = grilla.min + margin - 1e-6;
  const hi = grilla.max - margin + 1e-6;
  return polys
    .filter(({ poly }) => poly.some(([x, y]) => x < lo || x > hi || y < lo || y > hi))
    .map((p) => p.id);
}

/**
 * Valida un documento. Devuelve { overlaps, outside, singular, ok } donde cada
 * elemento referencia ids de nodos.
 */
export function validate(doc, frameId = null) {
  const polys = allPolygons(doc, frameId);
  const overlaps = findOverlaps(polys);
  const outside = outsideGrid(polys, doc.grilla);
  const singular = [];
  for (const { node } of walk(doc.raiz)) {
    if ((node.t ?? []).some(isSingular)) singular.push(node.id);
  }
  const bad = new Set([...overlaps.flatMap((o) => [o.a, o.b]), ...outside, ...singular]);
  return { overlaps, outside, singular, bad, ok: bad.size === 0 };
}

export { evaluate, worldPolygon };
