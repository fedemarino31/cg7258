import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { createCylinder, createClosedCylinder } from './cylinder.js';

import { VertexNormalsHelper } from 'three/addons/helpers/VertexNormalsHelper.js';
import { ElevationGeometry } from './elevationGeometry.js';

let scene, camera, renderer, container, texture;

function setupThreeJs() {
	container = document.getElementById('container3D');

	renderer = new THREE.WebGLRenderer();
	scene = new THREE.Scene();

	container.appendChild(renderer.domElement);

	camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 1000);
	camera.position.set(-5, 15, 10);
	camera.lookAt(0, 0, 0);

	const controls = new OrbitControls(camera, renderer.domElement);

	const directionalLight = new THREE.DirectionalLight(0xffffff);
	directionalLight.position.set(1, 1, 1);
	scene.add(directionalLight);
	let directionalLightHelper = new THREE.DirectionalLightHelper(directionalLight, 0.2);

	const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x000000, 0.25);
	scene.add(hemisphereLight);

	const gridHelper = new THREE.GridHelper(50, 10);
	scene.add(gridHelper);

	window.addEventListener('resize', onResize);
	onResize();
}

function onResize() {
	camera.aspect = container.offsetWidth / container.offsetHeight;
	camera.updateProjectionMatrix();

	renderer.setSize(container.offsetWidth, container.offsetHeight);
}

function loadTexture() {
	texture = new THREE.TextureLoader().load(
		'maps/elevationMap3.png',
		function (texture) {
			// The texture is loaded
			buildScene();
			console.log('Texture loaded');
		},
		function (xhr) {
			// The texture is being loaded
			console.log((xhr.loaded / xhr.total) * 100 + '% loaded');
		},
		function (error) {
			// The texture was not loaded
			console.log('An error happened');
			console.log(error);
		}
	);
}

function buildScene() {
	console.log('Building scene');
	/*
		

	*/
	const width = 10;
	const height = 10;
	const amplitude = 2;
	const widthSegments = 100;
	const heightSegments = 100;
	const geo = ElevationGeometry(width, height, amplitude, widthSegments, heightSegments, texture);

	let uvTexture = new THREE.TextureLoader().load('maps/uv.jpg');

	const defaultMaterial = new THREE.MeshPhongMaterial({
		color: 0xffffff,
		side: THREE.DoubleSide,
		wireframe: false,
		map: uvTexture,

		flatShading: false,
	});
	const normalMaterial = new THREE.MeshNormalMaterial();

	const mesh = new THREE.Mesh(geo, defaultMaterial);
	scene.add(mesh);

	let helper = new VertexNormalsHelper(mesh, 0.2, 0xffffff, 1);
	//scene.add(helper);
}

function animate() {
	requestAnimationFrame(animate);
	renderer.render(scene, camera);
}

setupThreeJs();
loadTexture();
animate();
