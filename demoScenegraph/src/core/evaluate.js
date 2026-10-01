// Evaluación del grafo: matrices de arista, de mundo, cadenas y polígonos.

import { compose } from './formula.js';
import { apply, identity, multiply } from './mat3.js';
import { modelPolygon } from './primitives.js';
import { findNode, pathTo, walk } from './doc.js';

export const edgeMatrix = (node) => compose(node.t);

/**
 * Matrices de mundo de todos los nodos. Con frameId, ese nodo es el origen
 * (su propia arista no cuenta) y solo se evalúa su subárbol: sirve para aislar.
 * Devuelve Map id -> { node, parent, depth, edge, world }.
 */
export function evaluate(doc, frameId = null) {
  const out = new Map();
  const start = frameId ? findNode(doc, frameId) ?? doc.raiz : doc.raiz;
  const rec = (node, parent, depth, parentWorld) => {
    const edge = node === start ? identity() : edgeMatrix(node);
    const world = node === start ? identity() : multiply(parentWorld, edge);
    out.set(node.id, { node, parent, depth, edge, world });
    for (const h of node.hijos ?? []) rec(h, node, depth + 1, world);
  };
  rec(start, null, 0, identity());
  return out;
}

/** Polígono de mundo de un nodo con modelo; null si es contenedor. */
export function worldPolygon(doc, entry) {
  const m = entry.node.modelo ? doc.modelos[entry.node.modelo] : null;
  if (!m) return null;
  return modelPolygon(m).map((p) => apply(entry.world, p));
}

/**
 * Cadena de matrices de la raíz al nodo:
 * [{ node, ops, matrix, cumulative }] donde cumulative es el producto parcial
 * M_arista1·…·M_aristak (la raíz no aporta factor).
 */
export function chain(doc, id, frameId = null) {
  let path = pathTo(doc, id);
  if (frameId) {
    const i = path.findIndex((n) => n.id === frameId);
    if (i >= 0) path = path.slice(i);
  }
  const links = [];
  let cum = identity();
  path.forEach((node, i) => {
    if (i === 0) return;
    const matrix = edgeMatrix(node);
    cum = multiply(cum, matrix);
    links.push({ node, ops: node.t ?? [], matrix, cumulative: cum });
  });
  return links;
}

export function bounds(polys) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const poly of polys) {
    for (const [x, y] of poly) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return polys.length ? { x0, y0, x1, y1 } : null;
}

/** Todos los polígonos de mundo (con id de nodo) de un documento. */
export function allPolygons(doc, frameId = null) {
  const res = [];
  for (const entry of evaluate(doc, frameId).values()) {
    const poly = worldPolygon(doc, entry);
    if (poly) res.push({ id: entry.node.id, poly });
  }
  return res;
}

export { walk };
