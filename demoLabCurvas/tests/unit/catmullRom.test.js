import { describe, expect, it } from 'vitest';
import { analyzeJoin, derivative, evaluate } from '../../src/math/bezier.js';
import { barryGoldmanLevels, catmullRomToBezier, catmullRomWeights, knotIntervals } from '../../src/math/catmullRom.js';
import { createScene, hydrateScene } from '../../src/model/defaults.js';
import { addDraftPoint, crRuns, deleteSelection, extendEndsSelected, insertCatmullRomPoint, isClosedSequence, toggleClosedSelected } from '../../src/model/store.js';
import { validateScene } from '../../src/model/validation.js';
import { builtInExamples } from '../../src/model/examples.js';
import { joinsFor } from '../../src/render/svgScene.js';

const closePoint = (actual, expected, digits = 10) => { expect(actual.x).toBeCloseTo(expected.x, digits); expect(actual.y).toBeCloseTo(expected.y, digits); };
const P = [[0, 0], [1, 2], [3, 2.5], [4, 0], [6, 1]].map(([x, y]) => ({ x, y }));

describe('tramo Catmull-Rom', () => {
  it('interpola P1 en u=0 y P2 en u=1 para cualquier α y τ', () => {
    for (const alpha of [0, .5, 1]) for (const tension of [-.5, 0, .5, 1]) { const b = catmullRomToBezier(P.slice(0, 4), { alpha, tension }); closePoint(evaluate(b, 0), P[1]); closePoint(evaluate(b, 1), P[2]); }
  });
  it('la tangente uniforme es (1-τ)(P2-P0)/2', () => {
    for (const tension of [0, .3]) { const b = catmullRomToBezier(P.slice(0, 4), { alpha: 0, tension }); closePoint(derivative(b, 0, 1), { x: (1 - tension) * (P[2].x - P[0].x) / 2, y: (1 - tension) * (P[2].y - P[0].y) / 2 }); }
  });
  it('la Bézier equivalente coincide con Barry-Goldman en 101 muestras', () => {
    for (const alpha of [0, .5, 1]) { const b = catmullRomToBezier(P.slice(0, 4), { alpha, tension: 0 }); for (let i = 0; i <= 100; i += 1) closePoint(evaluate(b, i / 100), barryGoldmanLevels(P.slice(0, 4), i / 100, { alpha }).at(-1)[0], 9); }
  });
  it('los pesos suman uno, pueden ser negativos y reproducen la curva', () => {
    let negative = false;
    for (const alpha of [0, .5, 1]) for (let i = 0; i <= 100; i += 1) {
      const u = i / 100, w = catmullRomWeights(P.slice(0, 4), u, { alpha, tension: .2 }); expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12); negative ||= Math.min(...w) < 0;
      const combo = w.reduce((r, wi, j) => ({ x: r.x + wi * P[j].x, y: r.y + wi * P[j].y }), { x: 0, y: 0 }); closePoint(combo, evaluate(catmullRomToBezier(P.slice(0, 4), { alpha, tension: .2 }), u), 10);
    }
    expect(negative).toBe(true);
  });
  it('tolera puntos coincidentes sin NaN', () => {
    const same = [P[0], P[0], P[1], P[1]];
    for (const alpha of [0, .5, 1]) catmullRomToBezier(same, { alpha, tension: 0 }).forEach((p) => { expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true); });
  });
  it('tramos consecutivos son C1 en local (α=0) y en global con h = intervalo nodal (α>0)', () => {
    const a = P.slice(0, 4), b = P.slice(1, 5);
    const uniform = analyzeJoin({ points: catmullRomToBezier(a, { alpha: 0 }), duration: 1 }, { points: catmullRomToBezier(b, { alpha: 0 }), duration: 1 });
    expect(uniform).toMatchObject({ c0: true, g1: true, c1: true, c2: false });
    const ha = knotIntervals(a, .5)[1], hb = knotIntervals(b, .5)[1];
    const centripetal = analyzeJoin({ points: catmullRomToBezier(a, { alpha: .5 }), duration: ha }, { points: catmullRomToBezier(b, { alpha: .5 }), duration: hb }, 'global');
    expect(centripetal).toMatchObject({ c0: true, g1: true, c1: true });
  });
});

function crScene(coords, mode = 'chained') {
  const scene = createScene('CR'); Object.assign(scene.presentation.settings, { creationCurveType: 'catmullRom', creationMode: mode, creationAlpha: .5, creationTension: 0 });
  coords.forEach(([x, y]) => addDraftPoint(scene, { x, y })); return scene;
}

describe('cadenas Catmull-Rom', () => {
  it('en modo encadenado cada clic desde el cuarto agrega un tramo', () => {
    const scene = crScene([[0, 0], [1, 1], [2, 0], [3, 1], [4, 0], [5, 1]]);
    expect(scene.geometry.segments).toHaveLength(3); expect(scene.geometry.drafts).toHaveLength(0); expect(scene.geometry.points).toHaveLength(6);
    const runs = crRuns(scene, scene.geometry.chains[0]); expect(runs).toHaveLength(1); expect(runs[0].sequence).toHaveLength(6);
    expect(() => validateScene(scene)).not.toThrow();
  });
  it('en modo independiente consume grupos de 4 puntos', () => {
    const scene = crScene([[0, 0], [1, 1], [2, 0], [3, 1], [4, 0], [5, 1]], 'independent');
    expect(scene.geometry.segments).toHaveLength(1); expect(scene.geometry.drafts[0].pointIds).toHaveLength(2);
  });
  it('cierra, abre, inserta, extiende y borra regenerando los tramos', () => {
    const scene = crScene([[0, 0], [1, 1], [2, 0], [3, 1], [4, 0]]); const chain = scene.geometry.chains[0]; scene.presentation.selection.segmentId = chain.segmentIds[0];
    toggleClosedSelected(scene); let run = crRuns(scene, chain)[0]; expect(isClosedSequence(run.sequence)).toBe(true); expect(scene.geometry.segments).toHaveLength(5);
    scene.presentation.playhead.u = .5; insertCatmullRomPoint(scene); run = crRuns(scene, chain)[0]; expect(run.segments).toHaveLength(6); expect(isClosedSequence(run.sequence)).toBe(true);
    toggleClosedSelected(scene); expect(scene.geometry.segments).toHaveLength(3);
    extendEndsSelected(scene, 'reflect'); expect(scene.geometry.segments).toHaveLength(5); expect(scene.geometry.points).toHaveLength(8);
    scene.presentation.selection.pointIds = [crRuns(scene, chain)[0].sequence[3]]; deleteSelection(scene);
    expect(scene.geometry.segments).toHaveLength(4); expect(crRuns(scene, chain)).toHaveLength(1);
    expect(() => validateScene(scene)).not.toThrow();
  });
});

describe('catálogo Catmull-Rom', () => {
  const examples = builtInExamples(); const byId = (id) => hydrateScene(structuredClone(examples.find((e) => e.id === id).scene));
  it('todas las escenas del catálogo son válidas', () => { for (const entry of examples) expect(() => validateScene(entry.scene), entry.id).not.toThrow(); });
  it('cumple los resultados esperados de continuidad', () => {
    const results = (id) => joinsFor(byId(id)).map((j) => j.result);
    results('22-cr-cadena').forEach((r) => expect(r).toMatchObject({ c0: true, c1: true }));
    expect(results('29-cr-c1-sin-c2')[0]).toMatchObject({ c0: true, g1: true, c1: true, c2: false });
    expect(results('30-cr-tension-mixta')[0]).toMatchObject({ c0: true, g1: true, c1: false });
    results('31-cr-nodos').forEach((r) => expect(r).toMatchObject({ c1: true }));
    const local = byId('31-cr-nodos'); local.presentation.settings.continuityMode = 'local'; expect(joinsFor(local).some((j) => !j.result.c1)).toBe(true);
    expect(results('32-mixta-bezier-cr')[0]).toMatchObject({ c0: true, g1: true, c1: false });
  });
});
