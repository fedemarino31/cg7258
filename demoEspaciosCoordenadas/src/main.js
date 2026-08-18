import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { Pane } from 'tweakpane';
import { createReferenceScene } from './scene/createReferenceScene.js';
import {
	CAMERA_TYPE,
	configureTeachingCamera,
	replaceTeachingCamera,
} from './scene/teachingCamera.js';
import { PipelineEngine } from './pipeline/PipelineEngine.js';
import { PipelineVisualizer } from './visualization/PipelineVisualizer.js';
import './styles/main.css';

const STAGES = {
	model: {
		title: 'Model Space',
		details: [
			'Es el sistema de coordenadas local de cada objeto. En este espacio, la geometría se define alrededor de su propio origen, antes de decidir dónde estará, cómo se orientará o qué tamaño tendrá dentro de la escena.',
			'Cada vértice parte como p_model = (x, y, z, 1). Dos objetos pueden reutilizar exactamente la misma geometría y verse diferentes porque cada uno tendrá una transformación de modelo distinta.',
			'La etapa siguiente aplica la matriz de modelo M, que combina escala, rotación y traslación: p_world = M · p_model.',
		],
	},
	world: {
		title: 'World Space',
		details: [
			'World Space reúne todos los objetos en un único sistema de referencia compartido. Aquí ya es posible comparar sus posiciones, calcular iluminación entre elementos y entender la composición completa de la escena.',
			'Se obtiene transformando cada vértice local con la matriz de modelo del objeto: p_world = M · p_model. La matriz M lleva los ejes locales del objeto a los ejes globales de la escena.',
			'Para observar la escena desde la cámara, la siguiente etapa aplica la matriz de vista V: p_view = V · p_world.',
		],
	},
	view: {
		title: 'View / Camera Space',
		details: [
			'Este espacio describe el mundo desde el punto de vista de la cámara didáctica. La cámara queda conceptualmente en el origen, orientada hacia el eje −Z; en realidad, es toda la escena la que se transforma en sentido inverso al movimiento de la cámara.',
			'La matriz de vista es la inversa de la transformación global de la cámara: V = C⁻¹. Por eso p_view = V · p_world. El frustum mostrado aquí está expresado en estas mismas coordenadas.',
			'La etapa siguiente aplica la matriz de proyección P. En perspectiva, los objetos lejanos se reducen; en ortográfica, su tamaño proyectado no depende de la distancia.',
		],
	},
	clip: {
		title: 'Clip Space',
		details: [
			'Clip Space es un espacio homogéneo de cuatro componentes. Se obtiene con p_clip = P · p_view y conserva W para poder representar la perspectiva antes de realizar la división que produce NDC.',
			'Un punto es visible cuando cumple −W ≤ X ≤ W, −W ≤ Y ≤ W y −W ≤ Z ≤ W. Los triángulos que cruzan esos límites se recortan y generan nuevos vértices; esos vértices aparecen en magenta.',
			'En proyección perspectiva, W está relacionado con la profundidad y posibilita el efecto de reducción con la distancia. En proyección ortográfica, W permanece constante. Luego se calcula p_ndc = (X/W, Y/W, Z/W).',
		],
	},
	ndc: {
		title: 'Normalized Device Coordinates',
		details: [
			'NDC es el volumen canónico obtenido después de la división por W. Todo lo visible queda normalizado dentro del cubo [−1, 1]³, independientemente del tamaño del viewport o de si la proyección elegida es perspectiva u ortográfica.',
			'La operación es p_ndc = (X_clip/W_clip, Y_clip/W_clip, Z_clip/W_clip). En perspectiva esta división produce el acortamiento con la distancia; en ortográfica, al ser W constante, la transformación es afín.',
			'Esta normalización separa la proyección del dispositivo final. La siguiente etapa convierte X e Y de este intervalo abstracto a coordenadas concretas de píxeles.',
		],
	},
	screen: {
		title: 'Screen / Raster Space',
		details: [
			'Screen Space convierte la geometría normalizada en posiciones sobre una imagen. El viewport determina la resolución y la relación de aspecto final; el rasterizador decide qué píxeles cubre cada triángulo.',
			'Para un viewport de ancho W y alto H: x_screen = (x_ndc · 0.5 + 0.5) · W, mientras que y_screen = (1 − (y_ndc · 0.5 + 0.5)) · H. La inversión de Y corresponde al origen superior habitual de una imagen.',
			'El valor de profundidad se conserva para resolver qué superficie está delante. Raster, Raster + Wireframe y Vector representan el mismo resultado proyectado de maneras diferentes.',
		],
	},
};

document.querySelector('#app').innerHTML = `
	<main class="app-shell">
		<header class="topbar">
			<div class="brand"><h1>Interactive Graphics Pipeline</h1></div>
		</header>
		<section class="workspace">
			<section class="panel reference-panel">
				<div class="reference-canvas" id="reference"></div>
				<div class="panel-label"><span class="number"></span><span>Escena de referencia</span><span class="subtle">/ Cámara</span></div>
				<aside class="camera-pane" id="camera-pane"></aside>
			</section>
			<section class="panel pipeline-panel">
				<nav class="tabs" aria-label="Etapas del pipeline">${Object.keys(STAGES).map((stage) => `<button class="tab ${stage === 'screen' ? 'active' : ''}" data-stage="${stage}">${stage.toUpperCase()}</button>`).join('')}</nav>
				<nav class="subnav" id="subnav" aria-label="Opciones de la etapa"></nav>
				<div class="visualizer-wrap">
					<div class="visualizer-canvas" id="visualizer"></div><canvas class="visualizer-canvas" id="screen-canvas" hidden></canvas><canvas class="visualizer-canvas coordinate-canvas" id="screen-coordinates" hidden></canvas>
					<div class="stage-info">
						<h2 id="stage-title"></h2>
						<button class="stage-help-button" id="stage-help-button" type="button" aria-label="Más información sobre esta etapa" aria-controls="stage-help" aria-expanded="false">i</button>
					</div>
					<aside class="stage-help" id="stage-help" role="dialog" aria-labelledby="stage-help-title" hidden>
						<header><h3 id="stage-help-title"></h3><button id="stage-help-close" type="button" aria-label="Cerrar información">×</button></header>
						<div id="stage-help-content"></div>
					</aside>
					<div class="orbit-hint">ARRASTRAR PARA ORBITAR · RUEDA PARA ZOOM</div>
				</div>
				<footer class="inspector">
					<div class="vertex-tool">
						<button class="vertex-picker" id="vertex-picker" type="button" aria-pressed="false" title="Seleccionar un vértice en la escena de referencia" aria-label="Seleccionar vértice">
							<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m19.4 3.2 1.4 1.4a2 2 0 0 1 0 2.8l-3.1 3.1 1.1 1.1-1.4 1.4-1.1-1.1-7.6 7.6-4.2.7.7-4.2 7.6-7.6-1.1-1.1L10 5.6l1.1 1.1 3.1-3.1a2 2 0 0 1 2.8 0ZM7 16.8l-.2 1.4 1.4-.2 7-7-1.2-1.2Z"/></svg>
						</button>
						<div class="vertex-details" id="vertex-summary">
							<div class="vertex-identity"><strong id="vertex-object"></strong><span id="vertex-index"></span></div>
							<div class="vertex-coordinate"><span>MODEL</span><code id="vertex-model"></code></div>
							<div class="vertex-coordinate"><span>WORLD</span><code id="vertex-world"></code></div>
							<div class="vertex-coordinate"><span>VIEW</span><code id="vertex-view"></code></div>
						</div>
					</div>
					<div class="shading-toolbar" aria-label="Modo de sombreado">
						<span>Sombreado</span>
						<div><button class="shading-button active" data-shading="solid" title="Phong sólido sin wireframe">Sólido</button><button class="shading-button" data-shading="wireframe" title="Superficie y wireframe">Wire</button><button class="shading-button" data-shading="distance" title="Distancia a la Cámara">Dist.</button></div>
					</div>
					<div class="helper-toolbar" aria-label="Helpers de la visualización">
						<span>Helpers</span>
						<div><button class="helper-button active" data-helper="axes" aria-pressed="true">Ejes</button></div>
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

let teachingCameraAspect = reference.teachingCamera.aspect;
const cameraParameters = {
	type: CAMERA_TYPE.perspective,
	mode: 'translate',
	fov: reference.teachingCamera.fov,
	orthographicSize: 6.8,
	near: reference.teachingCamera.near,
	far: reference.teachingCamera.far,
};
const cameraPane = new Pane({
	container: document.querySelector('#camera-pane'),
	title: 'Cámara',
});
const typeBinding = cameraPane.addBinding(cameraParameters, 'type', {
	label: 'TIPO',
	options: {
		Perspectiva: CAMERA_TYPE.perspective,
		Ortográfica: CAMERA_TYPE.orthographic,
	},
});
const modeBinding = cameraPane.addBinding(cameraParameters, 'mode', {
	label: 'GIZMO',
	options: {
		'Mover · M': 'translate',
		'Rotar · R': 'rotate',
	},
});
modeBinding.on('change', ({ value }) => transformControls.setMode(value));

const projectionParameters = () => ({
	aspect: teachingCameraAspect,
	fov: cameraParameters.fov,
	orthographicSize: cameraParameters.orthographicSize,
	near: cameraParameters.near,
	far: cameraParameters.far,
});

let fovBinding;
let orthographicSizeBinding;

function updateProjectionBindingVisibility() {
	fovBinding.hidden = cameraParameters.type !== CAMERA_TYPE.perspective;
	orthographicSizeBinding.hidden = cameraParameters.type !== CAMERA_TYPE.orthographic;
}

typeBinding.on('change', ({ value }) => {
	const camera = replaceTeachingCamera(reference, value, projectionParameters());
	transformControls.attach(camera);
	engine.camera = camera;
	updateProjectionBindingVisibility();
	setDirty();
});

const cameraBindings = [
	{ key: 'fov', label: 'FOV', min: 25, max: 80, step: 1 },
	{ key: 'orthographicSize', label: 'ALTURA', min: 2, max: 14, step: 0.1 },
	{ key: 'near', label: 'NEAR', min: 0.2, max: 5, step: 0.1 },
	{ key: 'far', label: 'FAR', min: 5, max: 20, step: 0.5 },
];
for (const { key, ...params } of cameraBindings) {
	const binding = cameraPane.addBinding(cameraParameters, key, params).on('change', () => {
		configureTeachingCamera(reference.teachingCamera, projectionParameters());
		setDirty();
	});
	if (key === 'fov') fovBinding = binding;
	if (key === 'orthographicSize') orthographicSizeBinding = binding;
}
updateProjectionBindingVisibility();

const trackedMarker = new THREE.Mesh(
	new THREE.SphereGeometry(0.065, 14, 10),
	new THREE.MeshPhongMaterial({
		color: 0xffff00,
		emissive: 0xffff00,
		emissiveIntensity: 0.5,
		specular: 0x000000,
		shininess: 0,
		depthTest: false,
	})
);
trackedMarker.renderOrder = 20;
reference.scene.add(trackedMarker);

const engine = new PipelineEngine(reference.teachingCamera);
const visualizer = new PipelineVisualizer(
	visualizerContainer,
	document.querySelector('#screen-canvas'),
	document.querySelector('#screen-coordinates')
);
let activeStage = 'screen';
let pipelineResult;
let dirty = true;
let clipViewMode = 'plots';
let screenViewMode = 'raster';
let screenRasterWidth = 64;
const stageHelp = document.querySelector('#stage-help');
const stageHelpButton = document.querySelector('#stage-help-button');
const stageHelpClose = document.querySelector('#stage-help-close');

function setStageHelpOpen(open) {
	stageHelp.hidden = !open;
	stageHelpButton.setAttribute('aria-expanded', String(open));
}

stageHelpButton.addEventListener('click', () => setStageHelpOpen(stageHelp.hidden));
stageHelpClose.addEventListener('click', () => {
	setStageHelpOpen(false);
	stageHelpButton.focus();
});
document.addEventListener('pointerdown', (event) => {
	if (!stageHelp.hidden && !stageHelp.contains(event.target) && !stageHelpButton.contains(event.target)) {
		setStageHelpOpen(false);
	}
});
document.addEventListener('keydown', (event) => {
	if (event.key === 'Escape' && !stageHelp.hidden) {
		setStageHelpOpen(false);
		stageHelpButton.focus();
	}
});

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
	document.querySelector('#stage-help-title').textContent = meta.title;
	const content = document.querySelector('#stage-help-content');
	content.replaceChildren(...meta.details.map((detail) => {
		const paragraph = document.createElement('p');
		paragraph.textContent = detail;
		return paragraph;
	}));
	setStageHelpOpen(false);
	document.querySelector('.pipeline-panel').classList.toggle('screen-stage', activeStage === 'screen');
	document.querySelector('.pipeline-panel').classList.toggle('dark-stage', ['model', 'world', 'view', 'clip', 'ndc'].includes(activeStage));
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
			{ id: 'raster', label: 'Raster' },
			{ id: 'raster-wireframe', label: 'Raster + Wireframe' },
			{ id: 'vector', label: 'Vector' },
		];
		const resolutions = [256, 128, 64, 32];
		subnav.innerHTML = `<span class="subnav-label">Representación</span>${modes.map((mode) => `<button class="subnav-item ${screenViewMode === mode.id ? 'active' : ''}" data-screen-mode="${mode.id}" aria-pressed="${screenViewMode === mode.id}">${mode.label}</button>`).join('')}<label class="resolution-control"><span>Resolución</span><select id="raster-resolution" aria-label="Resolución horizontal del raster">${resolutions.map((resolution) => `<option value="${resolution}" ${screenRasterWidth === resolution ? 'selected' : ''}>${resolution}</option>`).join('')}</select></label>`;
		subnav.querySelectorAll('[data-screen-mode]').forEach((button) => button.addEventListener('click', () => {
			screenViewMode = button.dataset.screenMode;
			visualizer.setScreenViewMode(screenViewMode);
			updateSubnav();
			if (pipelineResult) {
				visualizer.setStage(activeStage, pipelineResult, reference.trackedVertex, reference.teachingCamera);
				updateInspector();
			}
		}));
		subnav.querySelector('#raster-resolution').addEventListener('change', (event) => {
			screenRasterWidth = Number(event.target.value);
			visualizer.setScreenRasterWidth(screenRasterWidth);
			if (pipelineResult) visualizer.setStage(activeStage, pipelineResult, reference.trackedVertex, reference.teachingCamera);
		});
		return;
	}
}

function updateInspector() {
	const format = (vector) => [vector.x, vector.y, vector.z]
		.map((value) => Number.isFinite(value) ? value.toFixed(3) : '—')
		.join(', ');
	document.querySelector('#vertex-object').textContent = reference.trackedVertex.mesh.name;
	document.querySelector('#vertex-index').textContent = `VERTEX #${reference.trackedVertex.index}`;
	document.querySelector('#vertex-model').textContent = `(${format(pipelineResult.tracked.model)})`;
	document.querySelector('#vertex-world').textContent = `(${format(pipelineResult.tracked.world)})`;
	document.querySelector('#vertex-view').textContent = `(${format(pipelineResult.tracked.view)})`;
}

const vertexPicker = document.querySelector('#vertex-picker');
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let vertexPickerActive = false;
let pickerPointerDown = null;

function setVertexPickerActive(active) {
	vertexPickerActive = active;
	vertexPicker.classList.toggle('active', active);
	vertexPicker.setAttribute('aria-pressed', String(active));
	referenceRenderer.domElement.classList.toggle('vertex-picking', active);
}

function pickVertex(event) {
	const rect = referenceRenderer.domElement.getBoundingClientRect();
	pointer.set(
		((event.clientX - rect.left) / rect.width) * 2 - 1,
		-((event.clientY - rect.top) / rect.height) * 2 + 1
	);
	raycaster.setFromCamera(pointer, observerCamera);
	const hit = raycaster.intersectObjects(reference.pipelineObjects, false)[0];
	if (!hit?.face) return;

	const position = hit.object.geometry.attributes.position;
	const candidateIndices = [...new Set([hit.face.a, hit.face.b, hit.face.c])];
	let selectedIndex = candidateIndices[0];
	let closestDistance = Infinity;
	for (const index of candidateIndices) {
		const worldPosition = new THREE.Vector3().fromBufferAttribute(position, index).applyMatrix4(hit.object.matrixWorld);
		const distance = worldPosition.distanceToSquared(hit.point);
		if (distance < closestDistance) {
			closestDistance = distance;
			selectedIndex = index;
		}
	}
	reference.trackedVertex.mesh = hit.object;
	reference.trackedVertex.index = selectedIndex;
	if (activeStage === 'model') updateSubnav();
	setVertexPickerActive(false);
	setDirty();
}

vertexPicker.addEventListener('click', () => setVertexPickerActive(!vertexPickerActive));
referenceRenderer.domElement.addEventListener('pointerdown', (event) => {
	if (vertexPickerActive) pickerPointerDown = { x: event.clientX, y: event.clientY };
});
referenceRenderer.domElement.addEventListener('pointerup', (event) => {
	if (!vertexPickerActive || !pickerPointerDown) return;
	const moved = Math.hypot(event.clientX - pickerPointerDown.x, event.clientY - pickerPointerDown.y);
	pickerPointerDown = null;
	if (moved <= 4) pickVertex(event);
});

function rebuildPipeline() {
	reference.scene.updateMatrixWorld(true);
	const trackedMesh = reference.trackedVertex.mesh;
	const local = new THREE.Vector3().fromBufferAttribute(trackedMesh.geometry.attributes.position, reference.trackedVertex.index);
	trackedMarker.position.copy(local.applyMatrix4(trackedMesh.matrixWorld));
	const size = visualizer.resize();
	teachingCameraAspect = size.width / size.height;
	configureTeachingCamera(reference.teachingCamera, projectionParameters());
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
	if (key !== 'm' && key !== 'r') return;
	cameraParameters.mode = key === 'm' ? 'translate' : 'rotate';
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
