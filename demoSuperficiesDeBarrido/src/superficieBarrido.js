import * as THREE from 'three';

// Rows follow the path; columns include the shape's seam sample.
export function createSweep(shape, path) {
 const rows = path.matricesVertices.length, columns = shape.posiciones.length;
 const positions = new Float32Array(rows * columns * 3);
 const normals = new Float32Array(positions.length);
 const uvs = new Float32Array(rows * columns * 2);
 const indices = [], triangles = [];
 for (let row = 0; row < rows; row++) {
  for (let column = 0; column < columns; column++) {
   const id = row * columns + column, p = shape.posiciones[column], n = shape.normales[column];
   new THREE.Vector3(p.x, p.y, 0).applyMatrix4(path.matricesVertices[row]).toArray(positions, id * 3);
   new THREE.Vector3(n.x, n.y, 0).transformDirection(path.matricesNormales[row]).toArray(normals, id * 3);
   uvs[id * 2] = row / rows;
   uvs[id * 2 + 1] = column / (columns - 1);
   if (row === rows - 1 || column === columns - 1) continue;
   const a = id, b = id + 1, c = id + columns, d = c + 1;
   const quadTriangles = shape.reverseWinding ? [[a, b, c], [b, d, c]] : [[a, c, b], [b, c, d]];
   for (const vertices of quadTriangles) {
    triangles.push({ id: triangles.length, row, column, half: triangles.length % 2, vertices });
    indices.push(...vertices);
   }
  }
 }
 const geometry = new THREE.BufferGeometry();
 geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
 geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
 geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
 geometry.setIndex(indices);
 geometry.computeBoundingBox();
 geometry.computeBoundingSphere();
 geometry.setDrawRange(0, 0);
 return { geometry, rows, columns, positions, triangles, indices: geometry.index.array };
}

export class SweepPlayback {
 constructor(total, columns) { this.total = total; this.columns = columns; this.reset(); }
 reset() { this.progress = 0; this.count = 0; this.hold = 0; }
 advance(delta, speed) {
  if (speed <= 0) return false;
  if (this.count === this.total) {
   this.hold += delta;
   if (this.hold >= 1) { this.reset(); return true; }
   return false;
  }
  this.progress += delta * speed * 0.2 * (this.columns - 1);
  this.count = Math.min(this.total, Math.floor(this.progress));
  return false;
 }
}

