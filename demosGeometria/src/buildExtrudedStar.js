// buildExtrudedStar.js
import {
  Mesh, MeshNormalMaterial, Vector3, DoubleSide
} from 'three';

import { ParametricSurfaceGeometry } from './ParametricSurfaceGeometry.js';
import { VertexNormalsHelper } from 'three/examples/jsm/helpers/VertexNormalsHelper';

/**
 * buildExtrudedStar
 * Crea un Mesh que representa la extrusión de una estrella de N puntas,
 * con torsión (twist) a lo largo de la extrusión.
 *
 * @param {object} opts
 *  - points=5              // número de puntas (N)
 *  - rOuter=1              // radio de las puntas
 *  - rInner=0.5            // radio de los valles
 *  - depth=1               // profundidad total de extrusión
 *  - twistTurns=1          // vueltas completas de giro (p.ej., 1 = 360° a lo largo de todo v)
 *  - uSegmentsPerEdge=6    // subdivisiones por arista de la estrella
 *  - vSegments=32          // subdivisiones a lo largo de la extrusión
 *  - shading='flat'        // 'flat' (caras duras) o 'smooth'
 *  - material=null         // opcional: material a usar; si no, se crea uno estándar
 *  - color=0x3b82f6        // color del material por defecto
 *  - doubleSided=false     // si true, renderiza ambas caras (útil si no ponés tapas)
 *
 * @returns {THREE.Mesh}
 */
export function buildExtrudedStar(opts = {}) {
  const {
    points = 5,
    rOuter = 1,
    rInner = 0.5,
    depth = 1,
    twistTurns = 1,
    uSegmentsPerEdge = 6,
    vSegments = 32,
    shading = 'flat',
    material = null,
    color = 0x3b82f6,
    doubleSided = false
  } = opts;

  if (points < 2) throw new Error('points debe ser >= 2');

  // 1) Polígono estrella en XY (lista de vértices alternando radio exterior/interior)
  //    Tendremos M = 2N vértices y M aristas.
  const M = points * 2;
  const verts = new Array(M);
  // opcional: girar la estrella para que una punta mire hacia +Y (pi/2). Ajustá si preferís otra orientación.
  const angleOffset = Math.PI / 2;

  for (let k = 0; k < M; k++) {
    const angle = (k * Math.PI) / points - angleOffset; // k * (2π/M) pero alterna radios
    const r = (k % 2 === 0) ? rOuter : rInner;
    verts[k] = { x: r * Math.cos(angle), y: r * Math.sin(angle) };
  }

  // 2) Paramétrica de extrusión con TORSIÓN
  //    u ∈ [0,1) recorre el perímetro (M aristas), v ∈ [0,1] recorre la profundidad.
  const twistTotal = 2 * Math.PI * twistTurns; // radianes de giro totales a lo largo de v ∈ [0,1]

  function starExtrude(u, v, out) {
    // Elegir arista y factor local s
    const t = u * M;
    const seg = Math.floor(t) % M;
    const s = t - Math.floor(t);

    // Extremos de la arista (a -> b)
    const a = verts[seg];
    const b = verts[(seg + 1) % M];

    // Interpolación lineal en XY
    let x = a.x + (b.x - a.x) * s;
    let y = a.y + (b.y - a.y) * s;

    // Torsión: rotar (x,y) alrededor de Z según v
    const theta = twistTotal * v;
    const c = Math.cos(theta), snt = Math.sin(theta);
    const xr = c * x - snt * y;
    const yr = snt * x + c * y;

    // Profundidad (centrada en Z=0)
    const z = (v - 0.5) * depth;

    out.set(xr, yr, z);
  }

  // 3) "Knots" en u para forzar vértices exactamente en las esquinas de la estrella
  //    (uClosed=true → NO incluir 1.0)
  const uKnots = [];
  for (let k = 0; k < M; k++) uKnots.push(k / M);

  // 4) Construir la geometría con ejes cerrados en u
  const geom = new ParametricSurfaceGeometry(starExtrude, {
    uClosed: true,
    vClosed: false,
    uSegments: uSegmentsPerEdge * M, // densidad base por arista
    vSegments,
    uKnots,                   // asegura una columna en cada vértice
    vKnots: [0, 1],           // extremos de la extrusión
    shading                   // 'flat' recomendado para aristas duras entre caras
    // Podés pasar normalFn si querés imponer normales específicas por vértice
  });

const mat = new MeshNormalMaterial();

  const mesh = new Mesh(geom, mat);
  // Opcional: recentrar (la paramétrica ya sale centrada en Z)
  mesh.position.set(0, 0, 0);
  //add normal helper

  return mesh;
}
