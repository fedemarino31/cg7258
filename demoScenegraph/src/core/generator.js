// Generador de ejercicios con semilla: árboles cuyas formas nunca se superponen
// y que entran en la grilla.
//
// Se construye de abajo hacia arriba. Cada subárbol se arma en su propio marco y
// después se ubica en el marco del padre probando fórmulas al azar hasta que su
// bloque no pise a los hermanos ya ubicados. Como una transformación afín
// invertible conserva la no superposición, alcanza con comprobarla entre hermanos.

import { PALETTE, PRIMITIVE_IDS, PRIMITIVES, defaultParams, modelPolygon } from './primitives.js';
import { DEFAULT_GRID, createDoc } from './doc.js';
import { apply } from './mat3.js';
import { compose } from './formula.js';
import { EPS_AREA, findOverlaps, outsideGrid, validate } from './collide.js';
import { allPolygons } from './evaluate.js';

const MARGEN = 5; // las formas quedan a 5 unidades o más del borde de la grilla

export const DIFICULTADES = ['facil', 'media', 'dificil'];

export const DEFAULTS = {
  seed: 1,
  nModelos: 3,
  formasMin: 5,
  formasMax: 8,
  profundidad: 3,
  dificultad: 'media',
  tipos: ['rectangulo', 'circulo', 'triangulo'],
  pFormaContenedor: 0.25, // prob. de que un nodo interno tenga forma propia
};

// ---------- RNG reproducible ----------
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    shuffle: (arr) => {
      const a2 = [...arr];
      for (let i = a2.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a2[i], a2[j]] = [a2[j], a2[i]];
      }
      return a2;
    },
  };
}

// ---------- modelos ----------
const SIZES = [10, 15, 20, 30];
const RADII = [10, 15];

function randomModel(r, tipo, color) {
  const params = defaultParams(tipo);
  for (const [k, def] of Object.entries(PRIMITIVES[tipo].params)) {
    const pool = k === 'radio' ? RADII : SIZES;
    params[k] = r.pick(pool.filter((s) => s >= def.min && s <= Math.min(def.max, 30)));
  }
  if (tipo === 'trapecio' && params.baseMenor >= params.baseMayor) {
    params.baseMayor = Math.max(params.baseMayor, params.baseMenor) + 10;
  }
  if (tipo === 'forma_L') {
    params.grosor = r.pick([5, 10]);
    params.largo = Math.max(params.largo, 20);
    params.ancho = Math.max(params.ancho, 20);
  }
  if (tipo === 'rectangulo' && params.ancho === params.alto) params.alto = params.ancho === 30 ? 20 : params.ancho + 10;
  return { tipo, params, color };
}

// ---------- fórmulas al azar ----------
const ANGLES = {
  facil: [90, -90, 180, 45],
  media: [90, -90, 180, 45, -45, 135],
  dificil: [90, -90, 180, 45, -45, 135, -135],
};

function randomOps(r, dif, lastLevel) {
  const maxOps = dif === 'facil' ? 2 : 3;
  const n = r.int(1, maxOps);
  const kinds = r.shuffle(['T', 'R', 'E']).slice(0, n);
  // la traslación casi siempre está, es lo que separa a los hermanos
  if (!kinds.includes('T') && r.chance(0.7)) kinds[0] = 'T';
  const ops = [];
  for (const k of kinds) {
    if (k === 'T') {
      const comp = () => r.pick([0, 0, 5, 10, 15, 20, 30, 40, 50, 60]) * r.pick([1, -1]);
      let x = comp();
      let y = comp();
      if (x === 0 && y === 0) x = r.pick([20, -20, 30, -30]);
      ops.push({ op: 'T', x, y });
    } else if (k === 'R') {
      ops.push({ op: 'R', ang: r.pick(ANGLES[dif]) });
    } else {
      let sx;
      let sy;
      if (dif === 'facil') {
        sx = sy = r.pick([2, 2, 3, 0.5]);
      } else {
        const pool = [1, 2, 3, 4, 0.5];
        sx = r.pick(pool);
        sy = r.chance(0.35) ? sx : r.pick(pool);
        if (r.chance(0.35)) sx = -sx;
        else if (r.chance(0.3)) sy = -sy;
      }
      if (sx === 1 && sy === 1) sx = sy = 2;
      ops.push({ op: 'E', x: sx, y: sy });
    }
  }
  void lastLevel;
  return ops;
}

// ---------- patrones exigidos por dificultad ----------
function stats(root) {
  const s = { orbit: false, mirror: false, nonuniform: false, count: 0 };
  const rec = (n) => {
    const ops = n.t ?? [];
    ops.forEach((o, i) => {
      if (o.op === 'R' && ops.slice(0, i).some((p) => p.op === 'T')) s.orbit = true;
      if (o.op === 'E') {
        if (o.x < 0 || o.y < 0) s.mirror = true;
        if (Math.abs(o.x) !== Math.abs(o.y)) s.nonuniform = true;
      }
    });
    s.count++;
    n.hijos.forEach(rec);
  };
  root.hijos.forEach(rec);
  return s;
}

function meetsDifficulty(root, dif) {
  const s = stats(root);
  if (dif === 'media') return s.mirror || s.nonuniform || s.orbit;
  if (dif === 'dificil') return s.orbit && s.mirror && s.nonuniform;
  return true;
}

// ---------- construcción ----------
function splitBudget(r, total, k) {
  const parts = new Array(k).fill(1);
  for (let i = 0; i < total - k; i++) parts[r.int(0, k - 1)]++;
  return parts;
}

class Builder {
  constructor(opts, r, modelKeys, models) {
    this.o = opts;
    this.r = r;
    this.keys = modelKeys;
    this.models = models;
    this.nextId = 1;
    this.shapes = 0;
  }

  newId() {
    return 'n' + this.nextId++;
  }

  polyOf(letra) {
    return modelPolygon(this.models[letra]);
  }

  /** Construye un subárbol; devuelve { node, polys } con los polígonos en el marco del nodo. */
  build(budget, depthLeft, isRoot = false) {
    const { r } = this;
    const node = { id: isRoot ? 'n0' : this.newId(), nombre: isRoot ? 'Raíz' : '', modelo: null, t: [], hijos: [] };
    const polys = [];

    const leaf = !isRoot && (budget <= 1 || depthLeft <= 0);
    if (leaf) {
      node.modelo = r.pick(this.keys);
      polys.push(this.polyOf(node.modelo));
      this.shapes++;
      return { node, polys };
    }

    let remaining = budget;
    if (!isRoot && r.chance(this.o.pFormaContenedor) && remaining >= 3) {
      node.modelo = r.pick(this.keys);
      polys.push(this.polyOf(node.modelo));
      this.shapes++;
      remaining -= 1;
    }
    const k = Math.min(remaining, isRoot ? r.int(2, 3) : r.int(2, 3));
    const parts = splitBudget(r, remaining, Math.max(1, k));

    for (const part of parts) {
      const placed = this.place(part, depthLeft - 1, polys, isRoot);
      if (!placed) continue; // no entró: se omite este hijo
      node.hijos.push(placed.node);
      polys.push(...placed.polys);
    }
    return { node, polys };
  }

  /**
   * Genera un hijo y busca una fórmula con la que no pise a los ya ubicados.
   * Entre varias posiciones válidas elige la más compacta (menor radio del conjunto),
   * salvo en la raíz, donde se elige una al azar para que la escena se reparta por la grilla.
   */
  place(budget, depthLeft, placedPolys, atRoot = false) {
    const { r, o } = this;
    const reach = (polys) => Math.max(0, ...polys.flatMap((poly) => poly.map(([x, y]) => Math.hypot(x, y))));
    for (let tries = 0; tries < 6; tries++) {
      const sub = this.build(budget, depthLeft);
      let best = null;
      let valid = 0;
      for (let attempt = 0; attempt < 160 && valid < 8; attempt++) {
        const ops = randomOps(r, o.dificultad, depthLeft);
        const moved = sub.polys.map((poly) => poly.map((p) => apply(compose(ops), p)));
        if (!this.fits(moved, atRoot)) continue;
        const items = [
          ...placedPolys.map((poly, i) => ({ id: 'p' + i, poly })),
          ...moved.map((poly, i) => ({ id: 'm' + i, poly })),
        ];
        if (findOverlaps(items, EPS_AREA).length) continue;
        valid++;
        // en los niveles internos se prefiere lo compacto; en la raíz, cualquier posición válida
        const score = atRoot ? r.next() : reach([...placedPolys, ...moved]);
        if (!best || score < best.score) best = { ops, moved, score };
      }
      if (best) {
        sub.node.t = best.ops;
        return { node: sub.node, polys: best.moved };
      }
    }
    return null;
  }

  fits(polys, atRoot) {
    const lim = atRoot ? this.o.limite : this.o.limiteInterno;
    return polys.every((poly) => poly.every(([x, y]) => Math.abs(x) <= lim && Math.abs(y) <= lim));
  }
}

function assignIds(root) {
  let n = 0;
  const rec = (node) => {
    node.id = 'n' + n++;
    node.hijos.forEach(rec);
  };
  rec(root);
}

/**
 * Genera un documento. Lanza un Error si no logra uno válido en maxIntentos.
 * opts: ver DEFAULTS.
 */
export function generate(options = {}, maxIntentos = 400) {
  const o = { ...DEFAULTS, ...options, limite: 90, limiteInterno: 70 };
  o.tipos = o.tipos?.length ? o.tipos.filter((t) => PRIMITIVE_IDS.includes(t)) : DEFAULTS.tipos;
  const r = rng(o.seed);
  const grilla = { ...DEFAULT_GRID };

  for (let intento = 0; intento < maxIntentos; intento++) {
    // modelos: tipos distintos mientras alcancen
    const nModelos = Math.max(2, Math.min(o.nModelos, 8));
    const tipos = [];
    const pool = r.shuffle(o.tipos);
    for (let i = 0; i < nModelos; i++) tipos.push(pool[i % pool.length]);
    const colores = r.shuffle(PALETTE);
    const modelos = {};
    tipos.forEach((t, i) => {
      modelos[String.fromCharCode(65 + i)] = randomModel(r, t, colores[i % colores.length]);
    });

    const budget = r.int(o.formasMin, Math.max(o.formasMin, o.formasMax));
    const b = new Builder(o, r, Object.keys(modelos), modelos);
    const { node: root } = b.build(budget, o.profundidad, true);

    if (b.shapes < Math.max(3, o.formasMin - 1)) continue;
    if (!meetsDifficulty(root, o.dificultad)) continue;
    // todos los modelos declarados deben usarse
    const used = new Set();
    const collect = (n) => {
      if (n.modelo) used.add(n.modelo);
      n.hijos.forEach(collect);
    };
    collect(root);
    for (const k of Object.keys(modelos)) if (!used.has(k)) delete modelos[k];
    if (Object.keys(modelos).length < 2) continue;

    assignIds(root);
    const doc = createDoc(`Ejercicio generado · semilla ${o.seed}`);
    doc.grilla = grilla;
    doc.modelos = modelos;
    doc.raiz = root;
    // verificación final en el mundo: sin superposición y dentro de la grilla con margen
    const v = validate(doc);
    if (!v.ok) continue;
    if (outsideGrid(allPolygons(doc), grilla, MARGEN).length) continue;
    return doc;
  }
  throw new Error('No se pudo generar un ejercicio válido con esos parámetros. Probá con menos formas o menor dificultad.');
}
