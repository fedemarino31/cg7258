import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

//import { VertexNormalsHelper } from 'three/addons/helpers/VertexNormalsHelper.js';
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';
//import { ParametricGeometries } from 'three/examples/jsm/geometries/ParametricGeometries.js';
import * as dat from 'dat.gui';
let scene, camera, renderer, container, group;

const params = {
	currentSurface: 'torus', //plane, waves, torus
	showWireframe: false,
};

function setupThreeJs() {
	container = document.getElementById('container3D');

	renderer = new THREE.WebGLRenderer();
	renderer.setClearColor(0x666666);
	scene = new THREE.Scene();

	container.appendChild(renderer.domElement);

	camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
	camera.position.set(8, 5, 2);
	camera.lookAt(0, 0, 0);

	const controls = new OrbitControls(camera, renderer.domElement);

	const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
	directionalLight.position.set(1, 1, 1);
	scene.add(directionalLight);

	directionalLight.position.set(-2, 2, 1);

	const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x000000, 0.5);
	scene.add(hemisphereLight);

	let pointLight = new THREE.PointLight(0xffffff, 1);
	pointLight.position.set(0, 5, 0);
	scene.add(pointLight);

	const gridHelper = new THREE.GridHelper(20, 10);
	gridHelper.position.y = -1;
	scene.add(gridHelper);

	window.addEventListener('resize', onResize);
	onResize();
}

function onResize() {
	camera.aspect = container.offsetWidth / container.offsetHeight;
	camera.updateProjectionMatrix();

	renderer.setSize(container.offsetWidth, container.offsetHeight);
}

// Funciones para crear superficies paramétricas

// Plane
function getParametricPlaneFunction(width, height) {
	return function (u, v, target) {
		const x = -width / 2 + u * width;
		const y = 0;
		const z = -height / 2 + v * height;

		target.set(x, y, z);
	};
}

// Waves
function getParametricWavesFunction(width, height, freq1 = 3, amplitude = 1) {
	return function (u, v, target) {
		const x = -width / 2 + u * width;

		const z = -height / 2 + v * height;
		let distance = Math.sqrt(x * x + z * z);

		const y = (Math.sin(distance * freq1) * amplitude) / (1 + distance);
		target.set(x, y, z);
	};
}

// Torus
function getParametricTorusFunction(radio1, radio2, from = 0, to = Math.PI * 2, freq = 40, amplitude = 0) {
	return function (u, v, target) {
		// basado en u,v obtener el punto x,y,z de un toroide
		const theta = 2 * Math.PI * u;
		const phi = (to - from) * (from + v);

		const delta = Math.sin(freq * v) * amplitude;

		const z = (radio1 + (radio2 + delta) * Math.cos(theta)) * Math.cos(phi);
		const y = (radio1 + (radio2 + delta) * Math.cos(theta)) * Math.sin(phi);
		const x = (radio2 + delta) * Math.sin(theta);

		target.set(x, y, z);
	};
}

function buildScene() {
	const map = new THREE.TextureLoader().load('https://threejs.org/examples/textures/uv_grid_opengl.jpg');
	map.wrapS = map.wrapT = THREE.RepeatWrapping;
	map.anisotropy = 16;

	const material = new THREE.MeshPhongMaterial({
		color: 0xffffff,
		map: map,
		side: THREE.DoubleSide,
		transparent: true,
		opacity: 0.7,
		shininess: 10,
		specular: 0xffffff,
	});
	const wireMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, side: THREE.DoubleSide });

	let samplingFunction;
	switch (params.currentSurface) {
		case 'plane':
			samplingFunction = getParametricPlaneFunction(10, 10);
			break;
		case 'waves':
			samplingFunction = getParametricWavesFunction(10, 10);
			break;
		case 'torus':
			samplingFunction = getParametricTorusFunction(4, 1, 0, (2 * Math.PI * 3) / 4);
			//samplingFunction = getParametricTorusFunction(4, 1, 0, (2 * Math.PI * 3) / 4, 40, 0.5);
			break;
	}

	if (group) scene.remove(group);
	group = new THREE.Group();
	scene.add(group);

	let geometry = new ParametricGeometry(samplingFunction, 100, 100);
	let mesh = new THREE.Mesh(geometry, material);
	group.add(mesh);
	mesh = new THREE.Mesh(geometry, wireMat);
	if (params.showWireframe) group.add(mesh);
}

function createUI() {
	const gui = new dat.GUI();

	gui.add(params, 'currentSurface', ['plane', 'waves',"torus"]).onChange((value) => {
		buildScene();
	});
	gui.add(params, 'showWireframe').onChange((value) => {
		buildScene();
	});
}

function animate() {
	requestAnimationFrame(animate);
	renderer.render(scene, camera);
}

setupThreeJs();
buildScene();
createUI();
animate();
