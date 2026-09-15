import { describe, expect, it } from 'vitest';
import { analyzeJoin, arcLengthTable, bernstein, casteljauLevels, curvatureFrame, derivative, elevateDegree, evaluate, sampleUniform, split } from '../../src/math/bezier.js';
import { applyConstraints } from '../../src/model/store.js';

const closePoint = (actual, expected, digits = 10) => { expect(actual.x).toBeCloseTo(expected.x, digits); expect(actual.y).toBeCloseTo(expected.y, digits); };

describe('evaluación Bézier', () => {
  it('coincide Bernstein con De Casteljau para grados 1 a 3', () => {
    const sets = [[{ x: 0, y: 0 }, { x: 4, y: 2 }], [{ x: 0, y: 0 }, { x: 2, y: 3 }, { x: 4, y: 0 }], [{ x: 0, y: 0 }, { x: 1, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 0 }]];
    for (const points of sets) for (const u of [0, .13, .5, .87, 1]) closePoint(evaluate(points, u), casteljauLevels(points, u).at(-1)[0]);
  });
  it('las bases suman uno y no son negativas', () => { for (let n = 1; n <= 3; n += 1) for (let k = 0; k <= 100; k += 1) { const b = bernstein(n, k / 100); expect(b.reduce((a, x) => a + x, 0)).toBeCloseTo(1, 14); expect(Math.min(...b)).toBeGreaterThanOrEqual(0); } });
  it('resuelve los valores exactos lineal, cuadrático y cúbico', () => {
    closePoint(derivative([{ x: 0, y: 0 }, { x: 4, y: 2 }], .3, 1), { x: 4, y: 2 });
    const q = [{ x: 0, y: 0 }, { x: 2, y: 3 }, { x: 4, y: 0 }]; closePoint(evaluate(q, .5), { x: 2, y: 1.5 }); closePoint(derivative(q, .5, 1), { x: 4, y: 0 }); closePoint(derivative(q, .5, 2), { x: 0, y: -12 });
    const c = [{ x: 0, y: 0 }, { x: 1, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 0 }]; closePoint(evaluate(c, .5), { x: 2, y: 2.25 }); closePoint(derivative(c, .5, 1), { x: 4.5, y: 0 }); closePoint(derivative(c, .5, 2), { x: 0, y: -18 });
  });
});

describe('operaciones exactas', () => {
  const source = [{ x: 0, y: 0 }, { x: 1, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 0 }];
  it('split conserva la curva en 101 muestras', () => { const cut = .25, halves = split(source, cut); for (let i = 0; i <= 100; i += 1) { const u = i / 100; closePoint(evaluate(source, u), u <= cut ? evaluate(halves.left, u / cut) : evaluate(halves.right, (u - cut) / (1 - cut)), 9); } });
  it('elevación conserva la curva', () => { const q = [{ x: 0, y: 0 }, { x: 2, y: 3 }, { x: 4, y: 0 }], elevated = elevateDegree(q); for (let i = 0; i <= 100; i += 1) closePoint(evaluate(q, i / 100), evaluate(elevated, i / 100), 10); });
  it('muestreo uniforme tiene N aristas', () => expect(sampleUniform(source, 4)).toHaveLength(5));
});

describe('marco y continuidad', () => {
  it('obtiene el círculo osculador cuadrático esperado', () => { const f = curvatureFrame([{ x: 0, y: 0 }, { x: 2, y: 3 }, { x: 4, y: 0 }], .5); expect(f.curvature).toBeCloseTo(.75, 12); expect(f.radius).toBeCloseTo(4 / 3, 12); closePoint(f.center, { x: 2, y: 1 / 6 }, 10); });
  it('maneja cúspide y curva constante sin NaN', () => { const cusp = curvatureFrame([{ x: .25, y: -.125 }, { x: -1 / 12, y: .125 }, { x: -1 / 12, y: -.125 }, { x: .25, y: .125 }], .5); expect(cusp.defined).toBe(false); const constant = [{ x: 2, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 1 }]; expect(arcLengthTable(constant).length).toBe(0); });
  it('distingue C0, G1, C1 y C2', () => { const A = [{ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 0 }]; const B = [{ x: 3, y: 0 }, { x: 4, y: -2 }, { x: 5, y: -2 }, { x: 6, y: 0 }]; const result = analyzeJoin({ points: A, duration: 1 }, { points: B, duration: 1 }); expect(result).toMatchObject({ c0: true, g1: true, c1: true, c2: false }); const opposite = [{ x: 3, y: 0 }, { x: 2, y: 2 }, { x: 4, y: 3 }, { x: 6, y: 0 }]; expect(analyzeJoin({ points: A, duration: 1 }, { points: opposite, duration: 1 }).g1).toBe(false); });
});

describe('restricciones dirigidas', () => {
  it('propaga C2 cúbica a cúbica en coordenadas globales', () => {
    const points = [[0, 0], [1, 2], [2, 2], [3, 0], [3, 0], [4, 1], [5, 1], [6, 0]].map(([x, y], i) => ({ id: `p${i}`, x, y }));
    const scene = { geometry: { points, segments: [{ id: 'a', degree: 3, pointIds: ['p0', 'p1', 'p2', 'p3'], duration: 1 }, { id: 'b', degree: 3, pointIds: ['p4', 'p5', 'p6', 'p7'], duration: 2 }], chains: [{ id: 'c', segmentIds: ['a', 'b'] }], constraints: [{ id: 'k', leftSegmentId: 'a', rightSegmentId: 'b', type: 'C2', enabled: true, g1HandleLength: null }] } };
    applyConstraints(scene);
    const result = analyzeJoin({ points: points.slice(0, 4), duration: 1 }, { points: points.slice(4), duration: 2 }, 'global');
    expect(result).toMatchObject({ c0: true, c1: true, c2: true });
  });
});
