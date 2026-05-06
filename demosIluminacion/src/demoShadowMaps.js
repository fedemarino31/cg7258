import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as dat from 'dat.gui';

let scene, camera, renderer, container;
let directionalLightNeedsUpdate, directionalLight, hemiLight, spotLightHelper, shadowHelper;

let params = {
	toggleHelpers: true,
	cameraAngle: -2,
	size: 100,
	near: 0.5,
	far: 300,
	bias: -0.001,
	resolution: 1024,
};

function setupThreeJs() {
	container = document.getElementById('container3D');

	renderer = new THREE.WebGLRenderer();
	renderer.setClearColor(0xccccff);

	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.shadowMapSoft = true;

	scene = new THREE.Scene();

	container.appendChild(renderer.domElement);

	camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
	camera.position.set(150, 100, 0);
	camera.lookAt(0, 0, 0);

	const controls = new OrbitControls(camera, renderer.domElement);

	const grid = new THREE.GridHelper(10, 10);
	scene.add(grid);

	window.addEventListener('resize', onResize);
	onResize();
}

function onResize() {
	camera.aspect = container.offsetWidth / container.offsetHeight;
	camera.updateProjectionMatrix();

	renderer.setSize(container.offsetWidth, container.offsetHeight);
}

function setLights() {
	// Luz direccional

	updateDirectionalLight();
	// Luz hemisferica
	hemiLight = new THREE.HemisphereLight(0x554466, 0x332211, 1);
	scene.add(hemiLight);

	// Luz Puntual
}

function updateDirectionalLight() {
	if (directionalLight) {
		scene.remove(directionalLight);
	}
	if (shadowHelper) {
		scene.remove(shadowHelper);
	}

	directionalLight = new THREE.DirectionalLight(0xffffff, 1);
	directionalLight.position.set(100, 120, 100);

	directionalLight.castShadow = true; // default false
	directionalLight.shadow.mapSize.width = params.resolution;
	directionalLight.shadow.mapSize.height = params.resolution;
	directionalLight.shadow.camera.near = params.near;
	directionalLight.shadow.camera.far = params.far;
	directionalLight.shadow.camera.top = -params.size;
	directionalLight.shadow.camera.left = -params.size;
	directionalLight.shadow.camera.bottom = params.size;
	directionalLight.shadow.camera.right = params.size;
	directionalLight.shadow.bias = params.bias;
	directionalLight.shadow.needsUpdate = true;
	directionalLight.visible = true;

	directionalLight.position.x = 100 * Math.cos(params.cameraAngle);
	directionalLight.position.z = 100 * Math.sin(params.cameraAngle);
	directionalLight.updateMatrixWorld();
	scene.add(directionalLight);

	shadowHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
	scene.add(shadowHelper);
}

function createScene() {
	var loader = new GLTFLoader();

	loader.load(
		'models/shadows.gltf',

		function (gltf) {
			gltf.animations; // Array<THREE.AnimationClip>
			gltf.scene; // THREE.Scene
			gltf.scenes; // Array<THREE.Scene>
			gltf.cameras; // Array<THREE.Camera>
			gltf.asset; // Object

			gltf.scene.traverse(function (child) {
				if (child.isMesh) {
					child.castShadow = true;
					child.receiveShadow = true;
				}
			});

			scene.add(gltf.scene);
		},
		// called while loading is progressing
		function (xhr) {
			console.log((xhr.loaded / xhr.total) * 100 + '% loaded');
		},
		// called when loading has errors
		function (error) {
			console.log('An error happened');
		}
	);
}

function updateLightParams() {
	directionalLightNeedsUpdate = true;
}
function createMenu() {
	let gui = new dat.GUI();
	gui.domElement.id = 'gui';
	gui.add(params, 'cameraAngle', 0, Math.PI * 2);
	gui.add(params, 'bias', -0.2, 0.2).name('Bias').step(0.001).onChange(updateLightParams);
	gui.add(params, 'resolution', [64, 128, 256, 512, 1024, 2048]).name('Resolution').onChange(updateLightParams);
	gui.add(params, 'near', 0, 1000).name('Near').step(0.1).onChange(updateLightParams);
	gui.add(params, 'far', 100, 500).name('Far').step(10).onChange(updateLightParams);
	gui.add(params, 'size', 50, 200).name('Size').onChange(updateLightParams);
}

function animate() {
	requestAnimationFrame(animate);

	if (directionalLightNeedsUpdate) {
		updateDirectionalLight();
		directionalLightNeedsUpdate = false;
	}
	directionalLight.position.x = 100 * Math.cos(params.cameraAngle);
	directionalLight.position.z = 100 * Math.sin(params.cameraAngle);

	renderer.render(scene, camera);
}

setupThreeJs();
createScene();
setLights();
createMenu();

animate();
