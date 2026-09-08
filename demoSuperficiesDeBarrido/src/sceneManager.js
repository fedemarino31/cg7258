import * as THREE from 'three';
import { aplicarTorsion, getPathCirculo, getPathHelice, getPathLinea, getPathRectangular } from './paths.js';
import { getCirculo, getPerfilCilindro, getPerfilCopaChampagne, getSemicirculoEsfera, getShapePivot, getShape } from './shapes.js';
import { createSweep, SweepPlayback } from './superficieBarrido.js';

export class SceneManager {
 isPlaying = true;
 speed = 5;
 torsion = 0;
 shapeType = 'circulo';
 pathType = 'helice';
 sampling = { segmentsU: 24, segmentsV: 16 };
 pathParams = { radio: 6, paso: 30, height: 30, longitud: 30, ancho: 20, largo: 30 };
 materialType = 'uv';
 materialSide = 'double';
 helpers = { normalLength: 0.8, vertexRadius: 0.08 };
 selectionEnabled = false;
 selected = null;
 visibility = { vertices: true, normals: true, shapes: true, path: true, matrices: true, grid: true, directionalLight: true };
 constructor(scene) {
  this.scene = scene;
  const textureLoader = new THREE.TextureLoader();
  const uvTextureReady = new Promise(resolve => {
   this.texture = textureLoader.load(new URL('../maps/uv.jpg', import.meta.url).href, () => {
    if (this.onTextureLoad) this.onTextureLoad();
    resolve();
   }, undefined, resolve);
  });
  const earthTextureReady = new Promise(resolve => {
   this.earthTexture = textureLoader.load(new URL('../maps/earth.jpg', import.meta.url).href, resolve, undefined, resolve);
  });
  this.texture.colorSpace = THREE.SRGBColorSpace;
  this.texture.wrapS = this.texture.wrapT = THREE.RepeatWrapping;
  this.earthTexture.colorSpace = THREE.SRGBColorSpace;
  this.earthTexture.wrapS = this.earthTexture.wrapT = THREE.RepeatWrapping;
  this.textureReady = Promise.all([uvTextureReady, earthTextureReady]);
  this.buildScene();
 }
 buildScene() {
  if (this.root) {
   this.scene.remove(this.root);
   const geometries = new Set(), materials = new Set();
   this.root.traverse(o => {
    if (o.geometry) geometries.add(o.geometry);
    if (o.material) materials.add(o.material);
   });
   geometries.forEach(g => g.dispose());
   materials.forEach(m => m.dispose());
  }
  this.root = new THREE.Group();
  this.scene.add(this.root);
  const shapeRadius = 3;
  const shapeId = 'letra' + this.shapeType.toUpperCase();
  const shapeTransform = {
   flipHorizontal: this.shapeType === 'c' || this.shapeType === 'g',
   invertNormals: this.shapeType === 'c'
  };
  const revolutionProfile = ['copaChampagne', 'semicirculoEsfera', 'cilindro'].includes(this.shapeType);
  const shape = this.shapeType === 'circulo' ? getCirculo(shapeRadius, this.sampling.segmentsU)
   : this.shapeType === 'copaChampagne' ? getPerfilCopaChampagne(this.sampling.segmentsU, this.pathParams.radio)
   : this.shapeType === 'semicirculoEsfera' ? getSemicirculoEsfera(this.sampling.segmentsU, this.pathParams.radio)
   : this.shapeType === 'cilindro' ? getPerfilCilindro(this.pathParams.radio)
   : getShape(shapeId, this.sampling.segmentsU, getShapePivot(shapeId), 0.1, 1, shapeTransform);
  this.shape = shape;
  // Perfil de referencia: no interviene en la superficie, sólo muestra la curva analítica en 2D.
  this.analyticShape = this.shapeType === 'circulo' ? getCirculo(shapeRadius, 360)
   : this.shapeType === 'copaChampagne' ? getPerfilCopaChampagne(360, this.pathParams.radio)
   : this.shapeType === 'semicirculoEsfera' ? getSemicirculoEsfera(360, this.pathParams.radio)
   : this.shapeType === 'cilindro' ? getPerfilCilindro(this.pathParams.radio)
   : getShape(shapeId, 360, getShapePivot(shapeId), 0.1, 1, shapeTransform);
  const vueltas = this.pathParams.height / this.pathParams.paso;
  const path = this.pathType === 'helice' ? getPathHelice(this.pathParams.radio, this.pathParams.paso, vueltas, Math.max(1, this.sampling.segmentsV / vueltas))
   : this.pathType === 'linea' ? getPathLinea(this.sampling.segmentsV, this.pathParams.longitud) : this.pathType === 'rectangular' ? getPathRectangular(this.pathParams.ancho, this.pathParams.largo, this.sampling.segmentsV) : getPathCirculo(this.pathParams.radio, this.sampling.segmentsV, revolutionProfile);
  // El path línea conserva la misma altura base para todos los shapes.
  if (this.pathType === 'linea') path.matricesVertices.forEach(matrix => { matrix.elements[13] += shapeRadius * 1.5; });
  aplicarTorsion(path, this.torsion);
  this.model = createSweep(shape, path);
  this.model.textureImage = this.texture.image;
  this.playback = new SweepPlayback(this.model.triangles.length, this.model.columns);
  this.mesh = new THREE.Mesh(this.model.geometry, this.createMaterial());
  this.root.add(this.mesh);
  this.updateWireframe();
  // Independent index/range, sharing immutable vertex buffers.
  const activeGeometry = new THREE.BufferGeometry();
  activeGeometry.setAttribute('position', this.model.geometry.attributes.position);
  activeGeometry.setIndex(this.model.geometry.index);
  this.active = new THREE.Mesh(activeGeometry, new THREE.MeshBasicMaterial({
   color: 0xf2c892, transparent: true, opacity: 0.25, side: THREE.DoubleSide,
   polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, depthWrite: false
  }));
  this.root.add(this.active);
  const selectionGeometry = new THREE.BufferGeometry();
  selectionGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  this.highlight = new THREE.Mesh(selectionGeometry, new THREE.MeshBasicMaterial({
   color: 0xffffff, side: THREE.DoubleSide, depthTest: false, depthWrite: false,
   transparent: true, opacity: 0.85
  }));
  this.highlight.renderOrder = 10;
  this.root.add(this.highlight);
  this.levels = [];
  const pointMaterial = new THREE.MeshBasicMaterial({ color: 0xffDD00 });
  const sphereGeometry = new THREE.SphereGeometry(this.helpers.vertexRadius, 8, 6);
  const normalMaterial = new THREE.LineBasicMaterial({ color: 0x438bce });
  const shapeMaterial = new THREE.LineBasicMaterial({ color: 0xd67d42 });
  for (let row = 0; row < this.model.rows; row++) {
   const points = [], normalPoints = [], normalDirections = [];
   for (let col = 0; col < this.model.columns; col++) {
    const id = row * this.model.columns + col;
    const p = new THREE.Vector3().fromArray(this.model.positions, id * 3);
    const n = new THREE.Vector3().fromBufferAttribute(this.model.geometry.attributes.normal, id);
    points.push(p);
    normalPoints.push(p, p.clone().addScaledVector(n, this.helpers.normalLength));
    normalDirections.push(n.clone().normalize());
   }
   const geometry = new THREE.BufferGeometry().setFromPoints(points);
   const vertices = new THREE.Group();
   points.forEach(p => { const sphere = new THREE.Mesh(sphereGeometry, pointMaterial); sphere.position.copy(p); vertices.add(sphere); });
   const normals = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(normalPoints), normalMaterial);
   const shapes = new THREE.Line(geometry, shapeMaterial);
   const matrices = new THREE.AxesHelper(1.2);
   matrices.matrixAutoUpdate = false;
   matrices.matrix.copy(path.matricesVertices[row]);
   this.root.add(vertices, normals, shapes, matrices);
   this.levels.push({ vertices, normals, shapes, matrices, normalDirections });
  }
  this.pathLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(
   path.matricesVertices.map(m => new THREE.Vector3().setFromMatrixPosition(m))
  ), new THREE.LineBasicMaterial({ color: 0x586875 }));
  this.root.add(this.pathLine);
  this.select(null);
  this.updateVisibility();
  this.updateRange();
 }
 get count() { return this.playback.count; }
 select(id) {
  this.selected = id !== null && id >= 0 && id < this.count ? this.model.triangles[id] : null;
  this.highlight.visible = !!this.selected;
  if (this.selected) {
   const attribute = this.highlight.geometry.attributes.position;
   this.selected.vertices.forEach((v, i) => attribute.array.set(this.model.positions.subarray(v * 3, v * 3 + 3), i * 3));
   attribute.needsUpdate = true;
   this.highlight.geometry.computeBoundingSphere();
  }
 }
 updateVisibility() {
  const perRow = 2 * (this.model.columns - 1);
  const reached = this.count === 0 ? 0 : Math.min(this.model.rows - 1, Math.ceil(this.count / perRow));
  this.levels.forEach((level, row) => {
   for (const key of ['vertices', 'normals', 'shapes', 'matrices']) level[key].visible = row <= reached && this.visibility[key];
   const matrix = level.matrices.matrix.clone(); matrix.decompose(level.matrices.position, level.matrices.quaternion, level.matrices.scale); level.matrices.updateMatrix(); level.matrices.matrixAutoUpdate = false;
   level.matrices.scale.setScalar(row === reached ? 1.8 : 1.2); level.matrices.updateMatrix();
  });
  this.pathLine.visible = this.visibility.path;
 }
 updateRange() {
  this.model.geometry.setDrawRange(0, this.count * 3);
  const perRow = 2 * (this.model.columns - 1);
  const start = Math.floor(this.count / perRow) * perRow;
  this.active.geometry.setDrawRange(start * 3, (this.count - start) * 3);
  this.updateVisibility();
 }
 animate(delta) {
  if (!this.isPlaying) return false;
  const previous = this.count;
  if (this.playback.advance(delta, this.speed)) this.select(null);
  if (previous === this.count) return false;
  this.updateRange();
  return true;
 }
 setProgress(value) { this.playback.count = Math.max(0, Math.min(this.playback.total, Math.round(value * this.playback.total))); this.playback.progress = this.playback.count; this.updateRange(); this.select(null); }
 createMaterial() {
  const side = this.materialSide === 'front' ? THREE.FrontSide : this.materialSide === 'back' ? THREE.BackSide : THREE.DoubleSide;
  if (this.materialType === 'uv') return new THREE.MeshPhongMaterial({ color: 0xffffff, map: this.texture, side, transparent: false, opacity: 1, shininess: 32 });
  if (this.materialType === 'earth') return new THREE.MeshPhongMaterial({ color: 0xffffff, map: this.earthTexture, side, transparent: false, opacity: 1, shininess: 32 });
  if (this.materialType === 'phong') return new THREE.MeshPhongMaterial({ color: 0x888888, side, shininess: 64, specular: 0xffffff });
  return new THREE.MeshBasicMaterial({ color: 0xe98532, transparent: true, opacity: 0.5, side });
 }
 updateWireframe() {
  if (this.wire) { this.root.remove(this.wire); this.wire.geometry.dispose(); this.wire.material.dispose(); this.wire = null; }
  if (this.materialType === 'basic') { this.wire = new THREE.LineSegments(new THREE.EdgesGeometry(this.model.geometry), new THREE.LineBasicMaterial({ color: 0x111111 })); this.root.add(this.wire); }
 }
 setMaterial(type) { this.materialType = type; const previous = this.mesh.material; this.mesh.material = this.createMaterial(); previous.dispose(); this.updateWireframe(); }
 setMaterialSide(side) { this.materialSide = side; const previous = this.mesh.material; this.mesh.material = this.createMaterial(); previous.dispose(); this.updateWireframe(); }
 updateHelpers() {
  this.levels.forEach(level => {
   const attribute = level.normals.geometry.attributes.position;
   level.normalDirections.forEach((direction, index) => {
    const offset = index * 6;
    const x = attribute.array[offset], y = attribute.array[offset + 1], z = attribute.array[offset + 2];
    attribute.array[offset + 3] = x + direction.x * this.helpers.normalLength;
    attribute.array[offset + 4] = y + direction.y * this.helpers.normalLength;
    attribute.array[offset + 5] = z + direction.z * this.helpers.normalLength;
   });
   attribute.needsUpdate = true;
   level.vertices.children.forEach(vertex => vertex.scale.setScalar(this.helpers.vertexRadius / 0.18));
  });
 }
}
