// Layout del árbol para dibujar el grafo (compartido por la vista interactiva y la de impresión).

import { hierarchy, tree } from 'd3-hierarchy';
import { format } from './formula.js';

export const NODE_H = 30;
export const LEVEL_H = 104;

export const nodeW = (doc, n) => {
  if (n.id === doc.raiz.id) return 64;
  if (n.modelo) return 44;
  return Math.max(76, 14 + 7.4 * (n.nombre || 'Contenedor').length);
};

export const edgeText = (n, hide = false) => (hide ? '?' : format(n.t ?? []));

export const labelW = (doc, n, hide = false) => (n.id === doc.raiz.id ? 0 : edgeText(n, hide).length * 6.6 + 14);

/** Posiciones de los nodos (x centrado en 0 para la raíz, y hacia abajo) y límites. */
export function layoutTree(doc, hide = false) {
  const root = hierarchy(doc.raiz, (n) => n.hijos);
  tree()
    .nodeSize([1, LEVEL_H])
    .separation((a, b) => {
      const wa = Math.max(nodeW(doc, a.data), labelW(doc, a.data, hide));
      const wb = Math.max(nodeW(doc, b.data), labelW(doc, b.data, hide));
      return (wa + wb) / 2 + 22;
    })(root);
  const nodes = root.descendants();
  const links = root.links();
  let x0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of nodes) {
    const w = Math.max(nodeW(doc, n.data), labelW(doc, n.data, hide));
    x0 = Math.min(x0, n.x - w / 2);
    x1 = Math.max(x1, n.x + w / 2);
    y1 = Math.max(y1, n.y + NODE_H / 2 + 14);
  }
  return { root, nodes, links, bounds: { x0, x1, y0: -NODE_H / 2, y1 } };
}
