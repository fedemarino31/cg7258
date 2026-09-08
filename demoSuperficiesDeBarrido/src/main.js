import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { Pane } from 'tweakpane';
import { SceneManager } from './sceneManager.js';
import { TopologyView } from './topologyView.js';
import './style.css';

const viewport = document.getElementById('container3D');
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0xe8edf0);
viewport.appendChild(renderer.domElement);
renderer.domElement.setAttribute('aria-label', 'Superficie de barrido 3D');
const scene = new THREE.Scene();
const light = new THREE.DirectionalLight(0xffffff, 4);
light.position.set(0, 1, 0);
scene.add(light, light.target, new THREE.AmbientLight(0xaaaaaa, 1));
const grid = new THREE.GridHelper(100, 20, 0x9cabb6, 0xcbd4db);
scene.add(grid);
const manager = new SceneManager(scene);
const directionalLightHelper = new THREE.DirectionalLightHelper(light, 3, 0xedaa22);
directionalLightHelper.visible = manager.visibility.directionalLight;
scene.add(directionalLightHelper);
const topology = new TopologyView(document.getElementById('topology'), document.getElementById('triangle-info'));
manager.onTextureLoad = () => topology.draw(manager);
manager.topologyTexture = true;
const pageReady = document.readyState === 'complete'
 ? Promise.resolve()
 : new Promise(resolve => window.addEventListener('load', resolve, { once: true }));
Promise.all([pageReady, manager.textureReady]).then(() => {
 // Dos frames aseguran que el primer render ya esté disponible antes de revelar la UI.
 requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('app-loading')));
});
const shapeCanvas = document.getElementById('shape-view');
function drawShape() {
 const w = shapeCanvas.clientWidth, h = shapeCanvas.clientHeight;
 if (!w || !h || !manager.shape) return;
 const dpr = Math.min(window.devicePixelRatio || 1, 2);
 if (shapeCanvas.width !== Math.round(w * dpr) || shapeCanvas.height !== Math.round(h * dpr)) {
  shapeCanvas.width = Math.round(w * dpr); shapeCanvas.height = Math.round(h * dpr);
 }
 const ctx = shapeCanvas.getContext('2d'), values = manager.shape.posiciones, normals = manager.shape.normales, analyticValues = manager.analyticShape.posiciones;
 ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
 ctx.clearRect(0, 0, w, h);
 // El origen se incluye en el encuadre para mantener visibles los ejes, aun
 // cuando el perfil esté desplazado para una superficie de revolución.
 const minX = Math.min(0, ...values.map(p => p.x)), maxX = Math.max(0, ...values.map(p => p.x));
 const minY = Math.min(0, ...values.map(p => p.y)), maxY = Math.max(0, ...values.map(p => p.y));
 const spanX = Math.max(maxX - minX, 1e-6), spanY = Math.max(maxY - minY, 1e-6);
 const normalLength = Math.min(32, Math.max(16, Math.min((w - 40) / spanX, (h - 40) / spanY) * 0.35));
 // Espacio para la normal completa más 20 px hasta el borde del canvas.
 const shapeMargin = normalLength + 20;
 const scale = Math.min((w - 2 * shapeMargin) / spanX, (h - 2 * shapeMargin) / spanY), map = p => [w / 2 + (p.x - (minX + maxX) / 2) * scale, h / 2 - (p.y - (minY + maxY) / 2) * scale];
 const [originX, originY] = map(new THREE.Vector2(0, 0));
 // Ejes XY del espacio local del shape.
 ctx.strokeStyle = '#aebbc4'; ctx.fillStyle = '#62717c'; ctx.lineWidth = 1;
 ctx.beginPath(); ctx.moveTo(12, originY); ctx.lineTo(w - 12, originY); ctx.moveTo(originX, h - 12); ctx.lineTo(originX, 12); ctx.stroke();
 ctx.beginPath();
 ctx.moveTo(w - 12, originY); ctx.lineTo(w - 18, originY - 3); ctx.lineTo(w - 18, originY + 3);
 ctx.moveTo(originX, 12); ctx.lineTo(originX - 3, 18); ctx.lineTo(originX + 3, 18);
 ctx.stroke();
 ctx.font = '12px sans-serif'; ctx.fillText('X', w - 24, originY - 7); ctx.fillText('Y', originX + 7, 22);
 ctx.beginPath(); ctx.arc(originX, originY, 3, 0, Math.PI * 2); ctx.fill();
 ctx.fillText('(0, 0)', originX + 7, originY - 7);
 // Contorno de alta resolución: representa la forma continua que se está muestreando.
 ctx.beginPath(); analyticValues.forEach((p, i) => { const [x, y] = map(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
 if (manager.analyticShape.closed) ctx.closePath(); ctx.strokeStyle = '#c7d1d8'; ctx.lineWidth = 2; ctx.stroke();
 ctx.beginPath(); values.forEach((p, i) => { const [x, y] = map(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
 if (manager.shape.closed) ctx.closePath(); ctx.strokeStyle = '#607d8b'; ctx.lineWidth = 2; ctx.stroke();
 // Normales del perfil: se escalan con la vista para conservar una longitud legible.
 ctx.strokeStyle = '#438bce'; ctx.fillStyle = '#438bce'; ctx.lineWidth = 1.5;
 values.forEach((point, index) => {
  const normal = normals[index], [x, y] = map(point);
  const endX = x + normal.x * normalLength, endY = y - normal.y * normalLength;
  const angle = Math.atan2(endY - y, endX - x);
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(endX, endY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(endX, endY);
  ctx.lineTo(endX - 6 * Math.cos(angle - Math.PI / 6), endY - 6 * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(endX - 6 * Math.cos(angle + Math.PI / 6), endY - 6 * Math.sin(angle + Math.PI / 6));
  ctx.closePath(); ctx.fill();
 });
 const segmentCount = manager.shape.closed ? values.length : values.length - 1;
 const active = Math.min(segmentCount - 1, Math.floor(manager.count / 2) % segmentCount), next = (active + 1) % values.length;
 const [sx, sy] = map(values[active]), [ex, ey] = map(values[next]);
 ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.strokeStyle = '#edaa22'; ctx.lineWidth = 5; ctx.stroke();
 const [ax, ay] = [sx, sy];
 ctx.fillStyle = '#edaa22'; ctx.beginPath(); ctx.arc(ax, ay, 6, 0, Math.PI * 2); ctx.fill();
}
const perspective = new THREE.PerspectiveCamera(25, 1, 0.1, 1000);
const orthographic = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, perspective);
const smaaPass = new SMAAPass();
composer.addPass(renderPass);
composer.addPass(smaaPass);
let camera = perspective;
camera.position.set(-80, 30, 0);
const controls = new OrbitControls(camera, renderer.domElement);
const center = new THREE.Vector3();
manager.model.geometry.boundingBox.getCenter(center);
controls.target.copy(center);
camera.lookAt(center);
controls.update();
let orthoHeight = 40;
const options = { type: 'perspectiva', selection: false };
const playButton = document.getElementById('play');
const progress = document.getElementById('progress');
const progressFill = document.getElementById('progress-fill');
function refresh() {
 topology.draw(manager);
 drawShape();
 playButton.textContent = manager.isPlaying ? 'Ⅱ Pausar' : '▶ Reproducir';
 playButton.setAttribute('aria-label', manager.isPlaying ? 'Pausar animación' : 'Reproducir animación');
 progress.textContent = manager.count + ' / ' + manager.model.triangles.length + ' triángulos';
 progressFill.style.width = (manager.count / manager.model.triangles.length * 100) + '%';
}
document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => { document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab)); document.getElementById('topology-container').hidden = tab.dataset.tab !== 'topology-container'; document.getElementById('shape-container').hidden = tab.dataset.tab !== 'shape-container'; refresh(); }));
document.getElementById('topology-texture').addEventListener('change', event => { manager.topologyTexture = event.target.checked; topology.draw(manager); });
function resize() {
 const width = viewport.clientWidth, height = viewport.clientHeight;
 if (!width || !height) return;
 const aspect = width / height;
 perspective.aspect = aspect;
 perspective.updateProjectionMatrix();
 orthographic.left = -orthoHeight * aspect / 2;
 orthographic.right = orthoHeight * aspect / 2;
 orthographic.top = orthoHeight / 2;
 orthographic.bottom = -orthoHeight / 2;
 orthographic.updateProjectionMatrix();
 renderer.setSize(width, height);
 composer.setSize(width, height);
 refresh();
}
function fit(direction) {
 manager.model.geometry.boundingBox.getCenter(center);
 const radius = manager.model.geometry.boundingSphere.radius;
 const aspect = viewport.clientWidth / viewport.clientHeight;
 const halfFov = THREE.MathUtils.degToRad(perspective.fov / 2);
 const distance = radius / Math.sin(Math.min(halfFov, Math.atan(Math.tan(halfFov) * aspect))) * 1.12;
 controls.target.copy(center);
 camera.up.set(0, 1, 0);
 if (Math.abs(direction.clone().normalize().y) > 0.999) camera.up.set(0, 0, -1);
 camera.position.copy(center).addScaledVector(direction.clone().normalize(), distance);
 orthoHeight = radius * 2.24 / Math.min(1, aspect);
 camera.zoom = 1;
 resize();
 camera.lookAt(center);
 controls.update();
}
function setType(type) {
 const previous = camera;
 const distance = previous.position.distanceTo(controls.target);
 if (type === 'ortografica') {
  orthoHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2)) / perspective.zoom;
  camera = orthographic;
  camera.zoom = 1;
  camera.position.copy(previous.position);
 } else {
  const visibleHeight = orthoHeight / orthographic.zoom;
  camera = perspective;
  camera.zoom = 1;
  const direction = previous.position.clone().sub(controls.target).normalize();
  camera.position.copy(controls.target).addScaledVector(direction, visibleHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))));
 }
 camera.up.copy(previous.up);
 camera.quaternion.copy(previous.quaternion);
 controls.object = camera;
 renderPass.camera = camera;
 resize();
 controls.update();
}
const pane = new Pane({ title: 'Superficies de barrido', container: document.getElementById('menu') });
const surface = pane.addFolder({ title: 'Superficie' });
const rebuild = () => {
 manager.buildScene();
 topology.infoKey = null;
 manager.model.geometry.boundingBox.getCenter(center);
 controls.target.copy(center);
 camera.lookAt(center);
 controls.update();
 refresh();
};
surface.addBinding(manager, 'pathType', { label: 'Path', options: { Hélice: 'helice', Línea: 'linea', Círculo: 'circulo', Rectángulo: 'rectangular' } }).on('change', () => { rebuild(); configurePathFolder(); });
surface.addBinding(manager, 'shapeType', { label: 'Shape', options: { Círculo: 'circulo', 'Semicírculo': 'semicirculoEsfera', 'Rectangulo': 'cilindro', Copa: 'copaChampagne', X: 'x', Y: 'y', G: 'g', T: 't', C: 'c' } }).on('change', event => {
 if (['copaChampagne', 'semicirculoEsfera', 'cilindro'].includes(event.value) && manager.pathType !== 'circulo') {
  manager.pathType = 'circulo';
  surface.refresh();
  configurePathFolder();
 }
 rebuild();
});
surface.addBinding(manager, 'speed', { label: 'Velocidad', min: 0, max: 30, step: 0.1 });
surface.addBinding(manager.sampling, 'segmentsU', { label: 'Segmentos en U', min: 4, max: 96, step: 1 }).on('change', rebuild);
surface.addBinding(manager.sampling, 'segmentsV', { label: 'Segmentos en V', min: 4, max: 96, step: 1 }).on('change', rebuild);
let pathFolder;
function configurePathFolder() {
 if (pathFolder) pathFolder.dispose();
 pathFolder = pane.addFolder({ title: 'Path', expanded: true });
 const controls = manager.pathType === 'helice'
  ? [['radio', 'Radio', 1, 30], ['paso', 'Paso', 1, 60], ['height', 'Altura', 5, 80]]
  : manager.pathType === 'circulo'
   ? [['radio', 'Radio', 1, 30], ['segmentos', 'Segmentos', 4, 64]]
   : manager.pathType === 'rectangular'
    ? [['ancho', 'Ancho', 2, 60], ['largo', 'Largo', 2, 80]]
    : [['longitud', 'Longitud', 5, 80]];
 controls.forEach(([key, label, min, max]) => pathFolder.addBinding(manager.pathParams, key, { label, min, max, step: key === 'segmentos' ? 1 : 0.1 }).on('change', rebuild));
}
configurePathFolder();
const effectsFolder = pane.addFolder({ title: 'Efectos', expanded: true });
effectsFolder.addBinding(manager, 'torsion', { label: 'Torsión (vueltas)', min: 0, max: 4, step: 0.01 }).on('change', rebuild);
const materialFolder = pane.addFolder({ title: 'Material', expanded: false });
materialFolder.addBinding(manager, 'materialType', { label: 'Tipo', options: { 'UV map':'uv', Earth:'earth', Phong:'phong', Basic:'basic' } }).on('change', event => { manager.setMaterial(event.value); refresh(); });
materialFolder.addBinding(manager, 'materialSide', { label: 'Side', options: { Double: 'double', Front: 'front', Back: 'back' } }).on('change', event => manager.setMaterialSide(event.value));
const renderOptions = { smaa: true };
const renderFolder = pane.addFolder({ title: 'Render', expanded: false });
const smaaBinding = renderFolder.addBinding(renderOptions, 'smaa', { label: 'SMAA activo' });
function syncSmaa() { smaaPass.enabled = !Boolean(renderOptions.smaa); }
smaaBinding.on('change', syncSmaa);
syncSmaa();
const helpersFolder = pane.addFolder({ title: 'Helpers', expanded: false });
for (const [key, label] of Object.entries({ vertices: 'Ver vértices', normals: 'Ver normales', shapes: 'Ver shapes', path: 'Ver path', matrices: 'Matrices de nivel' })) {
 helpersFolder.addBinding(manager.visibility, key, { label }).on('change', () => manager.updateVisibility());
}
helpersFolder.addBinding(manager.visibility, 'grid', { label: 'Ver grid' }).on('change', e => { grid.visible = e.value; });
helpersFolder.addBinding(manager.visibility, 'directionalLight', { label: 'Ver luz direccional' }).on('change', e => { directionalLightHelper.visible = e.value; });
helpersFolder.addBinding(manager.helpers, 'normalLength', { label: 'Longitud normales', min: 0, max: 5, step: 0.05 }).on('change', () => manager.updateHelpers());
helpersFolder.addBinding(manager.helpers, 'vertexRadius', { label: 'Radio vértices', min: 0.03, max: 0.6, step: 0.01 }).on('change', () => manager.updateHelpers());
const lighting = pane.addFolder({ title: 'Iluminación', expanded: false });
lighting.addBinding(light, 'intensity', { label: 'Intensidad', min: 0, max: 10, step: 0.05 });
const lightAngles = { azimuth: 90, elevacion: 45 };
lighting.addBinding(lightAngles, 'azimuth', { label: 'Azimuth', min: -180, max: 180, step: 1 }).on('change', updateLight);
lighting.addBinding(lightAngles, 'elevacion', { label: 'Elevación', min: -89, max: 89, step: 1 }).on('change', updateLight);
function updateLight() {
 const a = THREE.MathUtils.degToRad(lightAngles.azimuth), e = THREE.MathUtils.degToRad(lightAngles.elevacion);
 light.position.set(Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)).multiplyScalar(30);
 directionalLightHelper.update();
}
updateLight();
const cameras = pane.addFolder({ title: 'Cámara', expanded: false });
for (const [title, direction] of Object.entries({ Front: [0, 0, 1], Left: [-1, 0, 0], Top: [0, 1, 0], Diagonal: [1, 1, 1] })) {
 cameras.addButton({ title }).on('click', () => fit(new THREE.Vector3(...direction)));
}
cameras.addBinding(options, 'type', { label: 'Tipo', options: { Perspectiva: 'perspectiva', Ortográfica: 'ortografica' } }).on('change', e => setType(e.value));
pane.addBinding(options, 'selection', { label: 'Inspeccionar triángulo' }).on('change', e => {
 manager.selectionEnabled = e.value;
 if (e.value) manager.isPlaying = false;
 else manager.select(null);
 renderer.domElement.classList.toggle('selecting', e.value);
 refresh();
});
playButton.addEventListener('click', () => { manager.isPlaying = !manager.isPlaying; refresh(); });
const track = document.querySelector('.playback-track');
let scrubbing = false;
function scrub(e) { const rect = track.getBoundingClientRect(); manager.setProgress(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))); refresh(); }
track.addEventListener('pointerdown', e => { scrubbing = true; manager.isPlaying = false; track.setPointerCapture(e.pointerId); scrub(e); });
track.addEventListener('pointermove', e => { if (scrubbing) scrub(e); });
track.addEventListener('pointerup', () => { scrubbing = false; });
track.addEventListener('click', scrub);
window.addEventListener('pointerup', () => { scrubbing = false; });
const raycaster = new THREE.Raycaster();
let pointerStart = null;
renderer.domElement.addEventListener('pointerdown', e => {
 if (e.button === 0) pointerStart = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
});
renderer.domElement.addEventListener('pointermove', e => {
 if (pointerStart && Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) > 5) pointerStart.moved = true;
});
renderer.domElement.addEventListener('pointercancel', () => { pointerStart = null; });
renderer.domElement.addEventListener('pointerup', e => {
 const start = pointerStart; pointerStart = null;
 if (!manager.selectionEnabled || !start || start.id !== e.pointerId || start.moved || e.button !== 0) return;
 const rect = renderer.domElement.getBoundingClientRect();
 const mouse = new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
 camera.updateMatrixWorld();
 manager.mesh.updateWorldMatrix(true, false);
 raycaster.setFromCamera(mouse, camera);
 const hit = raycaster.intersectObject(manager.mesh, false).find(hit => hit.faceIndex < manager.count);
 manager.select(hit ? hit.faceIndex : null);
 refresh();
});
const observer = new ResizeObserver(resize);
observer.observe(viewport);
observer.observe(document.getElementById('topology-container'));
observer.observe(document.getElementById('shape-container'));
resize();
fit(camera.position.clone().sub(controls.target));
let lastTime;
renderer.setAnimationLoop(time => {
 const delta = lastTime === undefined ? 0 : Math.min((time - lastTime) / 1000, 0.1);
 lastTime = time;
 if (manager.animate(delta)) refresh();
 controls.update();
 renderPass.camera = camera;
 composer.render();
});
