import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { createReferenceScene } from './scene/createReferenceScene.js';
import { PipelineEngine } from './pipeline/PipelineEngine.js';
import { PipelineVisualizer } from './visualization/PipelineVisualizer.js';
import './styles/main.css';

const STAGES = {
	model: { number: '01', title: 'Model Space', text: 'Las coordenadas describen el objeto respecto de su propio origen local.', equation: 'p_model = [x, y, z, 1]' },
	world: { number: '02', title: 'World Space', text: 'La matriz de modelo ubica todos los objetos en un sistema de coordenadas común.', equation: 'p_world = M_model × p_model' },
	view: { number: '03', title: 'View / Camera Space', text: 'La matriz de vista mueve el mundo: la cámara queda en el origen mirando hacia −Z.', equation: 'p_view = M_view × p_world' },
	clip: { number: '04', title: 'Clip Space', text: 'Las proyecciones X–W, Y–W y Z–W muestran el recorte antes de dividir. Magenta indica nuevos vértices.', equation: '−w ≤ x, y, z ≤ w  ·  conserva w' },
	ndc: { number: '05', title: 'Normalized Device Coordinates', text: 'Después del clipping, dividir por w lleva la geometría visible al cubo canónico [−1, 1]³.', equation: 'p_ndc = p_clip / w' },
	screen: { number: '06', title: 'Screen / Raster Space', text: 'La transformación de viewport convierte X e Y de NDC en píxeles; Z se conserva para profundidad.', equation: 'p_screen = Viewport × p_ndc' },
};

document.querySelector('#app').innerHTML = `
	<main class="app-shell">
		<header class="topbar">
			<div class="brand"><i class="brand-mark"></i><h1>From Vertex to Pixel</h1><span>Interactive graphics pipeline</span></div>
			<div class="status">Pipeline sincronizado</div>
		</header>
		<section class="workspace">
			<section class="panel reference-panel">
				<div class="reference-canvas" id="reference"></div>
				<div class="panel-label"><span class="number">A</span><span>Escena de referencia</span><span class="subtle">/ Observer Camera</span></div>
				<aside class="camera-card">
					<div class="camera-card__title"><span>Teaching Camera</span><span>Activa</span></div>
					<div class="gizmo-buttons"><button class="gizmo-button active" data-mode="translate">Mover · G</button><button class="gizmo-button" data-mode="rotate">Rotar · R</button></div>
					<label class="parameter"><span>FOV</span><input id="fov" type="range" min="25" max="80" step="1" value="46"><output>46°</output></label>
					<label class="parameter"><span>NEAR</span><input id="near" type="range" min="0.2" max="3" step="0.1" value="0.6"><output>0.60</output></label>
					<label class="parameter"><span>FAR</span><input id="far" type="range" min="5" max="20" step="0.5" value="10.5"><output>10.5</output></label>
					<p class="hint">Arrastrá el gizmo para transformar la cámara. Orbitá el panel para observar el frustum desde afuera.</p>
				</aside>
			</section>
			<section class="panel pipeline-panel">
				<nav class="tabs" aria-label="Etapas del pipeline">${Object.keys(STAGES).map((stage, index) => `<button class="tab ${index === 0 ? 'active' : ''}" data-stage="${stage}">${stage.toUpperCase()}</button>`).join('')}</nav>
				<nav class="subnav" id="subnav" aria-label="Opciones de la etapa"></nav>
				<div class="visualizer-wrap">
					<div class="visualizer-canvas" id="visualizer"></div><canvas class="visualizer-canvas" id="screen-canvas" hidden></canvas>
					<div class="stage-info"><p class="stage-kicker" id="stage-kicker"></p><h2 id="stage-title"></h2><p id="stage-text"></p><code class="stage-equation" id="stage-equation"></code></div>
					<div class="orbit-hint">ARRASTRAR PARA ORBITAR · RUEDA PARA ZOOM</div>
				</div>
				<footer class="inspector">
					<div class="vertex-id" id="vertex-id"></div>
					<div class="coords" id="coords"></div>
					<div class="visibility" id="visibility">Dentro del frustum</div>
					<div class="shading-toolbar" aria-label="Modo de sombreado">
						<span>Sombreado</span>
						<div><button class="shading-button active" data-shading="wireframe" title="Superficie y wireframe">1</button><button class="shading-button" data-shading="solid" title="Phong sólido sin wireframe">2</button><button class="shading-button" data-shading="translucent" title="Translúcido sin wireframe">3</button><button class="shading-button" data-shading="distance" title="Distancia a la Teaching Camera">4</button></div>
					</div>
					<div class="helper-toolbar" aria-label="Helpers de la visualización">
						<span>Helpers</span>
						<div><button class="helper-button active" data-helper="grid" aria-pressed="true">Grid</button><button class="helper-button active" data-helper="axes" aria-pressed="true">Ejes</button></div>
					</div>
				</footer>
			</section>
		</section>
	</main>`;

const referenceContainer = document.querySelector('#reference');
const visualizerContainer = document.querySelector('#visualizer');
const reference = createReferenceScene();
const observerCamera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
observerCamera.position.set(11, 9, 13);
const referenceRenderer = new THREE.WebGLRenderer({ antialias: true });
referenceRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
referenceRenderer.outputColorSpace = THREE.SRGBColorSpace;
referenceRenderer.toneMapping = THREE.ACESFilmicToneMapping;
referenceRenderer.toneMappingExposure = 1.08;
referenceContainer.appendChild(referenceRenderer.domElement);

const observerControls = new OrbitControls(observerCamera, referenceRenderer.domElement);
observerControls.enableDamping = true;
observerControls.target.set(0, 1, 0);
observerControls.maxDistance = 28;
observerControls.minDistance = 5;

const transformControls = new TransformControls(observerCamera, referenceRenderer.domElement);
transformControls.attach(reference.teachingCamera);
transformControls.setSize(0.72);
reference.scene.add(transformControls);
transformControls.addEventListener('dragging-changed', (event) => { observerControls.enabled = !event.value; });

const trackedMarker = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), new THREE.MeshBasicMaterial({ color: 0xff4d62, depthTest: false }));
trackedMarker.renderOrder = 20;
reference.scene.add(trackedMarker);

const engine = new PipelineEngine(reference.teachingCamera);
const visualizer = new PipelineVisualizer(visualizerContainer, document.querySelector('#screen-canvas'));
let activeStage = 'model';
let pipelineResult;
let dirty = true;
let clipViewMode = 'plots';

const STAGE_OPTIONS = {
	world: ['Escena completa', 'Grilla global', 'Ejes XYZ'],
	view: ['Origen de cámara', 'Frustum', 'Geometría transformada'],
	ndc: ['Cubo [−1, 1]³', 'Profundidad Z', 'Wireframe'],
	screen: ['Viewport', 'Triángulos', 'Depth'],
};

function setDirty() {
	dirty = true;
	reference.cameraHelper.update();
}

transformControls.addEventListener('objectChange', setDirty);

function resize() {
	const leftWidth = Math.max(1, referenceContainer.clientWidth);
	const leftHeight = Math.max(1, referenceContainer.clientHeight);
	referenceRenderer.setSize(leftWidth, leftHeight, false);
	observerCamera.aspect = leftWidth / leftHeight;
	observerCamera.updateProjectionMatrix();
	visualizer.resize();
	setDirty();
}

function updateStageUI() {
	const meta = STAGES[activeStage];
	document.querySelector('#stage-kicker').textContent = `${meta.number} — ETAPA ACTIVA`;
	document.querySelector('#stage-title').textContent = meta.title;
	document.querySelector('#stage-text').textContent = meta.text;
	document.querySelector('#stage-equation').textContent = meta.equation;
	updateSubnav();
}

function updateSubnav() {
	const subnav = document.querySelector('#subnav');
	if (activeStage === 'model') {
		subnav.innerHTML = `<span class="subnav-label">Modelo</span>${reference.pipelineObjects.map((mesh) => `<button class="subnav-item ${mesh === reference.trackedVertex.mesh ? 'active' : ''}" data-mesh="${mesh.uuid}">${mesh.name}</button>`).join('')}`;
		subnav.querySelectorAll('[data-mesh]').forEach((button) => button.addEventListener('click', () => {
			const mesh = reference.pipelineObjects.find((item) => item.uuid === button.dataset.mesh);
			reference.trackedVertex.mesh = mesh;
			reference.trackedVertex.index = Math.min(19, mesh.geometry.attributes.position.count - 1);
			updateSubnav();
			setDirty();
		}));
		return;
	}
	if (activeStage === 'clip') {
		subnav.innerHTML = `<span class="subnav-label">Representación</span><button class="subnav-item ${clipViewMode === 'plots' ? 'active' : ''}" data-clip-mode="plots">Diagramas homogéneos</button><button class="subnav-item ${clipViewMode === 'preview' ? 'active' : ''}" data-clip-mode="preview">Preview 3D</button><span class="subnav-legend"><i class="original"></i>Original <i class="generated"></i>Generado por clipping</span>`;
		subnav.querySelectorAll('[data-clip-mode]').forEach((button) => button.addEventListener('click', () => {
			clipViewMode = button.dataset.clipMode;
			visualizer.setClipMode(clipViewMode);
			updateSubnav();
			if (pipelineResult) visualizer.setStage(activeStage, pipelineResult, reference.trackedVertex, reference.teachingCamera);
		}));
		return;
	}
	const options = STAGE_OPTIONS[activeStage];
	subnav.innerHTML = `<span class="subnav-label">Visualización</span>${options.map((option, index) => `<span class="subnav-item ${index === 0 ? 'active' : ''}">${option}</span>`).join('')}`;
}

function format(value) {
	if (!Number.isFinite(value)) return '—';
	const fixed = value.toFixed(3);
	return value >= 0 ? ` ${fixed}` : fixed;
}

function updateInspector() {
	const vector = pipelineResult.tracked[activeStage];
	const labels = activeStage === 'screen' ? ['PX', 'PY', 'DEPTH'] : activeStage === 'clip' ? ['X', 'Y', 'Z', 'W'] : ['X', 'Y', 'Z'];
	const values = activeStage === 'screen' ? [vector.x, vector.y, vector.z] : labels.map((_, index) => vector.getComponent(index));
	document.querySelector('#coords').innerHTML = labels.map((label, index) => `<div class="coord"><span>${label}</span><output>${format(values[index])}</output></div>`).join('');
	const visibility = document.querySelector('#visibility');
	document.querySelector('#vertex-id').innerHTML = `TRACKED VERTEX #${reference.trackedVertex.index}<strong>${reference.trackedVertex.mesh.name} · vertex ${reference.trackedVertex.index}</strong>`;
	visibility.textContent = pipelineResult.tracked.visible ? 'Dentro del frustum' : 'Fuera del frustum';
	visibility.classList.toggle('out', !pipelineResult.tracked.visible);
}

function rebuildPipeline() {
	reference.scene.updateMatrixWorld(true);
	const trackedMesh = reference.trackedVertex.mesh;
	const local = new THREE.Vector3().fromBufferAttribute(trackedMesh.geometry.attributes.position, reference.trackedVertex.index);
	trackedMarker.position.copy(local.applyMatrix4(trackedMesh.matrixWorld));
	const size = visualizer.resize();
	reference.teachingCamera.aspect = size.width / size.height;
	reference.teachingCamera.updateProjectionMatrix();
	reference.cameraHelper.update();
	pipelineResult = engine.processScene(reference.pipelineObjects, size, reference.trackedVertex);
	visualizer.setStage(activeStage, pipelineResult, reference.trackedVertex, reference.teachingCamera);
	updateInspector();
	dirty = false;
}

document.querySelectorAll('.tab').forEach((button) => button.addEventListener('click', () => {
	activeStage = button.dataset.stage;
	document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('active', tab === button));
	updateStageUI();
	if (pipelineResult) {
		visualizer.setStage(activeStage, pipelineResult, reference.trackedVertex, reference.teachingCamera);
		updateInspector();
	}
}));

document.querySelectorAll('.gizmo-button').forEach((button) => button.addEventListener('click', () => {
	transformControls.setMode(button.dataset.mode);
	document.querySelectorAll('.gizmo-button').forEach((item) => item.classList.toggle('active', item === button));
}));

document.querySelectorAll('.shading-button').forEach((button) => button.addEventListener('click', () => {
	visualizer.setShadingMode(button.dataset.shading);
	document.querySelectorAll('.shading-button').forEach((item) => item.classList.toggle('active', item === button));
	if (pipelineResult) visualizer.setStage(activeStage, pipelineResult, reference.trackedVertex, reference.teachingCamera);
}));

document.querySelectorAll('.helper-button').forEach((button) => button.addEventListener('click', () => {
	const visible = !button.classList.contains('active');
	button.classList.toggle('active', visible);
	button.setAttribute('aria-pressed', String(visible));
	visualizer.setHelperVisibility(button.dataset.helper, visible);
	if (pipelineResult) visualizer.setStage(activeStage, pipelineResult, reference.trackedVertex, reference.teachingCamera);
}));

for (const id of ['fov', 'near', 'far']) {
	const input = document.querySelector(`#${id}`);
	input.addEventListener('input', () => {
		const value = Number(input.value);
		reference.teachingCamera[id] = value;
		input.nextElementSibling.textContent = id === 'fov' ? `${value.toFixed(0)}°` : value.toFixed(id === 'far' ? 1 : 2);
		setDirty();
	});
}

window.addEventListener('keydown', (event) => {
	if (event.key.toLowerCase() === 'g') document.querySelector('[data-mode="translate"]').click();
	if (event.key.toLowerCase() === 'r') document.querySelector('[data-mode="rotate"]').click();
});
window.addEventListener('resize', resize);

function animate() {
	requestAnimationFrame(animate);
	if (dirty) rebuildPipeline();
	observerControls.update();
	visualizer.render();
	referenceRenderer.render(reference.scene, observerCamera);
}

updateStageUI();
resize();
animate();
