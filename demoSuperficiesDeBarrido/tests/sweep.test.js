import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSweep, SweepPlayback } from '../src/superficieBarrido.js';
import { getCirculo, getPerfilCilindro, getPerfilCopaChampagne, getSemicirculoEsfera } from '../src/shapes.js';
import { aplicarTorsion, getPathRectangular, getPathHelice, getPathLinea, getPathCirculo } from '../src/paths.js';

for (const [name, path] of Object.entries({
 helice: getPathHelice(6, 30, 1.5, 16),
 linea: getPathLinea(10, 30),
 circulo: getPathCirculo(10, 16),
})) {
 test(name + ': valid topology, normals, winding and seam', () => {
  const model = createSweep(getCirculo(3, 24), path);
  const { rows, columns, geometry, triangles, indices, positions } = model;
  assert.equal(geometry.attributes.position.count, rows * columns);
  assert.equal(triangles.length, 2 * (rows - 1) * (columns - 1));
  assert.equal(indices.length, triangles.length * 3);
  assert.ok(Array.from(positions).every(Number.isFinite));
  assert.ok(Array.from(geometry.attributes.normal.array).every(Number.isFinite));
  for (const t of triangles) {
   assert.equal(t.id, 2 * (t.row * (columns - 1) + t.column) + t.half);
   assert.deepEqual(Array.from(indices.slice(t.id * 3, t.id * 3 + 3)), t.vertices);
   assert.equal(new Set(t.vertices).size, 3);
   t.vertices.forEach(v => {
    assert.ok(v >= 0 && v < rows * columns);
    assert.ok([t.row, t.row + 1].includes(Math.floor(v / columns)));
    assert.ok([t.column, t.column + 1].includes(v % columns));
   });
   const [a, b, c] = t.vertices.map(v => new THREE.Vector3().fromArray(positions, v * 3));
   assert.ok(b.sub(a).cross(c.sub(a)).length() > 1e-6);
  }
  for (let r = 0; r < rows; r++) {
   const a = new THREE.Vector3().fromArray(positions, r * columns * 3);
   const b = new THREE.Vector3().fromArray(positions, (r * columns + columns - 1) * 3);
   assert.ok(a.distanceTo(b) < 1e-5);
  }
  geometry.dispose();
 });
}
test('playback: individual triangles, zero speed, complete hold and loop', () => {
 const playback = new SweepPlayback(12, 4);
 playback.advance(1, 0);
 assert.equal(playback.count, 0);
 playback.advance(1 / 3 + 0.00001, 5);
 assert.equal(playback.count, 1);
 playback.advance(10, 5);
 assert.equal(playback.count, 12);
 assert.equal(playback.advance(0.9, 5), false);
 assert.equal(playback.count, 12);
 assert.equal(playback.advance(0.1, 5), true);
 assert.equal(playback.count, 0);
});
test('raycasting only hits generated triangles and retains their IDs', () => {
 const shape = getCirculo(3, 4), path = getPathLinea(3, 10);
 const model = createSweep(shape, path);
 const mesh = new THREE.Mesh(model.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
 const triangle = model.triangles[1];
 const [a, b, c] = triangle.vertices.map(v => new THREE.Vector3().fromArray(model.positions, v * 3));
 const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
 const center = a.clone().add(b).add(c).divideScalar(3);
 const ray = new THREE.Raycaster(center.clone().addScaledVector(normal, 0.1), normal.clone().negate());
 model.geometry.setDrawRange(0, 3);
 assert.ok(!ray.intersectObject(mesh).some(hit => hit.faceIndex === 1));
 model.geometry.setDrawRange(0, 6);
 assert.equal(ray.intersectObject(mesh)[0].faceIndex, 1);
 model.geometry.dispose(); mesh.material.dispose();
});
test('champagne profile is open and produces a valid revolution with a circular path', () => {
 const shape = getPerfilCopaChampagne(24, 6);
 assert.equal(shape.closed, false);
 assert.equal(shape.posiciones.length, 25);
 assert.ok(shape.posiciones.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
 assert.ok(shape.normales.every(n => Math.abs(n.length() - 1) < 1e-6));
 assert.deepEqual(shape.posiciones[0].toArray(), [-6, 0]);
 assert.ok(shape.posiciones.at(-1).distanceTo(new THREE.Vector2(-6, 8.2)) < 1e-12);
 const model = createSweep(shape, getPathCirculo(6, 24, true));
 assert.ok(model.triangles.length > 0);
 assert.ok(Array.from(model.geometry.attributes.normal.array).every(Number.isFinite));
 model.geometry.dispose();
});
test('sphere semicircle and three-segment cylinder are valid revolution profiles', () => {
 const semicirculo = getSemicirculoEsfera(24, 6);
 const cilindro = getPerfilCilindro(6);
 assert.equal(semicirculo.closed, false);
 assert.deepEqual(semicirculo.posiciones[0].toArray(), [-6, 0]);
 assert.equal(Math.max(...semicirculo.posiciones.map(p => p.x)), 0);
 assert.equal(cilindro.posiciones.length, 4);
 assert.deepEqual(cilindro.posiciones[0].toArray(), [-6, 0]);
 assert.deepEqual(cilindro.posiciones[1].toArray(), [0, 0]);
 assert.deepEqual(cilindro.posiciones[2].toArray(), [0, 12]);
 for (const shape of [semicirculo, cilindro]) {
  const model = createSweep(shape, getPathCirculo(6, 24, true));
  assert.ok(model.triangles.length > 0);
  assert.ok(Array.from(model.geometry.attributes.normal.array).every(Number.isFinite));
  for (const triangle of model.triangles) {
   const [a, b, c] = triangle.vertices.map(vertex => new THREE.Vector3().fromArray(model.positions, vertex * 3));
   const geometricNormal = b.sub(a).cross(c.sub(a));
   if (geometricNormal.lengthSq() < 1e-8) continue;
   const vertexNormal = triangle.vertices.reduce((sum, vertex) => sum.add(new THREE.Vector3().fromBufferAttribute(model.geometry.attributes.normal, vertex)), new THREE.Vector3()).normalize();
   assert.ok(geometricNormal.normalize().dot(vertexNormal) > 0, 'winding must agree with exterior normals');
  }
  model.geometry.dispose();
 }
});


test('rectangular path and sweep close at the initial level', () => {
 const path = getPathRectangular(20, 30, 16);
 assert.equal(path.matricesVertices.length, 17);
 assert.deepEqual(path.matricesVertices.at(-1).elements, path.matricesVertices[0].elements);
 assert.deepEqual(path.matricesNormales.at(-1).elements, path.matricesNormales[0].elements);
 for (const turns of [0, 1, 4]) {
  const model = createSweep(getCirculo(3, 24), aplicarTorsion(getPathRectangular(20, 30, 16), turns));
  for (let col = 0; col < model.columns; col++) {
   const first = new THREE.Vector3().fromArray(model.positions, col * 3);
   const last = new THREE.Vector3().fromArray(model.positions, ((model.rows - 1) * model.columns + col) * 3);
   assert.ok(first.distanceTo(last) < 1e-5);
  }
  model.geometry.dispose();
 }
});

test('torsion follows distance and rotates profile and normals without moving the path', () => {
 const path = {
  matricesVertices: [0, 1, 4].map(z => new THREE.Matrix4().makeTranslation(0, 0, z)),
  matricesNormales: [0, 1, 4].map(() => new THREE.Matrix4()),
 };
 const original = path.matricesVertices.map(m => m.elements.slice());
 aplicarTorsion(path, 0);
 assert.deepEqual(path.matricesVertices.map(m => m.elements), original);
 aplicarTorsion(path, 0.5);
 const shape = { posiciones: [new THREE.Vector2(1, 0), new THREE.Vector2(2, 0)], normales: [new THREE.Vector2(1, 0), new THREE.Vector2(1, 0)] };
 const model = createSweep(shape, path);
 const expected = [[1, 0, 0], [Math.SQRT1_2, Math.SQRT1_2, 1], [-1, 0, 4]];
 expected.forEach((point, row) => {
  assert.ok(new THREE.Vector3().fromArray(model.positions, row * model.columns * 3).distanceTo(new THREE.Vector3(...point)) < 1e-6);
  const normal = new THREE.Vector3().fromBufferAttribute(model.geometry.attributes.normal, row * model.columns);
  assert.ok(normal.distanceTo(new THREE.Vector3(point[0], point[1], 0)) < 1e-6);
  assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(path.matricesVertices[row]).toArray(), [0, 0, point[2]]);
 });
 model.geometry.dispose();
});
