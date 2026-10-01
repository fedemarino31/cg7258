import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as M from '../src/core/mat3.js';
import { compose, format, parse, partialCompose } from '../src/core/formula.js';
import { importLegacy } from '../src/core/legacy.js';
import { chain, evaluate } from '../src/core/evaluate.js';
import { findOverlaps, outsideGrid, validate } from '../src/core/collide.js';
import { buildTimeline, stateAt } from '../src/core/timeline.js';
import { validateSchema } from '../src/core/doc.js';

const near = (a, b, eps = 1e-6) => a.forEach((v, i) => expect(Math.abs(v - b[i])).toBeLessThan(eps));

describe('mat3', () => {
  it('multiplica con el orden M = A·B (B actúa primero)', () => {
    const m = M.multiply(M.translate(10, 0), M.rotate(90));
    near(M.apply(m, [1, 0]), [10, 1]);
  });
  it('invierte', () => {
    const m = M.product([M.translate(3, 4), M.rotate(30), M.scale(2, -1)]);
    near(M.multiply(m, M.invert(m)), M.identity());
  });
  it('decompose/recompose ida y vuelta, con espejado y cizalla', () => {
    const casos = [
      M.product([M.translate(5, -3), M.rotate(40), M.scale(2, 3)]),
      M.product([M.translate(5, -3), M.rotate(40), M.scale(-2, 3)]),
      M.product([M.rotate(45), M.scale(4, 1), M.rotate(30)]),
      M.scale(1, -1),
    ];
    for (const m of casos) near(M.recompose(M.decompose(m)), m);
    expect(M.decompose(M.scale(-1, 1)).mirrored).toBe(true);
    expect(M.decompose(M.product([M.rotate(45), M.scale(4, 1), M.rotate(30)])).hasShear).toBe(true);
    expect(M.decompose(M.product([M.rotate(45), M.scale(2, 2)])).hasShear).toBe(false);
  });
});

describe('formula', () => {
  it('parse y format son inversos', () => {
    const s = 'T(0,-10)*E(2,-2)*R(45)';
    const { ops, error } = parse(s);
    expect(error).toBeNull();
    expect(format(ops)).toBe(s);
  });
  it('reporta errores', () => {
    expect(parse('T(1)').error).toBeTruthy();
    expect(parse('X(1,2)').error).toBeTruthy();
  });
  it('compose coincide con el producto a mano', () => {
    const { ops } = parse('T(10,0)*R(90)*E(2,1)');
    near(compose(ops), M.product([M.translate(10, 0), M.rotate(90), M.scale(2, 1)]));
    // el punto (1,0) se escala, rota y traslada: (2,0)->(0,2)->(10,2)
    near(M.apply(compose(ops), [1, 0]), [10, 2]);
  });
  it('partialCompose empieza en la identidad y termina en compose', () => {
    const { ops } = parse('T(10,0)*R(90)*E(2,1)');
    // k = último: con s=0 no hay nada aplicado
    near(partialCompose(ops, 2, 0), M.identity());
    near(partialCompose(ops, 0, 1), compose(ops));
    // con la última completa y la anterior en 0: solo E
    near(partialCompose(ops, 1, 0), M.scale(2, 1));
  });
});

// ---------- importación de los ejemplos viejos ----------

const LEGACY_DIR = join(import.meta.dirname, '..', 'generadorEjerciciosParcial', 'ejercicios');
function legacyFiles(dir = LEGACY_DIR, out = []) {
  try {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) legacyFiles(p, out);
      else if (/^transformaciones\d+\.json$/.test(f)) out.push(p);
    }
  } catch {
    /* la carpeta vieja puede no existir */
  }
  return out;
}

describe('importación de ejercicios viejos', () => {
  const files = legacyFiles();
  it.skipIf(!files.length)('importa todos los archivos y el esquema es válido', () => {
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) {
      const doc = importLegacy(JSON.parse(readFileSync(f, 'utf8')));
      expect(validateSchema(doc), f).toEqual([]);
    }
  });
  it.skipIf(!files.length)('transformaciones11: la matriz de mundo coincide con el cálculo a mano', () => {
    const f = files.find((p) => p.endsWith(join('2c2021', 'transformaciones11.json')));
    const doc = importLegacy(JSON.parse(readFileSync(f, 'utf8')));
    const ev = evaluate(doc);
    // raiz -> C [T(0,-40)*R(90)] -> A [T(30,0)] -> B [T(0,-10)*E(2,-2)]
    const C = doc.raiz.hijos[0];
    const A = C.hijos[0];
    const B = A.hijos[1];
    const esperado = M.product([
      M.translate(0, -40), M.rotate(90), M.translate(30, 0), M.translate(0, -10), M.scale(2, -2),
    ]);
    near(ev.get(B.id).world, esperado);
    // la cadena de la raíz al nodo da el mismo producto
    const links = chain(doc, B.id);
    expect(links.map((l) => l.node.id)).toEqual([C.id, A.id, B.id]);
    near(links.at(-1).cumulative, esperado);
  });
});

// ---------- colisiones ----------

describe('collide', () => {
  const sq = (x, y, s = 10) => [[x, y], [x + s, y], [x + s, y + s], [x, y + s]];
  it('distingue separados, tocándose y superpuestos', () => {
    const polys = (b) => [{ id: 'a', poly: sq(0, 0) }, { id: 'b', poly: b }];
    expect(findOverlaps(polys(sq(20, 0)))).toHaveLength(0);
    expect(findOverlaps(polys(sq(10, 0)))).toHaveLength(0); // se tocan
    expect(findOverlaps(polys(sq(5, 5)))).toHaveLength(1);
  });
  it('detecta formas fuera de la grilla', () => {
    const g = { min: -100, max: 100 };
    expect(outsideGrid([{ id: 'a', poly: sq(95, 0) }], g)).toEqual(['a']);
    expect(outsideGrid([{ id: 'a', poly: sq(0, 0) }], g)).toEqual([]);
  });
});

// ---------- timeline ----------

describe('timeline', () => {
  const doc = () => {
    const f = LEGACY_DIR && legacyFiles().find((p) => p.endsWith(join('2c2021', 'transformaciones11.json')));
    return importLegacy(JSON.parse(readFileSync(f, 'utf8')));
  };
  it.skipIf(!legacyFiles().length)('una etapa por nodo interno, de las hojas a la raíz', () => {
    const d = doc();
    const tl = buildTimeline(d);
    // internos: A(T 30,0), F(R 45...), C, Raíz  -> 4 etapas
    expect(tl.stages).toHaveLength(4);
    expect(tl.stages.at(-1).nodeId).toBe(d.raiz.id);
  });
  it.skipIf(!legacyFiles().length)('al final coincide con la evaluación estática y es continuo', () => {
    const d = doc();
    const tl = buildTimeline(d);
    const end = stateAt(d, tl, tl.total);
    expect(end.finished).toBe(true);
    const ev = evaluate(d);
    for (const it of end.items) near(it.matrix, ev.get(it.id).world);
    // continuidad en cada frontera entre segmentos
    for (const seg of tl.segments) {
      const a = stateAt(d, tl, seg.t1 - 1e-6);
      const b = stateAt(d, tl, seg.t1 + 1e-6);
      if (seg.stage !== tl.segments.find((s) => s.t0 === seg.t1)?.stage) continue;
      const mapB = new Map(b.items.map((i) => [i.id, i.matrix]));
      for (const it of a.items) if (mapB.has(it.id) && it.opacity === 1) near(it.matrix, mapB.get(it.id), 1e-3);
    }
  });
  it.skipIf(!legacyFiles().length)('al aislar un subárbol solo hay sus etapas', () => {
    const d = doc();
    const C = d.raiz.hijos[0];
    const tl = buildTimeline(d, C.hijos[0].id); // el subárbol A (un solo nodo interno)
    expect(tl.stages).toHaveLength(1);
  });
});

describe('validate', () => {
  it.skipIf(!legacyFiles().length)('los ejercicios viejos importan sin errores graves de esquema', () => {
    for (const f of legacyFiles()) {
      const d = importLegacy(JSON.parse(readFileSync(f, 'utf8')));
      const v = validate(d);
      expect(v.singular, f).toEqual([]);
    }
  });
});

// ---------- generador ----------

import { DIFICULTADES, generate } from '../src/core/generator.js';
import { allPolygons } from '../src/core/evaluate.js';

describe('generator', () => {
  it('es reproducible con la misma semilla', () => {
    const a = generate({ seed: 7 });
    const b = generate({ seed: 7 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(generate({ seed: 8 }))).not.toBe(JSON.stringify(a));
  });

  it('200 semillas: siempre válido, sin superposición y dentro de la grilla', { timeout: 60000 }, () => {
    for (let seed = 1; seed <= 200; seed++) {
      const dif = DIFICULTADES[seed % 3];
      const doc = generate({ seed, dificultad: dif });
      expect(validateSchema(doc), `seed ${seed}`).toEqual([]);
      const v = validate(doc);
      expect(v.ok, `seed ${seed} ${dif}`).toBe(true);
      const polys = allPolygons(doc);
      expect(polys.length).toBeGreaterThanOrEqual(3);
      expect(findOverlaps(polys), `seed ${seed}`).toHaveLength(0);
      expect(outsideGrid(polys, doc.grilla, 5), `seed ${seed}`).toEqual([]);
    }
  });

  it('la dificultad alta exige rotación tras traslación, espejado y escala no uniforme', () => {
    const doc = generate({ seed: 3, dificultad: 'dificil' });
    const flat = [];
    const rec = (n) => { flat.push(n); n.hijos.forEach(rec); };
    rec(doc.raiz);
    const ops = flat.flatMap((n) => n.t ?? []);
    expect(ops.some((o) => o.op === 'E' && (o.x < 0 || o.y < 0))).toBe(true);
    expect(ops.some((o) => o.op === 'E' && Math.abs(o.x) !== Math.abs(o.y))).toBe(true);
  });
});
