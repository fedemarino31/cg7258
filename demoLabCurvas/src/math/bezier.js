const EPSILON = 1e-12;

const point = (x, y) => ({ x, y });
const add = (a, b) => point(a.x + b.x, a.y + b.y);
const sub = (a, b) => point(a.x - b.x, a.y - b.y);
const scale = (a, k) => point(a.x * k, a.y * k);
const length = (a) => Math.hypot(a.x, a.y);
const distance = (a, b) => length(sub(a, b));
const lerp = (a, b, t) => point(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);

export { add, sub, scale, length, distance, lerp };

export function bernstein(degree, u) {
  if (!Number.isInteger(degree) || degree < 0 || degree > 3) throw new RangeError('El grado debe estar entre 0 y 3');
  if (u === 0) return Array.from({ length: degree + 1 }, (_, i) => (i === 0 ? 1 : 0));
  if (u === 1) return Array.from({ length: degree + 1 }, (_, i) => (i === degree ? 1 : 0));
  const choose = [[1], [1, 1], [1, 2, 1], [1, 3, 3, 1]][degree];
  return choose.map((c, i) => c * (1 - u) ** (degree - i) * u ** i);
}

export function evaluate(points, u) {
  if (!points.length) throw new RangeError('Se requiere al menos un punto');
  if (u === 0) return point(points[0].x, points[0].y);
  if (u === 1) return point(points.at(-1).x, points.at(-1).y);
  const weights = bernstein(points.length - 1, u);
  return points.reduce((r, p, i) => add(r, scale(p, weights[i])), point(0, 0));
}

export function casteljauLevels(points, u) {
  const levels = [points.map((p) => point(p.x, p.y))];
  while (levels.at(-1).length > 1) {
    const previous = levels.at(-1);
    levels.push(previous.slice(0, -1).map((p, i) => lerp(p, previous[i + 1], u)));
  }
  return levels;
}

export function derivative(points, u, order = 1) {
  if (![1, 2].includes(order)) throw new RangeError('El orden debe ser 1 o 2');
  let controls = points.map((p) => point(p.x, p.y));
  let degree = controls.length - 1;
  for (let k = 0; k < order; k += 1) {
    if (degree <= 0) return point(0, 0);
    controls = controls.slice(0, -1).map((p, i) => scale(sub(controls[i + 1], p), degree));
    degree -= 1;
  }
  return controls.length === 1 ? controls[0] : evaluate(controls, u);
}

export function powerCoefficients(points) {
  const p = points;
  if (p.length === 2) return [sub(p[1], p[0]), point(p[0].x, p[0].y)];
  if (p.length === 3) return [add(sub(p[0], scale(p[1], 2)), p[2]), scale(sub(p[1], p[0]), 2), point(p[0].x, p[0].y)];
  if (p.length === 4) return [add(add(scale(p[0], -1), scale(p[1], 3)), add(scale(p[2], -3), p[3])), add(add(scale(p[0], 3), scale(p[1], -6)), scale(p[2], 3)), scale(sub(p[1], p[0]), 3), point(p[0].x, p[0].y)];
  throw new RangeError('Solo se admiten grados 1 a 3');
}

export function split(points, u) {
  const levels = casteljauLevels(points, u);
  return {
    left: levels.map((level) => level[0]),
    right: levels.map((level) => level.at(-1)).reverse(),
  };
}

export function elevateDegree(points) {
  const n = points.length - 1;
  if (n < 1 || n >= 3) throw new RangeError('Solo se puede elevar de grado 1 a 2 o de 2 a 3');
  return [points[0], ...Array.from({ length: n }, (_, j) => {
    const i = j + 1;
    return add(scale(points[i - 1], i / (n + 1)), scale(points[i], 1 - i / (n + 1)));
  }), points.at(-1)].map((p) => point(p.x, p.y));
}

export function controlBounds(points) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

export function curvatureFrame(points, u, tolerance = {}) {
  const absTol = tolerance.absTol ?? 1e-9;
  const relTol = tolerance.relTol ?? 1e-7;
  const bounds = controlBounds(points);
  const size = Math.max(1, Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY));
  const position = evaluate(points, u);
  const first = derivative(points, u, 1);
  const second = derivative(points, u, 2);
  const speed = length(first);
  const zero = absTol + relTol * size;
  if (speed <= zero) return { position, first, second, speed, defined: false, reason: 'Velocidad casi nula' };
  const tangent = scale(first, 1 / speed);
  const leftNormal = point(-tangent.y, tangent.x);
  const signedCurvature = (first.x * second.y - first.y * second.x) / speed ** 3;
  const flat = Math.abs(signedCurvature) * size <= relTol;
  if (flat) return { position, first, second, speed, tangent, leftNormal, signedCurvature, curvature: 0, radius: Infinity, defined: true, normalDefined: false };
  const normal = scale(leftNormal, Math.sign(signedCurvature));
  const radius = 1 / Math.abs(signedCurvature);
  const center = add(position, scale(leftNormal, 1 / signedCurvature));
  return { position, first, second, speed, tangent, leftNormal, normal, signedCurvature, curvature: Math.abs(signedCurvature), radius, center, defined: true, normalDefined: true };
}

function bboxScale(points) {
  const b = controlBounds(points);
  return Math.max(1, Math.hypot(b.maxX - b.minX, b.maxY - b.minY));
}

export function analyzeJoin(left, right, mode = 'global', tolerance = {}) {
  const absTol = tolerance.absTol ?? 1e-9;
  const relTol = tolerance.relTol ?? 1e-7;
  const angleTol = ((tolerance.angleDeg ?? 0.01) * Math.PI) / 180;
  const lp = left.points;
  const rp = right.points;
  const size = Math.max(1, bboxScale([...lp, ...rp]));
  const pA = evaluate(lp, 1);
  const pB = evaluate(rp, 0);
  const separation = distance(pA, pB);
  const epsPos = absTol + relTol * size;
  const factorA = mode === 'global' ? 1 / left.duration : 1;
  const factorB = mode === 'global' ? 1 / right.duration : 1;
  const vA = scale(derivative(lp, 1, 1), factorA);
  const vB = scale(derivative(rp, 0, 1), factorB);
  const aA = scale(derivative(lp, 1, 2), factorA ** 2);
  const aB = scale(derivative(rp, 0, 2), factorB ** 2);
  const c0 = separation <= epsPos;
  const epsDer = absTol + relTol * Math.max(1, size, length(vA), length(vB));
  const c1 = c0 && distance(vA, vB) <= epsDer;
  const c2 = c1 && distance(aA, aB) <= absTol + relTol * Math.max(1, size, length(aA), length(aB));
  const zero = absTol + relTol * size;
  let g1 = false;
  let angle = null;
  if (c0 && length(vA) > zero && length(vB) > zero) {
    const cosine = Math.max(-1, Math.min(1, (vA.x * vB.x + vA.y * vB.y) / (length(vA) * length(vB))));
    angle = Math.acos(cosine);
    g1 = cosine > 0 && angle <= angleTol;
  }
  return { c0, g1: angle === null && c0 ? null : g1, c1, c2, separation, angle, pA, pB, vA, vB, aA, aB, epsPos, epsDer };
}

export function convexHull(points) {
  const unique = [...new Map(points.map((p) => [`${p.x},${p.y}`, point(p.x, p.y)])).values()];
  if (unique.length <= 2) return unique;
  unique.sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  for (const p of unique) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop(); lower.push(p); }
  const upper = [];
  for (const p of [...unique].reverse()) { while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop(); upper.push(p); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

export function sampleUniform(points, subdivisions) {
  return Array.from({ length: subdivisions + 1 }, (_, i) => ({ u: i / subdivisions, ...evaluate(points, i / subdivisions) }));
}

export function arcLengthTable(points, tolerance = 1e-5, maxLeaves = 16384) {
  const result = [{ u: 0, ...points[0], s: 0 }];
  let leaves = 0;
  function walk(control, u0, u1, depth) {
    const chord = distance(control[0], control.at(-1));
    const polygon = control.slice(1).reduce((sum, p, i) => sum + distance(control[i], p), 0);
    if (depth >= 20 || leaves >= maxLeaves || polygon - chord <= tolerance) {
      leaves += 1;
      const last = result.at(-1);
      const end = control.at(-1);
      result.push({ u: u1, x: end.x, y: end.y, s: last.s + chord });
      return;
    }
    const halves = split(control, 0.5);
    const mid = (u0 + u1) / 2;
    walk(halves.left, u0, mid, depth + 1);
    walk(halves.right, mid, u1, depth + 1);
  }
  walk(points, 0, 1, 0);
  return { samples: result, length: result.at(-1).s, limited: leaves >= maxLeaves };
}

export function uAtLength(table, target) {
  if (table.length < 2 || target <= 0) return 0;
  if (target >= table.at(-1).s) return 1;
  let lo = 0; let hi = table.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (table[mid].s < target) lo = mid; else hi = mid; }
  const a = table[lo]; const b = table[hi];
  return a.u + ((target - a.s) / Math.max(EPSILON, b.s - a.s)) * (b.u - a.u);
}

export function sampleArcLength(points, subdivisions) {
  const data = arcLengthTable(points, 1e-6 * Math.max(1, bboxScale(points)));
  return Array.from({ length: subdivisions + 1 }, (_, i) => {
    const u = uAtLength(data.samples, (data.length * i) / subdivisions);
    return { u, ...evaluate(points, u) };
  });
}

function pointSegmentDistance(p, a, b) {
  const d = sub(b, a); const l2 = d.x ** 2 + d.y ** 2;
  if (!l2) return distance(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * d.x + (p.y - a.y) * d.y) / l2));
  return distance(p, add(a, scale(d, t)));
}

export function sampleAdaptive(points, pixelsPerUnit, tolerancePx = 1, maxEdges = 8192) {
  const samples = [{ u: 0, ...points[0] }]; let limited = false;
  function walk(control, u0, u1, depth) {
    const flatness = Math.max(0, ...control.slice(1, -1).map((p) => pointSegmentDistance(p, control[0], control.at(-1)) * pixelsPerUnit));
    const chord = distance(control[0], control.at(-1));
    const excess = (control.slice(1).reduce((sum, p, i) => sum + distance(control[i], p), 0) - chord) * pixelsPerUnit;
    if (depth >= 20 || samples.length >= maxEdges || (flatness <= tolerancePx && excess <= tolerancePx)) {
      limited ||= depth >= 20 || samples.length >= maxEdges;
      samples.push({ u: u1, ...control.at(-1) }); return;
    }
    const halves = split(control, 0.5); const mid = (u0 + u1) / 2;
    walk(halves.left, u0, mid, depth + 1); walk(halves.right, mid, u1, depth + 1);
  }
  walk(points, 0, 1, 0);
  return { samples, limited };
}
