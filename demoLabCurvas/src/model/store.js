import { isCatmullRom, makeId } from './defaults.js';
import { evaluate, elevateDegree, split } from '../math/bezier.js';
import { catmullRomToBezier, knotIntervals, phantomPoint } from '../math/catmullRom.js';

const clone = (value) => structuredClone(value);

export function createStore(initial) {
  let scene = clone(initial); let revision = 0; let dirty = false;
  const undo = []; const redo = []; const listeners = new Set();
  const emit = (reason = 'update') => listeners.forEach((fn) => fn(scene, { revision, dirty, reason, canUndo: undo.length > 0, canRedo: redo.length > 0 }));
  const transact = (label, mutator) => {
    const before = clone(scene); mutator(scene); undo.push({ label, scene: before }); if (undo.length > 120) undo.shift(); redo.length = 0; revision += 1; dirty = true; emit(label);
  };
  return {
    get: () => scene,
    status: () => ({ revision, dirty, canUndo: undo.length > 0, canRedo: redo.length > 0 }),
    subscribe(fn) { listeners.add(fn); fn(scene, { revision, dirty, reason: 'initial', canUndo: false, canRedo: false }); return () => listeners.delete(fn); },
    notify: emit,
    transact,
    replace(next, reason = 'Abrir escena') { scene = clone(next); revision += 1; dirty = false; undo.length = 0; redo.length = 0; emit(reason); },
    markSaved() { dirty = false; emit('saved'); },
    undo() { if (!undo.length) return; const entry = undo.pop(); redo.push({ label: entry.label, scene: clone(scene) }); scene = entry.scene; revision += 1; dirty = true; emit(`Deshacer: ${entry.label}`); },
    redo() { if (!redo.length) return; const entry = redo.pop(); undo.push({ label: entry.label, scene: clone(scene) }); scene = entry.scene; revision += 1; dirty = true; emit(`Rehacer: ${entry.label}`); },
  };
}

export const pointMap = (scene) => new Map(scene.geometry.points.map((p) => [p.id, p]));
export const segmentMap = (scene) => new Map(scene.geometry.segments.map((s) => [s.id, s]));
export const pointsFor = (scene, segment) => { const map = pointMap(scene); return segment.pointIds.map((id) => map.get(id)); };
/** Controles de Bézier que definen la geometría: los propios o la cúbica equivalente de un tramo Catmull-Rom. */
export const curveControlsFor = (scene, segment) => (isCatmullRom(segment) ? catmullRomToBezier(pointsFor(scene, segment), segment.params) : pointsFor(scene, segment));
export const endPointId = (segment) => (isCatmullRom(segment) ? segment.pointIds[2] : segment.pointIds.at(-1));
export const selectedSegment = (scene) => scene.geometry.segments.find((s) => s.id === scene.presentation.selection.segmentId) || null;
export const activeChain = (scene) => scene.geometry.chains.find((c) => c.id === scene.presentation.selection.chainId) || scene.geometry.chains[0];

export function dependentPointIds(scene) {
  const segments = segmentMap(scene); const ids = new Set();
  for (const constraint of scene.geometry.constraints.filter((c) => c.enabled)) {
    const right = segments.get(constraint.rightSegmentId); if (!right || isCatmullRom(right) || isCatmullRom(segments.get(constraint.leftSegmentId))) continue;
    ids.add(right.pointIds[0]);
    if (['G1', 'C1', 'C2'].includes(constraint.type)) ids.add(right.pointIds[1]);
    if (constraint.type === 'C2') ids.add(right.pointIds[2]);
  }
  return ids;
}

export function applyConstraints(scene) {
  const segments = segmentMap(scene); const points = pointMap(scene);
  for (const chain of scene.geometry.chains) for (let i = 0; i < chain.segmentIds.length - 1; i += 1) {
    const left = segments.get(chain.segmentIds[i]); const right = segments.get(chain.segmentIds[i + 1]);
    const constraint = scene.geometry.constraints.find((c) => c.enabled && c.leftSegmentId === left?.id && c.rightSegmentId === right?.id);
    if (!constraint || left.degree !== 3 || right.degree !== 3 || isCatmullRom(left) || isCatmullRom(right)) continue;
    const A = left.pointIds.map((id) => points.get(id)); const B = right.pointIds.map((id) => points.get(id)); Object.assign(B[0], A[3]);
    const tangent = { x: A[3].x - A[2].x, y: A[3].y - A[2].y }; const tangentLength = Math.hypot(tangent.x, tangent.y); constraint.suspended = false;
    if (constraint.type === 'G1') { if (tangentLength <= 1e-12) { constraint.suspended = true; continue; } const target = constraint.g1HandleLength; B[1].x = B[0].x + tangent.x / tangentLength * target; B[1].y = B[0].y + tangent.y / tangentLength * target; }
    if (['C1', 'C2'].includes(constraint.type)) { const ratio = right.duration / left.duration; B[1].x = B[0].x + tangent.x * ratio; B[1].y = B[0].y + tangent.y * ratio; }
    if (constraint.type === 'C2') { const second = { x: 6 * (A[3].x - 2 * A[2].x + A[1].x) / left.duration ** 2, y: 6 * (A[3].y - 2 * A[2].y + A[1].y) / left.duration ** 2 }; const factor = right.duration ** 2 / 6; B[2].x = 2 * B[1].x - B[0].x + factor * second.x; B[2].y = 2 * B[1].y - B[0].y + factor * second.y; }
  }
}

export function addDraftPoint(scene, position) {
  const settings = scene.presentation.settings; const chain = activeChain(scene);
  const type = settings.creationCurveType === 'catmullRom' ? 'catmullRom' : 'bezier'; const degree = type === 'catmullRom' ? 3 : settings.creationDegree;
  let draft = scene.geometry.drafts.find((d) => d.chainId === chain.id && (d.type || 'bezier') === type && d.degree === degree && d.creationMode === settings.creationMode && d.active !== false);
  if (!draft) {
    const seed = settings.creationMode === 'chained' && chain.segmentIds.length ? scene.geometry.segments.find((s) => s.id === chain.segmentIds.at(-1)) : null;
    // Un tramo Catmull-Rom encadenado reutiliza los tres últimos puntos: cada clic agrega un tramo.
    const seedIds = !seed ? [] : type === 'catmullRom' ? (isCatmullRom(seed) ? seed.pointIds.slice(1) : seed.pointIds.slice(-2)) : [endPointId(seed)];
    draft = { id: makeId('draft'), chainId: chain.id, type, degree, creationMode: settings.creationMode, pointIds: seedIds, seedSegmentId: seed?.id || null, orderIndex: chain.segmentIds.length, active: true };
    scene.geometry.drafts.push(draft);
  }
  const p = { id: makeId('point'), x: position.x, y: position.y }; scene.geometry.points.push(p); draft.pointIds.push(p.id);
  if (draft.pointIds.length === draft.degree + 1) {
    const segment = { id: makeId('segment'), name: segmentName(scene), degree: draft.degree, pointIds: [...draft.pointIds], duration: 1, sampling: null, style: null, visible: true };
    if (type === 'catmullRom') Object.assign(segment, { type, params: { alpha: settings.creationAlpha, tension: settings.creationTension } });
    scene.geometry.segments.push(segment); chain.segmentIds.splice(draft.orderIndex, 0, segment.id); scene.geometry.drafts = scene.geometry.drafts.filter((d) => d.id !== draft.id);
    scene.presentation.selection = { segmentId: segment.id, pointIds: [], chainId: chain.id }; scene.presentation.playhead.segmentId = segment.id; scene.presentation.playhead.chainId = chain.id;
  }
}

export function deleteSelection(scene) {
  const selected = new Set(scene.presentation.selection.pointIds);
  if (!selected.size && scene.presentation.selection.segmentId) {
    const id = scene.presentation.selection.segmentId;
    scene.geometry.segments = scene.geometry.segments.filter((s) => s.id !== id); scene.geometry.chains.forEach((c) => { c.segmentIds = c.segmentIds.filter((x) => x !== id); });
    scene.presentation.probes = scene.presentation.probes.filter((p) => p.segmentId !== id); scene.geometry.constraints = scene.geometry.constraints.filter((c) => c.leftSegmentId !== id && c.rightSegmentId !== id); scene.presentation.selection.segmentId = null;
  } else if (selected.size) {
    // En Catmull-Rom se quita el punto de la secuencia y se regeneran los tramos vecinos.
    for (const chain of scene.geometry.chains) for (const run of crRuns(scene, chain).reverse()) {
      if (!run.sequence.some((id) => selected.has(id))) continue;
      const closed = isClosedSequence(run.sequence); const base = (closed ? run.sequence.slice(0, -3) : run.sequence).filter((id) => !selected.has(id));
      rebuildRun(scene, chain, run, closed && base.length >= 3 ? [...base, ...base.slice(0, 3)] : base);
    }
    const affected = scene.geometry.segments.filter((s) => !isCatmullRom(s) && s.pointIds.some((id) => selected.has(id)));
    for (const segment of affected) {
      const chain = scene.geometry.chains.find((c) => c.segmentIds.includes(segment.id)); const orderIndex = chain.segmentIds.indexOf(segment.id);
      scene.geometry.drafts.push({ id: makeId('draft'), chainId: chain.id, degree: segment.degree, creationMode: 'independent', pointIds: segment.pointIds.filter((id) => !selected.has(id)), seedSegmentId: null, orderIndex, active: false });
      chain.segmentIds = chain.segmentIds.filter((id) => id !== segment.id); scene.geometry.segments = scene.geometry.segments.filter((s) => s.id !== segment.id);
    }
    scene.geometry.points = scene.geometry.points.filter((p) => !selected.has(p.id)); scene.presentation.selection.pointIds = []; scene.presentation.selection.segmentId = null;
  }
  prunePoints(scene);
}

export function prunePoints(scene) {
  const used = new Set([...scene.geometry.segments.flatMap((s) => s.pointIds), ...scene.geometry.drafts.flatMap((d) => d.pointIds)]); scene.geometry.points = scene.geometry.points.filter((p) => used.has(p.id));
}

function segmentName(scene, taken = new Set()) {
  const names = new Set([...scene.geometry.segments.map((s) => s.name), ...taken]); let n = scene.geometry.segments.length;
  while (names.has(`S${n}`)) n += 1; return `S${n}`;
}

const sameIds = (a, b) => a.length === b.length && a.every((id, i) => id === b[i]);
export const isClosedSequence = (sequence) => sequence.length >= 6 && sameIds(sequence.slice(0, 3), sequence.slice(-3));

/** Tramos Catmull-Rom consecutivos de una cadena que comparten tres puntos, con su secuencia de puntos. */
export function crRuns(scene, chain) {
  const sm = segmentMap(scene); const runs = []; let current = null;
  chain.segmentIds.forEach((id, index) => {
    const segment = sm.get(id);
    if (!isCatmullRom(segment)) { current = null; return; }
    const previous = current?.segments.at(-1);
    if (previous && sameIds(previous.pointIds.slice(1), segment.pointIds.slice(0, 3))) { current.segments.push(segment); current.sequence.push(segment.pointIds[3]); return; }
    current = { chain, start: index, segments: [segment], sequence: [...segment.pointIds] }; runs.push(current);
  });
  return runs;
}

export function runOfSegment(scene, segmentId) {
  for (const chain of scene.geometry.chains) { const run = crRuns(scene, chain).find((r) => r.segments.some((s) => s.id === segmentId)); if (run) return run; }
  return null;
}

/** Regenera los tramos de una secuencia Catmull-Rom; conserva IDs, nombres, parámetros y estilo cuando puede. */
export function rebuildRun(scene, chain, run, sequence) {
  const template = run.segments.at(-1); const count = sequence.length - 3; const taken = new Set(); const removed = new Set(run.segments.map((s) => s.id));
  const next = [];
  if (count < 1) {
    if (sequence.length) scene.geometry.drafts.push({ id: makeId('draft'), chainId: chain.id, type: 'catmullRom', degree: 3, creationMode: 'independent', pointIds: [...sequence], seedSegmentId: null, orderIndex: run.start, active: false });
  } else for (let i = 0; i < count; i += 1) {
    const reuse = run.segments[i];
    const segment = reuse || { ...structuredClone(template), id: makeId('segment'), name: segmentName(scene, taken) };
    segment.pointIds = sequence.slice(i, i + 4); taken.add(segment.name); removed.delete(segment.id); next.push(segment);
  }
  const anchor = scene.geometry.segments.indexOf(run.segments[0]);
  scene.geometry.segments = scene.geometry.segments.filter((s) => !run.segments.includes(s));
  scene.geometry.segments.splice(Math.max(0, Math.min(anchor, scene.geometry.segments.length)), 0, ...next);
  chain.segmentIds.splice(run.start, run.segments.length, ...next.map((s) => s.id));
  scene.presentation.probes = scene.presentation.probes.filter((p) => !removed.has(p.segmentId));
  scene.geometry.constraints = scene.geometry.constraints.filter((c) => !removed.has(c.leftSegmentId) && !removed.has(c.rightSegmentId));
  const fallback = next[0]?.id || null;
  if (removed.has(scene.presentation.selection.segmentId)) scene.presentation.selection.segmentId = fallback;
  if (removed.has(scene.presentation.playhead.segmentId)) scene.presentation.playhead.segmentId = fallback;
  if (removed.has(scene.presentation.isolationSegmentId)) scene.presentation.isolationSegmentId = null;
  prunePoints(scene);
  return next;
}

const selectedRun = (scene) => { const segment = selectedSegment(scene); return isCatmullRom(segment) ? { segment, run: runOfSegment(scene, segment.id) } : null; };
const focus = (scene, segment, u) => { scene.presentation.selection.segmentId = segment.id; scene.presentation.selection.pointIds = []; scene.presentation.playhead.segmentId = segment.id; if (u !== undefined) scene.presentation.playhead.u = u; };

/** Inserta un punto de interpolación en C(u): a diferencia de dividir una Bézier, cambia la forma localmente. */
export function insertCatmullRomPoint(scene) {
  const found = selectedRun(scene); if (!found) return false; const { segment, run } = found; const u = scene.presentation.playhead.u;
  if (u < 1e-4 || u > 1 - 1e-4) return false;
  const position = evaluate(curveControlsFor(scene, segment), u); const p = { id: makeId('point'), x: position.x, y: position.y }; scene.geometry.points.push(p);
  const k = run.segments.indexOf(segment); let sequence;
  if (isClosedSequence(run.sequence)) { const base = run.sequence.slice(0, -3); const at = (k + 2) % base.length; base.splice(at === 0 ? base.length : at, 0, p.id); sequence = [...base, ...base.slice(0, 3)]; }
  else { sequence = [...run.sequence]; sequence.splice(k + 2, 0, p.id); }
  const next = rebuildRun(scene, run.chain, run, sequence); focus(scene, next[k], 1); return true;
}

export function toggleClosedSelected(scene) {
  const found = selectedRun(scene); if (!found) return false; const { run } = found;
  if (isClosedSequence(run.sequence)) { if (run.sequence.length - 3 < 4) return false; focus(scene, rebuildRun(scene, run.chain, run, run.sequence.slice(0, -3))[0]); return true; }
  const next = rebuildRun(scene, run.chain, run, [...run.sequence, ...run.sequence.slice(0, 3)]); focus(scene, next[0]); return true;
}

/** Agrega un punto antes del primero y otro después del último (duplicado o reflejado) para interpolar los extremos. */
export function extendEndsSelected(scene, mode = 'reflect') {
  const found = selectedRun(scene); if (!found || isClosedSequence(found.run.sequence)) return false; const { run } = found; const pm = pointMap(scene); const seq = run.sequence;
  const endId = (end, neighbor) => { if (mode === 'duplicate') return end; const q = { id: makeId('point'), ...phantomPoint(pm.get(end), pm.get(neighbor), mode) }; scene.geometry.points.push(q); return q.id; };
  const next = rebuildRun(scene, run.chain, run, [endId(seq[0], seq[1]), ...seq, endId(seq.at(-1), seq.at(-2))]); focus(scene, next[0]); return true;
}

export function convertSelectedToBezier(scene) {
  const segment = selectedSegment(scene); if (!isCatmullRom(segment)) return false;
  const controls = curveControlsFor(scene, segment); const inner = controls.slice(1, 3).map((c) => { const q = { id: makeId('point'), x: c.x, y: c.y }; scene.geometry.points.push(q); return q.id; });
  segment.pointIds = [segment.pointIds[1], ...inner, segment.pointIds[2]]; segment.type = 'bezier'; delete segment.params; prunePoints(scene); return true;
}

export function applyParamsToChain(scene) {
  const segment = selectedSegment(scene); if (!isCatmullRom(segment)) return false; const chain = scene.geometry.chains.find((c) => c.segmentIds.includes(segment.id));
  scene.geometry.segments.filter((s) => isCatmullRom(s) && chain.segmentIds.includes(s.id)).forEach((s) => { s.params = { ...segment.params }; }); return true;
}

/** Duración de cada tramo = intervalo nodal |P2-P1|^α: con eso la parametrización global es C1. */
export function durationsFromKnots(scene) {
  const segment = selectedSegment(scene); const chain = segment && scene.geometry.chains.find((c) => c.segmentIds.includes(segment.id)); if (!chain) return false;
  scene.geometry.segments.filter((s) => isCatmullRom(s) && chain.segmentIds.includes(s.id)).forEach((s) => { s.duration = Math.max(1e-6, Math.min(1e6, knotIntervals(pointsFor(scene, s), s.params.alpha)[1])); }); return true;
}

export function matchParams(scene, leftId, rightId) {
  const sm = segmentMap(scene); const left = sm.get(leftId), right = sm.get(rightId); if (!isCatmullRom(left) || !isCatmullRom(right)) return false; right.params = { ...left.params }; return true;
}

/** Hace que el tramo derecho comparta los tres últimos puntos del izquierdo (continuidad estructural). */
export function linkCatmullRom(scene, leftId, rightId) {
  const sm = segmentMap(scene); const left = sm.get(leftId), right = sm.get(rightId); if (!isCatmullRom(left) || !isCatmullRom(right)) return false;
  right.pointIds = [...left.pointIds.slice(1), right.pointIds[3]]; prunePoints(scene); return true;
}

export function splitSelected(scene) {
  const segment = selectedSegment(scene); const u = scene.presentation.playhead.u;
  if (!segment || isCatmullRom(segment) || u < 1e-4 || u > 1 - 1e-4) return false;
  const chain = scene.geometry.chains.find((c) => c.segmentIds.includes(segment.id)); const index = chain.segmentIds.indexOf(segment.id);
  const original = pointsFor(scene, segment); const halves = split(original, u); const center = { id: makeId('point'), ...halves.left.at(-1) };
  const makeControls = (controls, left) => controls.map((p, i) => {
    if (left && i === 0) return segment.pointIds[0]; if (!left && i === controls.length - 1) return segment.pointIds.at(-1); if ((left && i === controls.length - 1) || (!left && i === 0)) return center.id;
    const q = { id: makeId('point'), ...p }; scene.geometry.points.push(q); return q.id;
  });
  scene.geometry.points.push(center);
  const a = { ...segment, id: makeId('segment'), name: `${segment.name}a`, pointIds: makeControls(halves.left, true), duration: segment.duration * u };
  const b = { ...segment, id: makeId('segment'), name: `${segment.name}b`, pointIds: makeControls(halves.right, false), duration: segment.duration * (1 - u) };
  scene.geometry.segments.splice(scene.geometry.segments.indexOf(segment), 1, a, b); chain.segmentIds.splice(index, 1, a.id, b.id);
  scene.presentation.probes.forEach((probe) => { if (probe.segmentId !== segment.id) return; if (probe.u <= u) { probe.segmentId = a.id; probe.u /= u; } else { probe.segmentId = b.id; probe.u = (probe.u - u) / (1 - u); } });
  scene.geometry.constraints = scene.geometry.constraints.filter((c) => c.leftSegmentId !== segment.id && c.rightSegmentId !== segment.id); scene.presentation.selection.segmentId = a.id; scene.presentation.playhead.segmentId = a.id; scene.presentation.playhead.u = 1;
  return true;
}

export function elevateSelected(scene) {
  const segment = selectedSegment(scene); if (!segment || isCatmullRom(segment) || segment.degree >= 3) return false;
  const elevated = elevateDegree(pointsFor(scene, segment)); const endpointIds = [segment.pointIds[0], segment.pointIds.at(-1)];
  const innerIds = elevated.slice(1, -1).map((p) => { const q = { id: makeId('point'), ...p }; scene.geometry.points.push(q); return q.id; });
  segment.degree += 1; segment.pointIds = [endpointIds[0], ...innerIds, endpointIds[1]]; return true;
}

export function freezeSelected(scene) {
  const segment = selectedSegment(scene); if (!segment || scene.presentation.references.length >= 8) return false;
  scene.presentation.references.push({ id: makeId('reference'), name: `${segment.name} · referencia`, color: '#64748b', opacity: .45, visible: true, segments: [{ degree: segment.degree, points: curveControlsFor(scene, segment).map(({ x, y }) => ({ x, y })) }] }); return true;
}

export function fitBounds(scene) {
  const ids = scene.presentation.selection.pointIds;
  const points = ids.length ? scene.geometry.points.filter((p) => ids.includes(p.id)) : scene.geometry.points;
  if (!points.length) return null;
  return { minX: Math.min(...points.map((p) => p.x)), maxX: Math.max(...points.map((p) => p.x)), minY: Math.min(...points.map((p) => p.y)), maxY: Math.max(...points.map((p) => p.y)) };
}
