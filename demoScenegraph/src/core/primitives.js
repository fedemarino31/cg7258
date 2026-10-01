// Catálogo de primitivas 2D. Todas se definen en coordenadas de modelo con Y hacia
// arriba (como en matemática). Cada una indica dónde está su origen.

const arc = (cx, cy, r, a0, a1, n) => {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
};

const num = (v) => parseFloat(v);

export const PRIMITIVES = {
  rectangulo: {
    nombre: 'Rectángulo',
    origen: 'centro',
    params: {
      ancho: { label: 'ancho', def: 10, min: 2, max: 60 },
      alto: { label: 'alto', def: 20, min: 2, max: 60 },
    },
    polygon: (p) => {
      const w = num(p.ancho) / 2;
      const h = num(p.alto) / 2;
      return [[-w, -h], [w, -h], [w, h], [-w, h]];
    },
  },
  circulo: {
    nombre: 'Círculo',
    origen: 'centro',
    params: { radio: { label: 'radio', def: 10, min: 1, max: 40 } },
    polygon: (p) => arc(0, 0, num(p.radio), 0, 360, 64).slice(0, -1),
  },
  triangulo: {
    nombre: 'Triángulo isósceles',
    origen: 'punto medio de la base',
    params: {
      base: { label: 'base', def: 30, min: 2, max: 80 },
      altura: { label: 'altura', def: 30, min: 2, max: 80 },
    },
    polygon: (p) => {
      const b = num(p.base) / 2;
      return [[-b, 0], [b, 0], [0, num(p.altura)]];
    },
  },
  triangulo_rect: {
    nombre: 'Triángulo rectángulo',
    origen: 'vértice del ángulo recto',
    params: {
      catetoX: { label: 'cateto X', def: 20, min: 2, max: 80 },
      catetoY: { label: 'cateto Y', def: 20, min: 2, max: 80 },
    },
    polygon: (p) => [[0, 0], [num(p.catetoX), 0], [0, num(p.catetoY)]],
  },
  semicirculo: {
    nombre: 'Semicírculo',
    origen: 'centro del diámetro',
    params: { radio: { label: 'radio', def: 15, min: 2, max: 40 } },
    polygon: (p) => arc(0, 0, num(p.radio), 0, 180, 48),
  },
  hexagono: {
    nombre: 'Hexágono',
    origen: 'centro',
    params: { radio: { label: 'radio', def: 12, min: 2, max: 40 } },
    polygon: (p) => arc(0, 0, num(p.radio), 0, 360, 6).slice(0, -1),
  },
  trapecio: {
    nombre: 'Trapecio',
    origen: 'punto medio de la base mayor',
    params: {
      baseMayor: { label: 'base mayor', def: 30, min: 4, max: 80 },
      baseMenor: { label: 'base menor', def: 15, min: 2, max: 80 },
      altura: { label: 'altura', def: 15, min: 2, max: 60 },
    },
    polygon: (p) => {
      const B = num(p.baseMayor) / 2;
      const b = num(p.baseMenor) / 2;
      return [[-B, 0], [B, 0], [b, num(p.altura)], [-b, num(p.altura)]];
    },
  },
  forma_L: {
    nombre: 'Forma L',
    origen: 'esquina interior inferior izquierda',
    params: {
      largo: { label: 'largo', def: 30, min: 6, max: 80 },
      ancho: { label: 'ancho', def: 20, min: 6, max: 80 },
      grosor: { label: 'grosor', def: 8, min: 2, max: 30 },
    },
    polygon: (p) => {
      const L = num(p.largo);
      const A = num(p.ancho);
      const g = num(p.grosor);
      return [[0, 0], [L, 0], [L, g], [g, g], [g, A], [0, A]];
    },
  },
};

export const PRIMITIVE_IDS = Object.keys(PRIMITIVES);

export function defaultParams(tipo) {
  const out = {};
  for (const [k, v] of Object.entries(PRIMITIVES[tipo].params)) out[k] = v.def;
  return out;
}

/** Polígono del modelo en coordenadas locales, con el pivot ya aplicado. */
export function modelPolygon(modelo) {
  const prim = PRIMITIVES[modelo.tipo];
  if (!prim) return [];
  const [px, py] = modelo.pivot ?? [0, 0];
  return prim.polygon(modelo.params).map(([x, y]) => [x - px, y - py]);
}

export function polygonBBox(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

const r2 = (v) => Math.round(v * 100) / 100;

/** Path SVG (cerrado) para un polígono. */
export function polygonPath(poly) {
  return poly.map(([x, y], i) => `${i ? 'L' : 'M'}${r2(x)} ${r2(y)}`).join('') + 'Z';
}

/** Texto de dimensiones para la leyenda: "ancho=10 · alto=20". */
export function describeParams(modelo) {
  const prim = PRIMITIVES[modelo.tipo];
  if (!prim) return '';
  return Object.entries(prim.params)
    .map(([k, def]) => `${def.label}=${modelo.params[k]}`)
    .join(' · ');
}

// Colores identificatorios, bien separados entre sí (hue distinto).
export const PALETTE = [
  '#2E9E44', // verde
  '#A532A5', // violeta
  '#C9A800', // mostaza
  '#E8590C', // naranja
  '#1C7ED6', // azul
  '#D6336C', // rosa
  '#0CA6A6', // turquesa
  '#7B5E3B', // marrón
];

/** Primera letra libre (A, B, C…) y primer color libre de la paleta. */
export function nextModelLetter(modelos) {
  for (let i = 0; i < 26; i++) {
    const l = String.fromCharCode(65 + i);
    if (!(l in modelos)) return l;
  }
  return 'Z' + Object.keys(modelos).length;
}

export function nextModelColor(modelos) {
  const used = new Set(Object.values(modelos).map((m) => m.color.toLowerCase()));
  return PALETTE.find((c) => !used.has(c.toLowerCase())) ?? PALETTE[Object.keys(modelos).length % PALETTE.length];
}
