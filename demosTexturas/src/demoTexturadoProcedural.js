import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { VertexNormalsHelper } from 'three/addons/helpers/VertexNormalsHelper.js';
import { ElevationGeometry } from './ElevationGeometry.js';
import { vertexShader, fragmentShader } from './shadersTexturadoProcedural.js';
import * as dat from 'dat.gui';

let scene, camera, renderer, container, material, mesh, arrow;

const textures = {
	tierra: { url: 'tierra.jpg', object: null },
	roca: { url: 'roca.jpg', object: null },
	pasto: { url: 'pasto.jpg', object: null },
	elevationMap1: { url: 'elevationMap1.png', object: null },
};

const params = {
	windDirection: Math.PI / 2,
};

function setupThreeJs() {
	container = document.getElementById('container3D');

	renderer = new THREE.WebGLRenderer();
	scene = new THREE.Scene();

	container.appendChild(renderer.domElement);

	camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
	camera.position.set(-10, 10, 10);
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
			console.error('Error loading texture', key);
			console.error(error);
		});
	}
}

function onTextureLoaded(key, texture) {
	texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
	textures[key].object = texture;
	console.log(`Texture ${key} loaded`);
}

function buildScene() {
	console.log('Building scene');

	const width = 10;
	const height = 10;
	const amplitude = 6;
	const widthSegments = 256;
	const heightSegments = 256;
	const geo = ElevationGeometry(
		width,
		height,
		amplitude,
		widthSegments,
		heightSegments,
		textures.elevationMap1.object
	);

	material = new THREE.RawShaderMaterial({
		uniforms: {
			dirtSampler: { type: 't', value: textures.tierra.object },
			rockSampler: { type: 't', value: textures.roca.object },
			grassSampler: { type: 't', value: textures.pasto.object },
			windDirection: { type: 'v3', value: null },
			sunDirection: { type: 'v3', value: new THREE.Vector3(1, 1, 1).normalize() },
			snowThresholdLow: { type: 'f', value: 2.6 },
			snowThresholdHigh: { type: 'f', value: 3 },
			worldNormalMatrix: { type: 'm4', value: null },
		},
		vertexShader: vertexShader,
		fragmentShader: fragmentShader,
		side: THREE.DoubleSide,
	});

	let normalMaterial = new THREE.MeshNormalMaterial();
	mesh = new THREE.Mesh(geo, material);

	material.needsUpdate = true;
	material.onBeforeRender = (renderer, scene, camera, geometry, mesh) => {
		let m = mesh.matrixWorld.clone();
		m = m.transpose().invert();
		mesh.material.uniforms.worldNormalMatrix.value = m;
	};

	scene.add(mesh);

	const geometryCone = new THREE.ConeGeometry(0.25, 2, 32);
	geometryCone.rotateX(Math.PI / 2);
	const materialCone = new THREE.MeshPhongMaterial({ color: 0xff0000, emissive: 0x330000 });
	arrow = new THREE.Mesh(geometryCone, materialCone);
	scene.add(arrow);
}

function animate() {
	requestAnimationFrame(animate);

	let a = params.windDirection;
	material.uniforms.windDirection.value = new THREE.Vector3(Math.cos(a), 0.5, Math.sin(a)).normalize();

	let x = Math.cos(params.windDirection) * 7;
	let z = Math.sin(params.windDirection) * 7;
	arrow.position.set(x, 4, z);
	arrow.lookAt(0, 4, 0);

	renderer.render(scene, camera);
}

function createMenu() {
	const gui = new dat.GUI({ width: 400 });

	let mat = material;

	gui.add(params, 'windDirection', 0, Math.PI * 2).name('wind direction');

	gui.add(mat.uniforms.snowThresholdLow, 'value', 0, 5).name('snow threshold low');
	gui.add(mat.uniforms.snowThresholdHigh, 'value', 0, 5).name('snow threshold high');
}

loadTextures(start);

function start() {
	setupThreeJs();
	buildScene();
	createMenu();
	animate();
}
