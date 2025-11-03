import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { vertexShader, fragmentShader } from './shadersComposicion.js';

import * as dat from 'dat.gui';

let scene, camera, renderer, container, material;

let params = {};

const textures = {
	tierra: { url: 'tierra.jpg', object: null },
	roca: { url: 'roca.jpg', object: null },
	pasto: { url: 'pasto.jpg', object: null },
};

function setupThreeJs() {
	container = document.getElementById('container3D');

	renderer = new THREE.WebGLRenderer();
	renderer.setClearColor(0xcccccc);
	scene = new THREE.Scene();

	container.appendChild(renderer.domElement);

	camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 1, 1000);
	camera.position.set(0, 6, 0);
	camera.lookAt(0, 0, 0);

	const controls = new OrbitControls(camera, renderer.domElement);

	const light = new THREE.DirectionalLight(0xffffff, 1);

	light.position.set(1, 1, 1);
	scene.add(light);

	const ambientLight = new THREE.AmbientLight(0x666666);
	scene.add(ambientLight);

	const grid = new THREE.GridHelper(10, 10);
	scene.add(grid);

	window.addEventListener('resize', onResize);
	onResize();
}

function onResize() {
	let aspect = container.offsetWidth / container.offsetHeight;

	camera.left = -5 * aspect;
	camera.right = 5 * aspect;
	camera.top = 5;
	camera.bottom = -5;

	camera.updateProjectionMatrix();

	renderer.setSize(container.offsetWidth, container.offsetHeight);
}

function buildScene() {
	const geometry = new THREE.PlaneGeometry(10, 10, 1, 1);

	material = new THREE.RawShaderMaterial({
		uniforms: {
			tierraSampler: { type: 't', value: textures.tierra.object },
			rocaSampler: { type: 't', value: textures.roca.object },
			pastoSampler: { type: 't', value: textures.pasto.object },
			scale1: { type: 'f', value: 1.0 },

			mask1low: { type: 'f', value: -0.1 },
			mask1high: { type: 'f', value: 0.1 },

			mask2low: { type: 'f', value: -0.3 },
			mask2high: { type: 'f', value: 0.2 },
		},
		vertexShader: vertexShader,
		fragmentShader: fragmentShader,
	});
	material.needsUpdate = true;

	const plane = new THREE.Mesh(geometry, material);
	plane.rotation.x = -Math.PI / 2;
	scene.add(plane);
}

function loadTextures(callback) {
	const loadingManager = new THREE.LoadingManager();

	loadingManager.onLoad = () => {
		console.log('All textures loaded');
		callback();
	};

	for (const key in textures) {
		const loader = new THREE.TextureLoader(loadingManager);
		const texture = textures[key];
		texture.object = loader.load('maps/' + texture.url, onTextureLoaded.bind(this, key), null, (error) => {
			console.error(error);
		});
	}
}

function onTextureLoaded(key, texture) {
	texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
	textures[key].object = texture;
	console.log(`Texture ${key} loaded`);
}

function createMenu() {
	const gui = new dat.GUI({ width: 400 });
	gui.add(material.uniforms.scale1, 'value', 0, 10).name('Scale');
	gui.add(material.uniforms.mask1low, 'value', -1, 1).name('Mask1 Low');
	gui.add(material.uniforms.mask1high, 'value', -1, 1).name('Mask1 High');
	gui.add(material.uniforms.mask2low, 'value', -1, 1).name('Mask2 Low');
	gui.add(material.uniforms.mask2high, 'value', -1, 1).name('Mask2 High');
}

function animate() {
	requestAnimationFrame(animate);
	renderer.render(scene, camera);
}

function start() {
	setupThreeJs();
	animate();
	buildScene();
	createMenu();
}

loadTextures(start);
