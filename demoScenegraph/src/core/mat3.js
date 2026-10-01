// Matrices afines 2D (3x3 homogéneas) representadas como [a, b, c, d, e, f],
// con la misma convención que SVG:
//   | a c e |   x' = a·x + c·y + e
//   | b d f |   y' = b·x + d·y + f
//   | 0 0 1 |

export const identity = () => [1, 0, 0, 1, 0, 0];

export const translate = (x, y) => [1, 0, 0, 1, x, y];

export function rotate(deg) {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [c, s, -s, c, 0, 0];
}

export const scale = (sx, sy) => [sx, 0, 0, sy, 0, 0];

/** Producto A·B (aplicar B primero y luego A). */
export function multiply(A, B) {
  return [
    A[0] * B[0] + A[2] * B[1],
    A[1] * B[0] + A[3] * B[1],
    A[0] * B[2] + A[2] * B[3],
    A[1] * B[2] + A[3] * B[3],
    A[0] * B[4] + A[2] * B[5] + A[4],
    A[1] * B[4] + A[3] * B[5] + A[5],
  ];
}

/** Producto de una lista de matrices de izquierda a derecha: M0·M1·…·Mn. */
export function product(list) {
  return list.reduce((acc, m) => multiply(acc, m), identity());
}

export function apply(M, [x, y]) {
  return [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];
}

export const det = (M) => M[0] * M[3] - M[1] * M[2];

export function invert(M) {
  const D = det(M);
  if (Math.abs(D) < 1e-12) return null;
  const [a, b, c, d, e, f] = M;
  return [d / D, -b / D, -c / D, a / D, (c * f - d * e) / D, (b * e - a * f) / D];
}

const clean = (v) => (Math.abs(v) < 1e-9 ? 0 : v);

export function toSVG(M) {
  return `matrix(${M.map(clean).join(' ')})`;
}

/** Filas de la matriz 3x3 completa. */
export function toRows(M) {
  return [
    [M[0], M[2], M[4]],
    [M[1], M[3], M[5]],
    [0, 0, 1],
  ].map((r) => r.map(clean));
}

export function equals(A, B, eps = 1e-6) {
  return A.every((v, i) => Math.abs(v - B[i]) < eps);
}

const normAngle = (deg) => {
  let a = ((deg + 180) % 360 + 360) % 360 - 180;
  if (a <= -180 + 1e-9) a = 180;
  return a;
};

/**
 * Descompone M = T(tx,ty) · R(θ) · [[sx, k],[0, sy]].
 * La parte lineal se factoriza por QR. Hay dos soluciones equivalentes
 * (θ, sx, k, sy) y (θ+180, -sx, -k, -sy): si hay espejado (det<0) se elige la
 * de menor |θ|; si no, la que tiene escalas positivas.
 * k es la cizalla: si no es 0, la matriz no se puede escribir como un solo T·R·E.
 */
export function decompose(M) {
  const [a, b, c, d, e, f] = M;
  let sx = Math.hypot(a, b);
  let theta = (Math.atan2(b, a) * 180) / Math.PI;
  const tr = (theta * Math.PI) / 180;
  let k = Math.cos(tr) * c + Math.sin(tr) * d;
  let sy = -Math.sin(tr) * c + Math.cos(tr) * d;
  const D = det(M);
  if (D < 0) {
    const alt = normAngle(theta + 180);
    if (Math.abs(alt) < Math.abs(normAngle(theta)) - 1e-9) {
      theta = alt;
      sx = -sx;
      k = -k;
      sy = -sy;
    }
  }
  theta = normAngle(theta);
  // La cizalla se expresa normalizada por sy: [[sx,k],[0,sy]] = [[1,k/sy],[0,1]]·E(sx,sy)
  const shear = Math.abs(sy) > 1e-12 ? k / sy : 0;
  return {
    tx: clean(e),
    ty: clean(f),
    rot: clean(theta),
    sx: clean(sx),
    sy: clean(sy),
    shear: clean(shear),
    hasShear: Math.abs(shear) > 1e-6,
    mirrored: D < 0,
    det: clean(D),
  };
}

/** Recompone a partir de decompose() (para tests y para mostrar). */
export function recompose({ tx, ty, rot, sx, sy, shear }) {
  return product([translate(tx, ty), rotate(rot), [1, 0, shear, 1, 0, 0], scale(sx, sy)]);
}
