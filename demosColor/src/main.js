import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { SceneManager } from './sceneManager.js';
import { UIManager } from './UIManager.js';
import * as constants from './constants.js';
// ColorSpace base class is imported by its subclasses (RGBColorSpace, CMYColorSpace, etc.)
// So, no direct import of ColorSpace here unless used for type checking, which is not the case now.

let scene, camera, renderer, container;
let sceneManager, uiManager, controls; // colorSpace instance removed from here

function setupThreeJs() {
	container = document.getElementById('container3D');

	renderer = new THREE.WebGLRenderer();
	scene = new THREE.Scene();

	container.appendChild(renderer.domElement);

	camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 1000);
	camera.position.set(5, 5, 5); // Adjusted camera for a 1x1x1 cube view
	camera.lookAt(0, 0, 0);

	controls = new OrbitControls(camera, renderer.domElement);
	controls.enableDamping = true;
	controls.dampingFactor = 0.2;
	//controls.screenSpacePanning = false;
	controls.minDistance = 1;
	controls.maxDistance = 10;
	// controls.target.set(0, 0, 0); // OrbitControls target is (0,0,0) by default

	// Basic lighting (as per spec: main.js or similar for initial setup)
	const ambientLight = new THREE.AmbientLight(0xffffff); // Softer ambient light
	scene.add(ambientLight);

	const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
	directionalLight.position.set(1, 1.5, 1).normalize();
	scene.add(directionalLight);

	scene.background = new THREE.Color(0x333333); // Add a background color

	//grid
	const gridHelper = new THREE.GridHelper(2, 10);
	scene.add(gridHelper);

	window.addEventListener('resize', onResize);
	onResize();
}

function onResize() {
	camera.aspect = container.offsetWidth / container.offsetHeight;
	camera.updateProjectionMatrix();

	renderer.setSize(container.offsetWidth, container.offsetHeight);
}

function animate() {
	requestAnimationFrame(animate);
	controls.update(); // Update OrbitControls

	// If SceneManager has its own animation logic (e.g. for animated transitions later)
	if (sceneManager && typeof sceneManager.animate === 'function') {
		sceneManager.animate();
	}

	renderer.render(scene, camera);
}

setupThreeJs();

// Instantiate managers
sceneManager = new SceneManager(scene, camera, renderer, controls);
uiManager = new UIManager(sceneManager); // UIManager now only takes sceneManager

// Set UIManager dependency in SceneManager
sceneManager.setUIManager(uiManager);

// UIManager's constructor calls initUI().
// initUI sets up the model selector, which defaults to 'RGB'.
// The onChange handler of the model selector (even on init if it triggers)
// should call sceneManager.setModel(this.currentModel).
// Let's ensure the initial model is set explicitly after UIManager is ready.
if (uiManager.currentModel) {
	sceneManager.setColorModel(uiManager.currentModel);
	// fitCameraToCurrentSpace is now called within sceneManager.setColorModel
} else {
	console.error('UIManager did not initialize currentModel correctly.');
	// Fallback to RGB if something went wrong with UIManager's default model
	sceneManager.setColorModel(constants.initialModel);
}

animate();

// Add a console log to confirm main.js has run and initialized managers
console.log('main.js executed: Scene and Managers initialized.');
console.log('UIManager instance:', uiManager);
console.log('SceneManager instance:', sceneManager);
// console.log('ColorSpace instance:', colorSpace); // colorSpace instance is no longer directly managed here
