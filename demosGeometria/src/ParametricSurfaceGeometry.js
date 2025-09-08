// ParametricSurfaceGeometry.js (ESM)
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';

/**
 * ParametricSurfaceGeometry
 * - Geometría paramétrica NO indexada (vértices duplicados por triángulo).
 * - Control de normales vía normalFn (por vértice) o shading 'flat'/'smooth'.
 * - "Knots" (uKnots/vKnots) para forzar muestreo en discontinuidades.
 * - Ejes cerrados u/v con wrapping de celdas y de diferencias finitas.
 *
 * @param {function(u:number, v:number, out:Vector3)} func  Mapa paramétrico
 * @param {object} options
 *    uRange=[0,1], vRange=[0,1]
 *    uSegments=8, vSegments=8
 *    uKnots=[], vKnots=[]
 *    uClosed=false, vClosed=false
 *    shading='smooth' | 'flat'
 *    normalFn=(u,v, triIndex, cornerIndex, pos, du, dv)=>Vector3 | [x,y,z] | {x,y,z}
 *    uvFn=(u,v)=>[s,t]
 *    epsilon=1e-5
 */
export class ParametricSurfaceGeometry extends BufferGeometry {
  constructor(func, options = {}) {
    super();

    const {
      uRange = [0, 1],
      vRange = [0, 1],
      uSegments = 8,
      vSegments = 8,
      uKnots = [],
      vKnots = [],
      uClosed = false,
      vClosed = false,
      shading = 'smooth',
      normalFn = null,
      uvFn = null,
      epsilon = 1e-5
    } = options;

    this.type = 'ParametricSurfaceGeometry2';
    this.parameters = {
      func, uRange, vRange, uSegments, vSegments,
      uKnots, vKnots, uClosed, vClosed, shading
    };

    // 1) Muestras uniendo grilla uniforme + knots (excluye extremos si el eje es cerrado)
    const uSamples = buildSamples(uRange, uSegments, uKnots, uClosed);
    const vSamples = buildSamples(vRange, vSegments, vKnots, vClosed);
    const nu = uSamples.length;
    const nv = vSamples.length;

    // 2) Precalcular posiciones P[i][j]
    const P = new Array(nv);
    for (let i = 0; i < nv; i++) {
      P[i] = new Array(nu);
      for (let j = 0; j < nu; j++) {
        const p = new Vector3();
        func(uSamples[j], vSamples[i], p);
        P[i][j] = p;
      }
    }

    const positions = [];
    const normals   = [];
    const uvs       = [];

    // 3) Generar triángulos por celda (con wrap si el eje es cerrado)
    let triIndex = 0;
    const jLimit = uClosed ? nu : nu - 1;
    const iLimit = vClosed ? nv : nv - 1;

    for (let i = 0; i < iLimit; i++) {
      const iN = vClosed ? (i + 1) % nv : i + 1;
      for (let j = 0; j < jLimit; j++) {
        const jN = uClosed ? (j + 1) % nu : j + 1;

        // Triángulo 1: (i,j) -> (i,jN) -> (iN,j)
        pushTriangle(P, uSamples, vSamples, i, j,  i, jN,  iN, j,
          triIndex++, func,
          { shading, normalFn, uvFn, uRange, vRange, epsilon, uClosed, vClosed },
          positions, normals, uvs);

        // Triángulo 2: (i,jN) -> (iN,jN) -> (iN,j)
        pushTriangle(P, uSamples, vSamples, i, jN,  iN, jN,  iN, j,
          triIndex++, func,
          { shading, normalFn, uvFn, uRange, vRange, epsilon, uClosed, vClosed },
          positions, normals, uvs);
      }
    }

    this.setAttribute('position', new Float32BufferAttribute(positions, 3));
    this.setAttribute('normal',   new Float32BufferAttribute(normals,   3));
    this.setAttribute('uv',       new Float32BufferAttribute(uvs,       2));
  }
}

/* ---------- helpers ---------- */

function buildSamples([a, b], segments, knots, closed = false) {
  const raw = [];
  const n = Math.max(1, segments);

  // base uniforme
  for (let k = 0; k <= n; k++) {
    if (closed && k === n) continue; // excluir extremo superior en ejes cerrados
    raw.push(a + (b - a) * (k / n));
  }

  // knots
  for (const t of knots || []) {
    const inRange = closed ? (t >= a && t < b) : (t >= a && t <= b);
    if (inRange) raw.push(t);
  }

  raw.sort((x, y) => x - y);
  // deduplicar con tolerancia numérica
  const eps = 1e-12;
  const out = [];
  for (const t of raw) {
    if (!out.length || Math.abs(t - out[out.length - 1]) > eps) out.push(t);
  }
  return out;
}

function wrapToRange(t, [a, b]) {
  const w = b - a;
  let x = t;
  // usar while para valores que puedan estar varias vueltas fuera
  while (x < a) x += w;
  while (x >= b) x -= w; // [a,b) para ejes cerrados
  return x;
}

function finiteDiffs(func, u, v, eps, uRange, vRange, p0, uClosed = false, vClosed = false) {
  const ua = uRange[0], ub = uRange[1];
  const va = vRange[0], vb = vRange[1];

  const pPlus = new Vector3();
  const pMinus = new Vector3();

  const du = new Vector3();
  const dv = new Vector3();

  // --- U ---
  if (uClosed) {
    const uM = wrapToRange(u - eps, uRange);
    const uP = wrapToRange(u + eps, uRange);
    func(uP, v, pPlus);
    func(uM, v, pMinus);
    du.subVectors(pPlus, pMinus); // central (escala irrelevante para la normal)
  } else if (u - eps >= ua && u + eps <= ub) {
    func(u + eps, v, pPlus);
    func(u - eps, v, pMinus);
    du.subVectors(pPlus, pMinus);
  } else if (u - eps < ua) {
    func(u + eps, v, pPlus);
    du.subVectors(pPlus, p0); // forward
  } else {
    func(u - eps, v, pMinus);
    du.subVectors(p0, pMinus); // backward
  }

  // --- V ---
  if (vClosed) {
    const vM = wrapToRange(v - eps, vRange);
    const vP = wrapToRange(v + eps, vRange);
    func(u, vP, pPlus);
    func(u, vM, pMinus);
    dv.subVectors(pPlus, pMinus);
  } else if (v - eps >= va && v + eps <= vb) {
    func(u, v + eps, pPlus);
    func(u, v - eps, pMinus);
    dv.subVectors(pPlus, pMinus);
  } else if (v - eps < va) {
    func(u, v + eps, pPlus);
    dv.subVectors(pPlus, p0);
  } else {
    func(u, v - eps, pMinus);
    dv.subVectors(p0, pMinus);
  }

  return { du, dv };
}

function defaultUV(uvFn, u, v, uRange, vRange) {
  if (uvFn) return uvFn(u, v);
  const [ua, ub] = uRange;
  const [va, vb] = vRange;
  const su = (u - ua) / (ub - ua);
  const sv = (v - va) / (vb - va);
  return [su, sv];
}

function pushTriangle(
  P, uS, vS,
  iA, jA, iB, jB, iC, jC,
  triIndex, func, opts,
  positions, normals, uvs
) {
  const { shading, normalFn, uvFn, uRange, vRange, epsilon, uClosed, vClosed } = opts;

  const pA = P[iA][jA], pB = P[iB][jB], pC = P[iC][jC];
  const e1 = new Vector3().subVectors(pB, pA);
  const e2 = new Vector3().subVectors(pC, pA);
  const faceNormal = new Vector3().crossVectors(e1, e2).normalize();

  // Empuja 1 vértice del triángulo
  function pushVertex(i, j, cornerIndex, fallbackFaceNormal) {
    const u = uS[j], v = vS[i];
    const p = P[i][j];

    positions.push(p.x, p.y, p.z);

    let n;
    if (typeof normalFn === 'function') {
      const { du, dv } = finiteDiffs(func, u, v, epsilon, uRange, vRange, p, uClosed, vClosed);
      n = normalFn(u, v, triIndex, cornerIndex, p, du, dv);
      if (!(n && n.isVector3)) {
        // permitir [x,y,z] u objeto con x,y,z
        n = new Vector3(n?.x ?? n?.[0], n?.y ?? n?.[1], n?.z ?? n?.[2]);
      }
      n.normalize();
    } else if (shading === 'smooth') {
      const { du, dv } = finiteDiffs(func, u, v, epsilon, uRange, vRange, p, uClosed, vClosed);
      n = new Vector3().crossVectors(du, dv).normalize();
    } else { // 'flat'
      n = fallbackFaceNormal;
    }

    normals.push(n.x, n.y, n.z);

    const [su, sv] = defaultUV(uvFn, u, v, uRange, vRange);
    uvs.push(su, sv);
  }

  // Triángulo completo (vértices duplicados; no indexado)
  pushVertex(iA, jA, 0, faceNormal);
  pushVertex(iB, jB, 1, faceNormal);
  pushVertex(iC, jC, 2, faceNormal);
}
