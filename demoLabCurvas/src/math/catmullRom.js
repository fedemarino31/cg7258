import { add, sub, scale, length, lerp, bernstein } from './bezier.js';

export const DEFAULT_CR_PARAMS = { alpha: 0.5, tension: 0 };
export const ALPHA_PRESETS = [[0, 'Uniforme (α=0)'], [0.5, 'Centrípeta (α=0,5)'], [1, 'Cordal (α=1)']];
const MIN_INTERVAL = 1e-4;

const point = (x, y) => ({ x, y });
const params = (p = {}) => ({ alpha: Number.isFinite(p.alpha) ? p.alpha : DEFAULT_CR_PARAMS.alpha, tension: Number.isFinite(p.tension) ? p.tension : DEFAULT_CR_PARAMS.tension });

export function alphaName(alpha) {
  const preset = ALPHA_PRESETS.find(([value]) => Math.abs(value - alpha) < 1e-9);
  return preset ? preset[1].split(' ')[0] : `α=${alpha}`;
}

/** Intervalos nodales dt0, dt1, dt2 con dt = |P_{i+1}-P_i|^α. Los intervalos degenerados usan el vecino o 1. */
export function knotIntervals(points, alpha = DEFAULT_CR_PARAMS.alpha) {
  const raw = [0, 1, 2].map((i) => length(sub(points[i + 1], points[i])) ** alpha);
  let [dt0, dt1, dt2] = raw;
  if (!(dt1 >= MIN_INTERVAL)) dt1 = 1;
  if (!(dt0 >= MIN_INTERVAL)) dt0 = dt1;
  if (!(dt2 >= MIN_INTERVAL)) dt2 = dt1;
  return [dt0, dt1, dt2];
}

export function knots(points, alpha = DEFAULT_CR_PARAMS.alpha) {
  const [dt0, dt1, dt2] = knotIntervals(points, alpha);
  return [0, dt0, dt0 + dt1, dt0 + dt1 + dt2];
}

/** Tangentes m1, m2 respecto de u∈[0,1] del tramo P1→P2, ya escaladas por (1-τ). */
export function tangents(points, options = {}) {
  const { alpha, tension } = params(options);
  const [P0, P1, P2, P3] = points; const [dt0, dt1, dt2] = knotIntervals(points, alpha);
  const m1 = add(sub(scale(sub(P1, P0), 1 / dt0), scale(sub(P2, P0), 1 / (dt0 + dt1))), scale(sub(P2, P1), 1 / dt1));
  const m2 = add(sub(scale(sub(P2, P1), 1 / dt1), scale(sub(P3, P1), 1 / (dt1 + dt2))), scale(sub(P3, P2), 1 / dt2));
  const k = dt1 * (1 - tension);
  return [scale(m1, k), scale(m2, k)];
}

/** Controles de la cúbica de Bézier exactamente equivalente al tramo P1→P2. */
export function catmullRomToBezier(points, options = {}) {
  if (points.length !== 4) throw new RangeError('Un tramo Catmull-Rom requiere 4 puntos');
  const [m1, m2] = tangents(points, options);
  const P1 = point(points[1].x, points[1].y); const P2 = point(points[2].x, points[2].y);
  return [P1, add(P1, scale(m1, 1 / 3)), sub(P2, scale(m2, 1 / 3)), P2];
}

/** Pirámide de Barry-Goldman (válida para τ=0): [[A1,A2,A3],[B1,B2],[C]]. */
export function barryGoldmanLevels(points, u, options = {}) {
  const { alpha } = params(options);
  const [t0, t1, t2, t3] = knots(points, alpha); const t = t1 + u * (t2 - t1); const [P0, P1, P2, P3] = points;
  const mix = (a, b, ta, tb) => lerp(a, b, (t - ta) / (tb - ta));
  const A = [mix(P0, P1, t0, t1), mix(P1, P2, t1, t2), mix(P2, P3, t2, t3)];
  const B = [mix(A[0], A[1], t0, t2), mix(A[1], A[2], t1, t3)];
  return [A, B, [mix(B[0], B[1], t1, t2)]];
}

/** Pesos efectivos w0..w3(u): C(u)=Σ wi Pi con los nodos fijados por la geometría actual. */
export function catmullRomWeights(points, u, options = {}) {
  const { alpha, tension } = params(options);
  const [dt0, dt1, dt2] = knotIntervals(points, alpha); const k = dt1 * (1 - tension) / 3;
  // Coeficientes lineales de m1 y m2 sobre P0..P3 (antes del factor k).
  const m1 = [-1 / dt0 + 1 / (dt0 + dt1), 1 / dt0 - 1 / dt1, -1 / (dt0 + dt1) + 1 / dt1, 0];
  const m2 = [0, -1 / dt1 + 1 / (dt1 + dt2), 1 / dt1 - 1 / dt2, -1 / (dt1 + dt2) + 1 / dt2];
  const unit = (i) => [0, 1, 2, 3].map((j) => (j === i ? 1 : 0));
  const B = [unit(1), unit(1).map((v, j) => v + k * m1[j]), unit(2).map((v, j) => v - k * m2[j]), unit(2)];
  const b = bernstein(3, u);
  return [0, 1, 2, 3].map((j) => B.reduce((sum, row, i) => sum + b[i] * row[j], 0));
}

export function phantomPoint(end, neighbor, mode = 'reflect') {
  return mode === 'duplicate' ? point(end.x, end.y) : point(2 * end.x - neighbor.x, 2 * end.y - neighbor.y);
}
