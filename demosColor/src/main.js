import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { SceneManager } from './sceneManager.js';
import { UIManager } from './UIManager.js';
import * as constants from './constants.js';

let scene, renderer, container;
let sceneManager, uiManager, perspCamera, perspControls;

function setupThreeJs() {
	container = document.getElementById('container3D');

	renderer = new THREE.WebGLRenderer({ antialias: true });
	scene = new THREE.Scene();
	container.appendChild(renderer.domElement);

	perspCamera = new THREE.PerspectiveCamera(35, container.offsetWidth / container.offsetHeight, 0.1, 1000);
	perspCamera.position.set(5, 5, 5);
	perspCamera.lookAt(0, 0, 0);

	perspControls = new OrbitControls(perspCamera, renderer.domElement);
	perspControls.enableDamping = true;
	perspControls.dampingFactor = 0.2;
	perspControls.minDistance = 0.5;
	perspControls.maxDistance = 20;

	const ambientLight = new THREE.AmbientLight(0xffffff);
	scene.add(ambientLight);

	const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
	directionalLight.position.set(1, 1.5, 1).normalize();
	scene.add(directionalLight);

	scene.background = new THREE.Color(0x333333);

	const gridHelper = new THREE.GridHelper(2, 10);
	//scene.add(gridHelper);

	window.addEventListener('resize', onResize);
	onResize();
}

function onResize() {
	const w = container.offsetWidth;
	const h = container.offsetHeight;
	renderer.setSize(w, h);
	if (sceneManager) {
		sceneManager.onResize(w, h);
	} else {
		perspCamera.aspect = w / h;
		perspCamera.updateProjectionMatrix();
	}
}

function animate() {
	requestAnimationFrame(animate);

	const controls = sceneManager ? sceneManager.getActiveControls() : perspControls;
	controls.update();

	const camera = sceneManager ? sceneManager.getActiveCamera() : perspCamera;
	renderer.render(scene, camera);
}

setupThreeJs();

sceneManager = new SceneManager(scene, perspCamera, renderer, perspControls);
uiManager = new UIManager(sceneManager);
sceneManager.setUIManager(uiManager);

if (uiManager.currentModel) {
	sceneManager.setColorModel(uiManager.currentModel);
} else {
	sceneManager.setColorModel(constants.initialModel);
}

animate();

// ── Toolbar view buttons ──────────────────────────────────────────
function setupToolbar() {
	const viewButtons = ['btn-perspective', 'btn-top', 'btn-left', 'btn-front'];
	const viewMap = {
		'btn-perspective': 'perspective',
		'btn-top': 'top',
		'btn-left': 'left',
		'btn-front': 'front',
	};

	viewButtons.forEach(id => {
		const btn = document.getElementById(id);
		if (!btn) return;
		btn.addEventListener('click', () => {
			viewButtons.forEach(b => document.getElementById(b)?.classList.remove('active'));
			btn.classList.add('active');
			sceneManager.switchView(viewMap[id]);
		});
	});

	// Rendering mode buttons
	const solidBtn = document.getElementById('btn-solid');
	const dotsBtn  = document.getElementById('btn-dots');
	const subsetSelect = document.getElementById('select-subset');
	const toleranceRange = document.getElementById('range-tolerance');

	solidBtn?.addEventListener('click', () => {
		solidBtn.classList.add('active');
		dotsBtn?.classList.remove('active');
		sceneManager.setRenderingMode('solid');
		uiManager.setDotsControlsVisible(false);
		if (subsetSelect) subsetSelect.disabled = true;
		if (toleranceRange) toleranceRange.disabled = true;
	});

	dotsBtn?.addEventListener('click', () => {
		dotsBtn.classList.add('active');
		solidBtn?.classList.remove('active');
		sceneManager.setRenderingMode('dots');
		uiManager.setDotsControlsVisible(true);
		if (subsetSelect) subsetSelect.disabled = false;
		if (toleranceRange) toleranceRange.disabled = false;
	});

	// Color subset selector (only active in dots mode)
	subsetSelect?.addEventListener('change', () => {
		sceneManager.setDotsSubset(subsetSelect.value);
	});

	// Subset tolerance slider (only active in dots mode)
	toleranceRange?.addEventListener('input', () => {
		sceneManager.setDotsTolerance(parseFloat(toleranceRange.value));
	});

	// ── Keyboard shortcuts ─────────────────────────────────────────
	// 'c' cycles views; '1'..'4' switch color models.
	const viewOrder = ['btn-perspective', 'btn-top', 'btn-left', 'btn-front'];
	const modelKeys = { '1': 'RGB', '2': 'CMY', '3': 'HSV', '4': 'HSL' };

	window.addEventListener('keydown', (ev) => {
		// Ignore when typing in an input/select (e.g. the subset dropdown).
		const tag = ev.target?.tagName;
		if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

		const key = ev.key.toLowerCase();

		if (key === 'c') {
			const currentIdx = viewOrder.findIndex(id =>
				document.getElementById(id)?.classList.contains('active'));
			const nextId = viewOrder[(currentIdx + 1) % viewOrder.length];
			document.getElementById(nextId)?.click();
		} else if (modelKeys[ev.key]) {
			sceneManager.setColorModel(modelKeys[ev.key]);
		}
	});
}

setupToolbar();
