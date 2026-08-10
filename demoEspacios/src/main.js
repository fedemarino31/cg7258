import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { Pane } from 'tweakpane';
import { createReferenceScene } from './scene/createReferenceScene.js';
import { PipelineEngine } from './pipeline/PipelineEngine.js';
import { calculateRasterDimensions, ndcToRasterPixel } from './pipeline/ScreenRasterizer.js';
import { PipelineVisualizer } from './visualization/PipelineVisualizer.js';
import './styles/main.css';

const STAGES = {
	model: { title: 'Model Space', text: 'Las coordenadas describen el objeto respecto de su propio origen local.' },
	world: { title: 'World Space', text: 'La matriz de modelo ubica todos los objetos en un sistema de coordenadas común.' },
	view: { title: 'View / Camera Space', text: 'La matriz de vista mueve el mundo: la cámara queda en el origen mirando hacia −Z.' },
	clip: { title: 'Clip Space', text: 'Las proyecciones X–W, Y–W y Z–W muestran el recorte antes de dividir. Magenta indica nuevos vértices.' },
	ndc: { title: 'Normalized Device Coordinates', text: 'La geometría visible ocupa [−1, 1]³; la profundidad se orienta con near delante de far para facilitar su lectura.' },
	screen: { title: 'Screen / Raster Space', text: 'La transformación de viewport convierte X e Y de NDC en píxeles; Z se conserva para profundidad.' },
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
				<aside class="camera-pane" id="camera-pane"></aside>
			</section>
			<section class="panel pipeline-panel">
				<nav class="tabs" aria-label="Etapas del pipeline">${Object.keys(STAGES).map((stage, index) => `<button class="tab ${index === 0 ? 'active' : ''}" data-stage="${stage}">${stage.toUpperCase()}</button>`).join('')}</nav>
				<nav class="subnav" id="subnav" aria-label="Opciones de la etapa"></nav>
				<div class="visualizer-wrap">
					<div class="visualizer-canvas" id="visualizer"></div><canvas class="visualizer-canvas" id="screen-canvas" hidden></canvas><canvas class="visualizer-canvas coordinate-canvas" id="screen-coordinates" hidden></canvas>
					<div class="stage-info"><h2 id="stage-title"></h2><p id="stage-text"></p></div>
					<div class="orbit-hint">ARRASTRAR PARA ORBITAR · RUEDA PARA ZOOM</div>
				</div>
				<footer class="inspector">
					<div class="vertex-summary" id="vertex-summary"></div>
					<div class="shading-toolbar" aria-label="Modo de sombreado">
						<span>Sombreado</span>
						<div><button class="shading-button active" data-shading="wireframe" title="Superficie y wireframe">Wire</button><button class="shading-button" data-shading="solid" title="Phong sólido sin wireframe">Sólido</button><button class="shading-button" data-shading="distance" title="Distancia a la Teaching Camera">Dist.</button></div>
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

const cameraParameters = {
	mode: 'translate',
	fov: reference.teachingCamera.fov,
	near: reference.teachingCamera.near,
	far: reference.teachingCamera.far,
};
const cameraPane = new Pane({
	container: document.querySelector('#camera-pane'),
	title: 'TEACHING CAMERA · ACTIVA',
});
const modeBinding = cameraPane.addBinding(cameraParameters, 'mode', {
	label: 'GIZMO',
	options: {
		'Mover · G': 'translate',
		'Rotar · R': 'rotate',
	},
});
modeBinding.on('change', ({ value }) => transformControls.setMode(value));

const cameraBindings = [
	{ key: 'fov', label: 'FOV', min: 25, max: 80, step: 1 },
	{ key: 'near', label: 'NEAR', min: 0.2, max: 3, step: 0.1 },
	{ key: 'far', label: 'FAR', min: 5, max: 20, step: 0.5 },
];
for (const { key, ...params } of cameraBindings) {
	cameraPane.addBinding(cameraParameters, key, params).on('change', ({ value }) => {
		reference.teachingCamera[key] = value;
		setDirty();
	});
}

const trackedMarker = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), new THREE.MeshBasicMaterial({ color: 0xff4d62, depthTest: false }));
trackedMarker.renderOrder = 20;
reference.scene.add(trackedMarker);

const engine = new PipelineEngine(reference.teachingCamera);
const visualizer = new PipelineVisualizer(
	visualizerContainer,
	document.querySelector('#screen-canvas'),
	document.querySelector('#screen-coordinates')
);
let activeStage = 'model';
let pipelineResult;
let dirty = true;
let clipViewMode = 'plots';
let screenViewMode = 'vector';

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
	document.querySelector('#stage-title').textContent = meta.title;
	document.querySelector('#stage-text').textContent = meta.text;
	document.querySelector('.pipeline-panel').classList.toggle('screen-stage', activeStage === 'screen');
	updateSubnav();
}

function updateSubnav() {
	const subnav = document.querySelector('#subnav');
	const hasInteractiveSubnav = activeStage === 'model' || activeStage === 'clip' || activeStage === 'screen';
	subnav.hidden = !hasInteractiveSubnav;
	document.querySelector('.pipeline-panel').classList.toggle('without-subnav', !hasInteractiveSubnav);
	if (!hasInteractiveSubnav) {
		subnav.replaceChildren();
		return;
	}
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
	if (activeStage === 'screen') {
		const modes = [
			{ id: 'vector', label: 'Vector' },
			{ id: 'raster', label: 'Raster' },
			{ id: 'raster-wireframe', label: 'Raster + Wireframe' },
		];
		subnav.innerHTML = `<span class="subnav-label">Representación</span>${modes.map((mode) => `<button class="subnav-item ${screenViewMode === mode.id ? 'active' : ''}" data-screen-mode="${mode.id}" aria-pressed="${screenViewMode === mode.id}">${mode.label}</button>`).join('')}`;
		subnav.querySelectorAll('[data-screen-mode]').forEach((button) => button.addEventListener('click', () => {
			screenViewMode = button.dataset.screenMode;
			visualizer.setScreenViewMode(screenViewMode);
			updateSubnav();
			if (pipelineResult) {
				visualizer.setStage(activeStage, pipelineResult, reference.trackedVertex, reference.teachingCamera);
				updateInspector();
			}
		}));
		return;
	}
}

function updateInspector() {
	let vector = pipelineResult.tracked[activeStage];
	const componentCount = activeStage === 'clip' ? 4 : 3;
	let values = Array.from({ length: componentCount }, (_, index) => vector.getComponent(index));
	if (activeStage === 'screen') {
		if (screenViewMode === 'vector') {
			vector = pipelineResult.tracked.ndc;
			values = [vector.x, vector.y, vector.z];
		} else {
			const dimensions = calculateRasterDimensions(pipelineResult.viewport);
			const pixel = ndcToRasterPixel(pipelineResult.tracked.ndc, dimensions.width, dimensions.height);
			values = [pixel.x, pixel.y, pipelineResult.tracked.screen.z];
		}
	}
	const position = values.map((value, index) => {
		const integerPixel = activeStage === 'screen' && screenViewMode !== 'vector' && index < 2;
		return integerPixel ? String(value) : Number.isFinite(value) ? value.toFixed(3) : '—';
	}).join(', ');
	document.querySelector('#vertex-summary').textContent = `${reference.trackedVertex.mesh.name} - vertex #${reference.trackedVertex.index} - pos=(${position})`;
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

window.addEventListener('keydown', (event) => {
	const key = event.key.toLowerCase();
	if (key !== 'g' && key !== 'r') return;
	cameraParameters.mode = key === 'g' ? 'translate' : 'rotate';
	transformControls.setMode(cameraParameters.mode);
	modeBinding.refresh();
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
