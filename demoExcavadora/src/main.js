import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { SceneManager } from './sceneManager.js';
let scene, camera, renderer, container, sceneManager;
import * as dat from 'dat.gui';
const params = {
	camaraActual: 'general',
	posicionSobreRecorrido: 0,
	anguloCabina: 0,
	anguloBrazo: 45,
	anguloAntebrazo: 45,
	anguloPala: 45,
	anguloEjes: 0,
};

// setup
function setupThreeJs() {
	container = document.getElementById('container3D');

	renderer = new THREE.WebGLRenderer();
	renderer.setClearColor(0x999999);
	scene = new THREE.Scene();

	container.appendChild(renderer.domElement);

	camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
	camera.position.set(400, 400, 400);
	camera.lookAt(0, 0, 0);

	const controls = new OrbitControls(camera, renderer.domElement);

	window.addEventListener('resize', onResize);
	onResize();

	window.addEventListener('keydown', (event) => {
		if (event.key === 'c') {
			switch (params.camaraActual) {
				case 'general':
					params.camaraActual = 'vehiculo';
					break;
				case 'vehiculo':
					params.camaraActual = 'conductor';
					break;
				case 'conductor':
					params.camaraActual = 'general';
					break;
			}
		}
	});
}

function onResize() {
	let aspect = container.offsetWidth / container.offsetHeight;
	camera.aspect = aspect;
	camera.updateProjectionMatrix();

	renderer.setSize(container.offsetWidth, container.offsetHeight);
	if (sceneManager) sceneManager.onResize(aspect);
}

function animate() {
	requestAnimationFrame(animate);
	sceneManager.animate(params);

	let cam;
	switch (params.camaraActual) {
		case 'general':
			cam = camera;
			break;
		case 'vehiculo':
			cam = sceneManager.camaraVehiculo;
			break;
		case 'conductor':
			cam = sceneManager.camaraConductor;
			break;
	}

	renderer.render(scene, cam);
}

function createMenu() {
	const gui = new dat.GUI({ width: 400 });

	gui.add(params, 'camaraActual', ['general', 'vehiculo', 'conductor']).onChange((value) => {});
	gui.add(params, 'posicionSobreRecorrido', 0, 1).step(0.001);
	gui.add(params, 'anguloCabina', 0, 360).step(0.001);
	gui.add(params, 'anguloBrazo', 0, 90).step(0.001);
	gui.add(params, 'anguloAntebrazo', 0, 90).step(0.001);
	gui.add(params, 'anguloPala', 0, 90).step(0.001);
}

setupThreeJs();
sceneManager = new SceneManager(scene);
createMenu();
animate();
