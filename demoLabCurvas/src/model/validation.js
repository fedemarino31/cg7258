import { hydrateScene } from './defaults.js';

export function validateScene(input) {
  const fail = (path, message) => { throw new Error(`${path}: ${message}`); };
  if (!input || typeof input !== 'object') fail('$', 'se esperaba un objeto');
  if (input.format !== 'bezier-lab-scene') fail('$.format', 'formato desconocido');
  if (input.version !== 1) fail('$.version', input.version > 1 ? 'versión futura no compatible' : 'versión inválida');
  const scene = hydrateScene(structuredClone(input)); const g = scene.geometry;
  if (!Array.isArray(g.points) || g.points.length > 5000) fail('$.geometry.points', 'cantidad inválida');
  if (!Array.isArray(g.segments) || g.segments.length > 1000) fail('$.geometry.segments', 'cantidad inválida');
  const ids = new Set();
  for (const [i, p] of g.points.entries()) {
    if (!p.id || ids.has(p.id)) fail(`$.geometry.points[${i}].id`, 'ID ausente o duplicado');
    ids.add(p.id);
    if (![p.x, p.y].every((v) => Number.isFinite(v) && Math.abs(v) <= 1e9)) fail(`$.geometry.points[${i}]`, 'coordenadas inválidas');
  }
  const segmentIds = new Set();
  for (const [i, s] of g.segments.entries()) {
    if (!s.id || segmentIds.has(s.id)) fail(`$.geometry.segments[${i}].id`, 'ID ausente o duplicado'); segmentIds.add(s.id);
    if (![1, 2, 3].includes(s.degree)) fail(`$.geometry.segments[${i}].degree`, 'debe ser 1, 2 o 3');
    if (!Array.isArray(s.pointIds) || s.pointIds.length !== s.degree + 1 || s.pointIds.some((id) => !ids.has(id))) fail(`$.geometry.segments[${i}].pointIds`, 'referencias inválidas');
    if (!(s.duration >= 1e-6 && s.duration <= 1e6)) fail(`$.geometry.segments[${i}].duration`, 'fuera de rango');
  }
  const membership = new Map();
  for (const [i, c] of g.chains.entries()) for (const id of c.segmentIds) { if (!segmentIds.has(id)) fail(`$.geometry.chains[${i}].segmentIds`, `no existe ${id}`); if (membership.has(id)) fail(`$.geometry.chains[${i}]`, `el tramo ${id} pertenece a más de una cadena`); membership.set(id, c.id); }
  if (membership.size !== g.segments.length) fail('$.geometry.chains', 'cada tramo debe pertenecer a una cadena');
  const segmentMap = new Map(g.segments.map((s) => [s.id, s]));
  for (const [i, constraint] of g.constraints.entries()) {
    if (!['C0', 'G1', 'C1', 'C2'].includes(constraint.type)) fail(`$.geometry.constraints[${i}].type`, 'tipo inválido');
    const left = segmentMap.get(constraint.leftSegmentId); const right = segmentMap.get(constraint.rightSegmentId);
    if (!left || !right) fail(`$.geometry.constraints[${i}]`, 'tramo inexistente');
    const adjacent = g.chains.some((chain) => chain.segmentIds.some((id, index) => id === left.id && chain.segmentIds[index + 1] === right.id));
    if (!adjacent) fail(`$.geometry.constraints[${i}]`, 'los tramos no son adyacentes');
    if (constraint.enabled && (left.degree !== 3 || right.degree !== 3)) fail(`$.geometry.constraints[${i}]`, 'un bloqueo habilitado requiere dos cúbicas');
    if (constraint.type === 'G1' && (!(constraint.g1HandleLength > 0) || !Number.isFinite(constraint.g1HandleLength))) fail(`$.geometry.constraints[${i}].g1HandleLength`, 'debe ser positivo');
  }
  return scene;
}
