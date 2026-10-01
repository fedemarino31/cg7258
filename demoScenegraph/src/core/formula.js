// Fórmulas de transformación: listas de operaciones T, R, E.
// La fórmula "T(0,-10)*E(2,-2)" representa M = T·E: se multiplica de izquierda a
// derecha y, al aplicarse a los vértices (v' = M·v), la operación de más a la
// derecha es la primera que actúa.

import { identity, multiply, rotate, scale, translate } from './mat3.js';

export const OP_TYPES = {
  T: { nombre: 'Traslación', params: ['x', 'y'], def: { x: 10, y: 0 } },
  R: { nombre: 'Rotación', params: ['ang'], def: { ang: 90 } },
  E: { nombre: 'Escalado', params: ['x', 'y'], def: { x: 2, y: 2 } },
};

export function makeOp(op, values = {}) {
  return { op, ...OP_TYPES[op].def, ...values };
}

export function fmtNum(v) {
  if (!Number.isFinite(v)) return String(v);
  const r = Math.round(v * 1000) / 1000;
  return String(Object.is(r, -0) ? 0 : r);
}

export function formatOp(o) {
  switch (o.op) {
    case 'T':
      return `T(${fmtNum(o.x)},${fmtNum(o.y)})`;
    case 'R':
      return `R(${fmtNum(o.ang)})`;
    case 'E':
      return `E(${fmtNum(o.x)},${fmtNum(o.y)})`;
    default:
      return '?';
  }
}

export function format(ops) {
  return ops && ops.length ? ops.map(formatOp).join('*') : '';
}

const OP_RE = /^\s*([TREStres])\s*\(\s*([^)]*)\)\s*$/;

/**
 * Convierte un string a lista de operaciones.
 * Acepta '*' o '·' como separador, mayúsculas o minúsculas, y S como sinónimo de E.
 * Devuelve { ops, error }.
 */
export function parse(str) {
  const s = (str ?? '').trim();
  if (!s) return { ops: [], error: null };
  // Los trozos vacíos ("*R(45)", "T(1,0)**E(2,2)") se ignoran, como hacía el código viejo.
  const parts = s.split(/[*·]/).filter((p) => p.trim() !== '');
  const ops = [];
  for (const part of parts) {
    const m = part.match(OP_RE);
    if (!m) return { ops: null, error: `No se reconoce "${part.trim()}"` };
    let tipo = m[1].toUpperCase();
    if (tipo === 'S') tipo = 'E';
    const nums = m[2].split(',').map((t) => t.trim()).filter((t) => t !== '');
    const vals = nums.map(Number);
    if (vals.some((v) => !Number.isFinite(v))) {
      return { ops: null, error: `Número inválido en "${part.trim()}"` };
    }
    if (tipo === 'R') {
      if (vals.length !== 1) return { ops: null, error: `R lleva 1 parámetro: "${part.trim()}"` };
      ops.push({ op: 'R', ang: vals[0] });
    } else {
      if (tipo === 'E' && vals.length === 1) vals.push(vals[0]);
      if (vals.length !== 2) return { ops: null, error: `${tipo} lleva 2 parámetros: "${part.trim()}"` };
      ops.push({ op: tipo, x: vals[0], y: vals[1] });
    }
  }
  return { ops, error: null };
}

/**
 * Matriz de una operación. Con s en [0,1] se obtiene la operación "a medias"
 * (para animar): T y R se interpolan desde la identidad y E va de 1 a su valor,
 * pasando por 0 si la escala es negativa (se ve el espejado).
 */
export function opMatrix(o, s = 1) {
  switch (o.op) {
    case 'T':
      return translate(o.x * s, o.y * s);
    case 'R':
      return rotate(o.ang * s);
    case 'E':
      return scale(1 + (o.x - 1) * s, 1 + (o.y - 1) * s);
    default:
      return identity();
  }
}

/** Producto de las operaciones en el orden escrito. */
export function compose(ops) {
  return (ops ?? []).reduce((acc, o) => multiply(acc, opMatrix(o)), identity());
}

/**
 * Matriz parcial durante la animación: se aplicaron completas las operaciones
 * de índice > k y la k va por la fracción s. Resultado: Ok(s)·Ok+1·…·On.
 */
export function partialCompose(ops, k, s) {
  let m = identity();
  for (let i = ops.length - 1; i > k; i--) m = multiply(opMatrix(ops[i]), m);
  if (k >= 0 && k < ops.length) m = multiply(opMatrix(ops[k], s), m);
  return m;
}

export function isSingular(o) {
  return o.op === 'E' && (Math.abs(o.x) < 1e-9 || Math.abs(o.y) < 1e-9);
}
