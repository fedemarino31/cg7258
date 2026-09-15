import { makeId } from './defaults.js';
import { evaluate, elevateDegree, split } from '../math/bezier.js';

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
export const selectedSegment = (scene) => scene.geometry.segments.find((s) => s.id === scene.presentation.selection.segmentId) || null;
export const activeChain = (scene) => scene.geometry.chains.find((c) => c.id === scene.presentation.selection.chainId) || scene.geometry.chains[0];

export function dependentPointIds(scene) {
  const segments = segmentMap(scene); const ids = new Set();
  for (const constraint of scene.geometry.constraints.filter((c) => c.enabled)) {
    const right = segments.get(constraint.rightSegmentId); if (!right) continue;
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
    if (!constraint || left.degree !== 3 || right.degree !== 3) continue;
    const A = left.pointIds.map((id) => points.get(id)); const B = right.pointIds.map((id) => points.get(id)); Object.assign(B[0], A[3]);
    const tangent = { x: A[3].x - A[2].x, y: A[3].y - A[2].y }; const tangentLength = Math.hypot(tangent.x, tangent.y); constraint.suspended = false;
    if (constraint.type === 'G1') { if (tangentLength <= 1e-12) { constraint.suspended = true; continue; } const target = constraint.g1HandleLength; B[1].x = B[0].x + tangent.x / tangentLength * target; B[1].y = B[0].y + tangent.y / tangentLength * target; }
    if (['C1', 'C2'].includes(constraint.type)) { const ratio = right.duration / left.duration; B[1].x = B[0].x + tangent.x * ratio; B[1].y = B[0].y + tangent.y * ratio; }
    if (constraint.type === 'C2') { const second = { x: 6 * (A[3].x - 2 * A[2].x + A[1].x) / left.duration ** 2, y: 6 * (A[3].y - 2 * A[2].y + A[1].y) / left.duration ** 2 }; const factor = right.duration ** 2 / 6; B[2].x = 2 * B[1].x - B[0].x + factor * second.x; B[2].y = 2 * B[1].y - B[0].y + factor * second.y; }
  }
}

export function addDraftPoint(scene, position) {
  const settings = scene.presentation.settings; const chain = activeChain(scene);
  let draft = scene.geometry.drafts.find((d) => d.chainId === chain.id && d.degree === settings.creationDegree && d.creationMode === settings.creationMode && d.active !== false);
  if (!draft) {
    const seed = settings.creationMode === 'chained' && chain.segmentIds.length ? scene.geometry.segments.find((s) => s.id === chain.segmentIds.at(-1)) : null;
    draft = { id: makeId('draft'), chainId: chain.id, degree: settings.creationDegree, creationMode: settings.creationMode, pointIds: seed ? [seed.pointIds.at(-1)] : [], seedSegmentId: seed?.id || null, orderIndex: chain.segmentIds.length, active: true };
    scene.geometry.drafts.push(draft);
  }
  const p = { id: makeId('point'), x: position.x, y: position.y }; scene.geometry.points.push(p); draft.pointIds.push(p.id);
  if (draft.pointIds.length === draft.degree + 1) {
    const segment = { id: makeId('segment'), name: `S${scene.geometry.segments.length}`, degree: draft.degree, pointIds: [...draft.pointIds], duration: 1, sampling: null, style: null, visible: true };
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
    const affected = scene.geometry.segments.filter((s) => s.pointIds.some((id) => selected.has(id)));
    for (const segment of affected) {
      const chain = scene.geometry.chains.find((c) => c.segmentIds.includes(segment.id)); const orderIndex = chain.segmentIds.indexOf(segment.id);
      scene.geometry.drafts.push({ id: makeId('draft'), chainId: chain.id, degree: segment.degree, creationMode: 'independent', pointIds: segment.pointIds.filter((id) => !selected.has(id)), seedSegmentId: null, orderIndex, active: false });
      chain.segmentIds = chain.segmentIds.filter((id) => id !== segment.id); scene.geometry.segments = scene.geometry.segments.filter((s) => s.id !== segment.id);
    }
    scene.geometry.points = scene.geometry.points.filter((p) => !selected.has(p.id)); scene.presentation.selection.pointIds = []; scene.presentation.selection.segmentId = null;
  }
  const used = new Set([...scene.geometry.segments.flatMap((s) => s.pointIds), ...scene.geometry.drafts.flatMap((d) => d.pointIds)]); scene.geometry.points = scene.geometry.points.filter((p) => used.has(p.id));
}

export function splitSelected(scene) {
  const segment = selectedSegment(scene); const u = scene.presentation.playhead.u;
  if (!segment || u < 1e-4 || u > 1 - 1e-4) return false;
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
  const segment = selectedSegment(scene); if (!segment || segment.degree >= 3) return false;
  const elevated = elevateDegree(pointsFor(scene, segment)); const endpointIds = [segment.pointIds[0], segment.pointIds.at(-1)];
  const innerIds = elevated.slice(1, -1).map((p) => { const q = { id: makeId('point'), ...p }; scene.geometry.points.push(q); return q.id; });
  segment.degree += 1; segment.pointIds = [endpointIds[0], ...innerIds, endpointIds[1]]; return true;
}

export function freezeSelected(scene) {
  const segment = selectedSegment(scene); if (!segment || scene.presentation.references.length >= 8) return false;
  scene.presentation.references.push({ id: makeId('reference'), name: `${segment.name} · referencia`, color: '#64748b', opacity: .45, visible: true, segments: [{ degree: segment.degree, points: pointsFor(scene, segment).map(({ x, y }) => ({ x, y })) }] }); return true;
}

export function fitBounds(scene) {
  const ids = scene.presentation.selection.pointIds;
  const points = ids.length ? scene.geometry.points.filter((p) => ids.includes(p.id)) : scene.geometry.points;
  if (!points.length) return null;
  return { minX: Math.min(...points.map((p) => p.x)), maxX: Math.max(...points.map((p) => p.x)), minY: Math.min(...points.map((p) => p.y)), maxY: Math.max(...points.map((p) => p.y)) };
}
