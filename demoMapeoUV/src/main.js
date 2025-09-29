import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
let scene, camera, renderer, container, sceneManager;

function setupThreeJs() {
	container = document.getElementById('container3D');

	renderer = new THREE.WebGLRenderer();
	renderer.setClearColor(0xffffff, 1);
	scene = new THREE.Scene();

	container.appendChild(renderer.domElement);

	camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
	camera.position.set(0, 6, 6);
	camera.lookAt(0, 0, 0);

	const controls = new OrbitControls(camera, renderer.domElement);

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
	renderer.render(scene, camera);
}

setupThreeJs();
createScene();

// Crea un cilindro dividido en paredes y tapas.
// radio: número (requerido)
// altura: número (requerido)
// radialSegments: número (opcional, default 64)

function makeSplitCylinder(radius, height, radialSegments = 64) {
	const walls = new THREE.CylinderGeometry(
		radius, // radiusTop
		radius, // radiusBottom
		height, // height
		radialSegments, // radialSegments
		1, // heightSegments
		true // openEnded
	);

	// --- TAPAS ---
	const top = new THREE.CircleGeometry(radius, radialSegments);
	top.rotateX(-Math.PI / 2);
	top.translate(0, height / 2, 0);

	const bottom = new THREE.CircleGeometry(radius, radialSegments);
	bottom.rotateX(Math.PI / 2);
	bottom.translate(0, -height / 2, 0);

	function scaleV(geometry, factor = 10) {
		const uv = geometry.attributes.uv;
		if (uv) {
			for (let i = 0; i < uv.count; i++) {
				uv.setY(i, uv.getY(i) * factor);
			}
			uv.needsUpdate = true;
		}
	}

	scaleV(walls);
	scaleV(top);
	scaleV(bottom);

	return {
		walls,
		caps: {
			top,
			bottom,
		},
	};
}

function createScene() {
	const light = new THREE.DirectionalLight(0xffffff, 2);

	light.position.set(1, 1, 1);
	scene.add(light);

	const ambientLight = new THREE.AmbientLight(0x666666);
	scene.add(ambientLight);

	const grid = new THREE.GridHelper(10, 10);
	scene.add(grid);

	const axes = new THREE.AxesHelper(3);
	scene.add(axes);

	let parts = makeSplitCylinder(1, 6, 32);
	// merge parts into a single geometry
	// get the total number of vertices for each part, print in console separately and total
	console.log('walls vertices:', parts.walls.attributes.position.count);
	console.log('top vertices:', parts.caps.top.attributes.position.count);
	console.log('bottom vertices:', parts.caps.bottom.attributes.position.count);

	// merge geometries
	let geometry = BufferGeometryUtils.mergeGeometries([parts.walls, parts.caps.top, parts.caps.bottom], false);

	// override uvs to map the entire texture on each part
	let uvs = [];
	// walls
	for (let i = 0; i < parts.walls.attributes.uv.count; i++) {
		// get current uv
		let u = parts.walls.attributes.uv.getX(i);
		let v = parts.walls.attributes.uv.getY(i);
		// get vertex position
		let x = parts.walls.attributes.position.getX(i);
		let y = parts.walls.attributes.position.getY(i);
		let z = parts.walls.attributes.position.getZ(i);

		// definir aqui el mapeo UV para las paredes
		u = x;
		v = 0;

		uvs.push(u);
		uvs.push(v);
	}
	// top
	for (let i = 0; i < parts.caps.top.attributes.uv.count; i++) {
		// get current uv
		let u = parts.caps.top.attributes.uv.getX(i);
		let v = parts.caps.top.attributes.uv.getY(i);
		// get vertex position
		let x = parts.caps.top.attributes.position.getX(i);
		let y = parts.caps.top.attributes.position.getY(i);
		let z = parts.caps.top.attributes.position.getZ(i);

		// definir aqui el mapeo UV para la tapa superior
		u = x;
		v = 0;

		uvs.push(u);
		uvs.push(v);
	}
	// bottom
	for (let i = 0; i < parts.caps.bottom.attributes.uv.count; i++) {
		// get current uv
		let u = parts.caps.bottom.attributes.uv.getX(i);
		let v = parts.caps.bottom.attributes.uv.getY(i);
		// get vertex position
		let x = parts.caps.bottom.attributes.position.getX(i);
		let y = parts.caps.bottom.attributes.position.getY(i);
		let z = parts.caps.bottom.attributes.position.getZ(i);

		// definir aqui el mapeo UV para la tapa inferior
		u = x;
		v = 0;

		uvs.push(u);
		uvs.push(v);
	}
	geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

	console.log('total vertices:', geometry.attributes.position.count);
	// load /maps/cap_map.jpg and wall_map.jpg as textures
	let textureLoader = new THREE.TextureLoader();
	let wallTexture = textureLoader.load('/maps/wall_map.jpg');
	let capTexture = textureLoader.load('/maps/cap_map.jpg');
	let uvTexture = textureLoader.load('/maps/uv.jpg');
	// set repeat for all textures
	uvTexture.wrapS = THREE.RepeatWrapping;
	uvTexture.wrapT = THREE.RepeatWrapping;

	let cylinder = new THREE.Mesh(
		geometry,
		new THREE.MeshPhongMaterial({ color: 0xffffff, map: uvTexture, emissive: 0x555555 })
	);
	cylinder.position.set(0, 1.2, 0);
	cylinder.rotation.x = Math.PI / 2;
	scene.add(cylinder);
}

animate();
