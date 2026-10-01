// Línea de tiempo de la animación de construcción.
//
// Una etapa por cada nodo interno (con hijos), en post-orden: de las hojas hacia
// la raíz. En la etapa del nodo P la vista está en el sistema local de P (P en el
// origen). Cada hijo, ya consolidado como bloque (su forma + su subárbol), nace en
// el origen y ejecuta las operaciones de su arista de DERECHA a IZQUIERDA.

import { opMatrix, partialCompose } from './formula.js';
import { evaluate, edgeMatrix } from './evaluate.js';
import { findNode } from './doc.js';
import { identity, multiply } from './mat3.js';

export const DUR = {
  intro: 0.4, // se muestra el marco del padre (y su forma, si tiene)
  appear: 0.3, // el hijo aparece en el origen
  op: 1.0, // cada operación de la arista
  hold: 0.6, // pausa al cerrar la etapa (bloque consolidado)
};

export const easeInOut = (s) => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);

function internalPostOrder(node, out = []) {
  for (const h of node.hijos ?? []) internalPostOrder(h, out);
  if ((node.hijos ?? []).length) out.push(node);
  return out;
}

/**
 * Construye la línea de tiempo. Devuelve:
 *  { stages: [{ index, nodeId, t0, t1, segments }], segments: [...], total }
 * Cada segmento: { stage, nodeId, kind: 'intro'|'appear'|'op'|'hold', childId?,
 *                  opIndex?, t0, t1 }
 */
export function buildTimeline(doc, frameId = null) {
  const start = frameId ? findNode(doc, frameId) ?? doc.raiz : doc.raiz;
  const parents = internalPostOrder(start);
  const segments = [];
  const stages = [];
  let t = 0;
  const push = (seg, dur) => {
    seg.t0 = t;
    seg.t1 = t + dur;
    t += dur;
    segments.push(seg);
    return seg;
  };
  parents.forEach((P, index) => {
    const stageStart = t;
    const stageSegs = [];
    stageSegs.push(push({ stage: index, nodeId: P.id, kind: 'intro' }, DUR.intro));
    for (const c of P.hijos) {
      stageSegs.push(push({ stage: index, nodeId: P.id, kind: 'appear', childId: c.id }, DUR.appear));
      const ops = c.t ?? [];
      for (let k = ops.length - 1; k >= 0; k--) {
        stageSegs.push(push({ stage: index, nodeId: P.id, kind: 'op', childId: c.id, opIndex: k }, DUR.op));
      }
    }
    stageSegs.push(push({ stage: index, nodeId: P.id, kind: 'hold' }, DUR.hold));
    stages.push({ index, nodeId: P.id, t0: stageStart, t1: t, segments: stageSegs });
  });
  return { stages, segments, total: t };
}

/**
 * Estado de la escena en el instante time (segundos "base", 0..total).
 * Devuelve:
 *  {
 *    stage, frameId,            // etapa actual y nodo que es el origen de la vista
 *    items: [{ id, matrix, opacity }],  // nodos visibles con su matriz en el marco
 *    seg, progress,             // segmento activo y progreso (con easing) 0..1
 *    activeChildId, activeOp,   // para resaltar en grafo e inspector
 *    doneStages: [nodeId],      // etapas completadas (para marcarlas en el grafo)
 *    finished
 *  }
 */
export function stateAt(doc, timeline, time) {
  const { segments, stages, total } = timeline;
  if (!stages.length) {
    return { stage: -1, frameId: doc.raiz.id, items: staticItems(doc, null), seg: null, progress: 1, doneStages: [], finished: true };
  }
  const t = Math.max(0, Math.min(total, time));
  let seg = segments.find((s) => t >= s.t0 && t < s.t1) ?? segments[segments.length - 1];
  const finished = t >= total;
  if (finished) seg = segments[segments.length - 1];
  const raw = finished ? 1 : (t - seg.t0) / (seg.t1 - seg.t0);
  const stage = stages[seg.stage];
  const P = findNode(doc, stage.nodeId);

  const items = [];
  // El propio padre (identidad en su marco): forma y/o ejes
  items.push({ id: P.id, matrix: identity(), opacity: 1 });

  const emit = (child, X, opacity) => {
    for (const [id, e] of evaluate(doc, child.id)) items.push({ id, matrix: multiply(X, e.world), opacity });
  };

  // Hijos ya terminados: todos al cerrar la etapa, ninguno en la intro, los
  // anteriores al activo en el resto.
  const kids = P.hijos;
  const activeIdx =
    seg.kind === 'hold' ? kids.length : seg.kind === 'intro' ? -1 : kids.findIndex((c) => c.id === seg.childId);
  kids.forEach((c, i) => {
    if (i < activeIdx) emit(c, edgeMatrix(c), 1);
    else if (i === activeIdx) {
      if (seg.kind === 'appear') emit(c, identity(), easeInOut(raw));
      else emit(c, partialCompose(c.t ?? [], seg.opIndex, easeInOut(raw)), 1);
    }
  });

  const doneStages = stages.filter((s) => t >= s.t1 - 1e-9).map((s) => s.nodeId);
  return {
    stage: seg.stage,
    frameId: P.id,
    items,
    seg,
    progress: seg.kind === 'op' ? easeInOut(raw) : raw,
    activeChildId: seg.childId ?? null,
    activeOp: seg.kind === 'op' ? seg.opIndex : null,
    doneStages,
    finished,
  };
}

/** Items del estado final estático (todos los nodos con su matriz de mundo). */
export function staticItems(doc, frameId = null) {
  return [...evaluate(doc, frameId).values()].map((e) => ({ id: e.node.id, matrix: e.world, opacity: 1 }));
}

/** Tiempo de inicio de la siguiente/anterior operación, etapa… para los botones. */
export function stepTarget(timeline, time, kind, dir) {
  const eps = 1e-6;
  const marks = [];
  if (kind === 'stage') {
    for (const s of timeline.stages) marks.push(s.t0);
    marks.push(timeline.total);
  } else {
    for (const s of timeline.segments) if (s.kind === 'op' || s.kind === 'intro') marks.push(s.t0);
    marks.push(timeline.total);
  }
  marks.sort((a, b) => a - b);
  if (dir > 0) return marks.find((m) => m > time + eps) ?? timeline.total;
  return [...marks].reverse().find((m) => m < time - eps) ?? 0;
}

export { opMatrix };
