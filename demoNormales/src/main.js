import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import './styles.css';

import { barycentric } from './normals.js';
import { createGeometry, createSurfaceData, TRIANGLE_COLORS } from './surface.js';
import { SurfaceVisuals } from './visualHelpers.js';
import { createUI } from './ui.js';

const state = {
	angle: 45,
	showTriangles: true,
	showEdges: true,
	showLabels: true,
	showVertexNormals: true,
	showFaceNormals: false,
	showInterpolatedNormals: true,
	inspectionMode: true,
	showSelectedPoint: true,
	showSelectedNormal: true,
	showCalculation: false,
	showSamplingLine: true,
	showSamplingNormals: true,
	samplingPosition: 0.5,
	sampleCount: 12,
	lighting: true,
	solidSurface: true,
	unifyMaterials: false,
	diffuseColor: '#6f9eaa',
	glossiness: 96,
	pointLightIntensity: 32,
	showLightControl: true,
	wireframe: false,
	showLegend: true,
};

const container = document.getElementById('container3D');
const infoPanel = document.getElementById('inspection-info');
const legend = document.getElementById('legend');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setScissorTest(true);
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = '100%';
container.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 3.8;
controls.maxDistance = 15;

function setCamera(position, target = new THREE.Vector3(0, 0.25, 0)) {
	camera.up.set(0, 1, 0);
	camera.position.copy(position);
	controls.target.copy(target);
	camera.lookAt(target);
	controls.update();
}

setCamera(new THREE.Vector3(5.4, 5.1, 7.2));
const scenes = {
	flat: createScene(),
	smooth: createScene(),
};
const models = {
	flat: { scene: scenes.flat, visuals: new SurfaceVisuals(scenes.flat, 'flat') },
	smooth: { scene: scenes.smooth, visuals: new SurfaceVisuals(scenes.smooth, 'smooth') },
};
const sharedLightPosition = new THREE.Vector3(0.5, 3.25, 2.6);
let surfaceData;
let selection = { triangleIndex: 0, weights: new THREE.Vector3(0.2, 0.44, 0.36) };
let draggingInspection = false;
let syncingLight = false;

function createScene() {
	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0x0b1d26);
	const ambient = new THREE.AmbientLight(0xb9d3dc, 0.32);
	scene.add(ambient);
	return scene;
}

function createMaterials(lighting, coloredTriangles) {
	const createMaterial = (color) => {
		if (lighting) {
			return new THREE.MeshPhongMaterial({
				color,
				specular: 0xffffff,
				shininess: state.glossiness,
				side: THREE.DoubleSide,
			});
		}
		return new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
	};

	if (state.unifyMaterials) {
		const sharedMaterial = createMaterial(state.diffuseColor);
		return [sharedMaterial, sharedMaterial, sharedMaterial, sharedMaterial];
	}

	return TRIANGLE_COLORS.map((triangleColor, index) => {
		const color = coloredTriangles ? triangleColor : index < 2 ? 0x4e9caf : 0xd58c5f;
		return createMaterial(color);
	});
}

function disposeMesh(mesh) {
	if (!mesh) return;
	mesh.geometry.dispose();
	const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
	new Set(materials).forEach((material) => material.dispose());
	mesh.parent?.remove(mesh);
}

function createViewportEventTarget(canvas, mode) {
	const listenerMap = new Map();
	const target = {
		style: canvas.style,
		ownerDocument: canvas.ownerDocument,
		getBoundingClientRect() {
			const rect = canvas.getBoundingClientRect();
			const width = rect.width / 2;
			return {
				left: rect.left + (mode === 'smooth' ? width : 0),
				top: rect.top,
				width,
				height: rect.height,
				right: rect.left + (mode === 'smooth' ? rect.width : width),
				bottom: rect.bottom,
			};
		},
		addEventListener(type, listener) {
			const wrapped = (event) => {
				if (type === 'pointerdown') {
					const rect = target.getBoundingClientRect();
					if (event.clientX < rect.left || event.clientX >= rect.right) return;
				}
				listener(event);
			};
			if (!listenerMap.has(listener)) listenerMap.set(listener, new Map());
			listenerMap.get(listener).set(type, wrapped);
			canvas.addEventListener(type, wrapped);
		},
		removeEventListener(type, listener) {
			const wrapped = listenerMap.get(listener)?.get(type);
			if (!wrapped) return;
			canvas.removeEventListener(type, wrapped);
			listenerMap.get(listener).delete(type);
		},
		setPointerCapture(pointerId) {
			canvas.setPointerCapture(pointerId);
		},
		releasePointerCapture(pointerId) {
			if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
		},
	};
	return target;
}

function syncLightFrom(sourceMode) {
	if (syncingLight) return;
	syncingLight = true;
	sharedLightPosition.copy(models[sourceMode].pointLight.position);
	for (const [mode, model] of Object.entries(models)) {
		if (mode !== sourceMode) model.pointLight.position.copy(sharedLightPosition);
	}
	syncingLight = false;
}

function setupMovableLights() {
	for (const [mode, model] of Object.entries(models)) {
		const pointLight = new THREE.PointLight(0xffffff, state.pointLightIntensity, 0, 2);
		pointLight.position.copy(sharedLightPosition);
		const marker = new THREE.Mesh(
			new THREE.SphereGeometry(0.09, 18, 12),
			new THREE.MeshBasicMaterial({ color: 0xfff4cf, depthTest: false })
		);
		marker.renderOrder = 50;
		pointLight.add(marker);
		model.scene.add(pointLight);

		const transformControl = new TransformControls(camera, createViewportEventTarget(renderer.domElement, mode));
		transformControl.setMode('translate');
		transformControl.setSize(0.72);
		transformControl.attach(pointLight);
		transformControl.addEventListener('mouseDown', () => {
			controls.enabled = false;
		});
		transformControl.addEventListener('mouseUp', () => {
			controls.enabled = !draggingInspection;
		});
		transformControl.addEventListener('objectChange', () => syncLightFrom(mode));
		model.scene.add(transformControl);
		model.pointLight = pointLight;
		model.lightMarker = marker;
		model.transformControl = transformControl;
	}

	renderer.domElement.addEventListener(
		'pointerdown',
		() => {
			if (isLightControlActive()) controls.enabled = false;
		},
		{ capture: true }
	);
	updateLightControls();
}

function updateLightControls() {
	for (const model of Object.values(models)) {
		model.pointLight.intensity = state.pointLightIntensity;
		model.transformControl.enabled = state.showLightControl;
		model.transformControl.visible = state.showLightControl;
		model.lightMarker.visible = state.showLightControl;
	}
}

function isLightControlActive() {
	return Object.values(models).some(
		(model) => model.transformControl?.enabled && (model.transformControl.dragging || model.transformControl.axis)
	);
}

function resetLight() {
	sharedLightPosition.set(0.5, 3.25, 2.6);
	for (const model of Object.values(models)) model.pointLight.position.copy(sharedLightPosition);
}

function rebuild() {
	surfaceData = createSurfaceData(state.angle);
	for (const [mode, model] of Object.entries(models)) {
		disposeMesh(model.mesh);
		const geometry = createGeometry(surfaceData, mode);
		model.mesh = new THREE.Mesh(geometry, createMaterials(state.lighting, state.showTriangles));
		model.mesh.userData.mode = mode;
		model.mesh.visible = state.solidSurface;
		model.scene.add(model.mesh);
		model.visuals.rebuild(surfaceData, model.mesh, state);
		model.visuals.updateInspection(selection, state);
	}
	updateInfo();
}

function updateVisibility() {
	for (const model of Object.values(models)) {
		model.mesh.visible = state.solidSurface;
		model.visuals.applyVisibility(state);
		model.visuals.updateInspection(selection, state);
	}
	updateLightControls();
	legend.classList.toggle('hidden', !state.showLegend);
	updateInfo();
}

function onStateChange(key) {
	if (['angle', 'samplingPosition', 'sampleCount', 'lighting', 'showTriangles', 'unifyMaterials', 'diffuseColor', 'glossiness'].includes(key)) rebuild();
	else if (['pointLightIntensity', 'showLightControl'].includes(key)) updateLightControls();
	else updateVisibility();
}

function applyCameraPreset(view) {
	if (view === 'side') setCamera(new THREE.Vector3(0, 2.5, 8.4), new THREE.Vector3(0, 0.3, 0));
	else if (view === 'top') {
		camera.up.set(0, 0, -1);
		camera.position.set(0, 8.6, 0.001);
		controls.target.set(0, 0.3, 0);
		camera.lookAt(controls.target);
		controls.update();
	} else setCamera(new THREE.Vector3(5.4, 5.1, 7.2));
}

setupMovableLights();
createUI(state, { onChange: onStateChange, onCamera: applyCameraPreset, onResetLight: resetLight });
rebuild();

function viewportAt(clientX) {
	const rect = renderer.domElement.getBoundingClientRect();
	const halfWidth = rect.width / 2;
	const isRight = clientX - rect.left >= halfWidth;
	return {
		mode: isRight ? 'smooth' : 'flat',
		left: rect.left + (isRight ? halfWidth : 0),
		width: halfWidth,
		top: rect.top,
		height: rect.height,
	};
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function inspectAt(event) {
	const viewport = viewportAt(event.clientX);
	pointer.x = ((event.clientX - viewport.left) / viewport.width) * 2 - 1;
	pointer.y = -((event.clientY - viewport.top) / viewport.height) * 2 + 1;
	raycaster.setFromCamera(pointer, camera);
	const hit = raycaster.intersectObject(models[viewport.mode].mesh, false)[0];
	if (!hit || hit.faceIndex == null) return false;

	const triangleIndex = hit.faceIndex;
	const triangle = surfaceData.triangles[triangleIndex];
	selection = {
		triangleIndex,
		weights: barycentric(hit.point, ...triangle.vertices).clone(),
	};
	for (const model of Object.values(models)) model.visuals.updateInspection(selection, state);
	updateInfo();
	return true;
}

function updateInfo() {
	const visible = state.inspectionMode && state.showCalculation && selection;
	infoPanel.classList.toggle('hidden', !visible);
	if (!visible) return;
	const triangle = surfaceData.triangles[selection.triangleIndex];
	const { x, y, z } = selection.weights;
	infoPanel.innerHTML = `<strong>Triángulo: ${triangle.name}</strong><br>Baricéntricas:<br>w₀ = ${x.toFixed(3)}<br>w₁ = ${y.toFixed(3)}<br>w₂ = ${z.toFixed(3)}<br><span>N = normalize(w₀N₀ + w₁N₁ + w₂N₂)</span>`;
}

renderer.domElement.addEventListener('pointerdown', (event) => {
	if (!state.inspectionMode || event.button !== 0 || isLightControlActive()) return;
	if (inspectAt(event)) {
		draggingInspection = true;
		controls.enabled = false;
		renderer.domElement.setPointerCapture(event.pointerId);
		event.preventDefault();
	}
});

renderer.domElement.addEventListener('pointermove', (event) => {
	if (draggingInspection) inspectAt(event);
});

function stopInspection(event) {
	if (!draggingInspection) return;
	draggingInspection = false;
	controls.enabled = true;
	if (event.pointerId != null && renderer.domElement.hasPointerCapture(event.pointerId)) {
		renderer.domElement.releasePointerCapture(event.pointerId);
	}
}

renderer.domElement.addEventListener('pointerup', stopInspection);
renderer.domElement.addEventListener('pointercancel', stopInspection);
window.addEventListener('blur', () => {
	draggingInspection = false;
	controls.enabled = true;
});

function resizeRenderer() {
	const width = container.clientWidth;
	const height = container.clientHeight;
	if (renderer.domElement.width !== Math.round(width * renderer.getPixelRatio()) || renderer.domElement.height !== Math.round(height * renderer.getPixelRatio())) {
		renderer.setSize(width, height, false);
	}
	camera.aspect = width / 2 / height;
	camera.updateProjectionMatrix();
	return { width, height };
}

function animate() {
	requestAnimationFrame(animate);
	controls.update();
	const { width, height } = resizeRenderer();
	const halfWidth = width / 2;
	renderer.setScissor(0, 0, halfWidth, height);
	renderer.setViewport(0, 0, halfWidth, height);
	renderer.render(scenes.flat, camera);
	renderer.setScissor(halfWidth, 0, width - halfWidth, height);
	renderer.setViewport(halfWidth, 0, width - halfWidth, height);
	renderer.render(scenes.smooth, camera);
}

animate();
