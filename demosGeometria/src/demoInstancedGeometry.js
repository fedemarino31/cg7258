import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { VertexNormalsHelper } from 'three/addons/helpers/VertexNormalsHelper.js';
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';
import { ParametricGeometries } from 'three/examples/jsm/geometries/ParametricGeometries.js';

import Stats from 'three/examples/jsm/libs/stats.module.js';

const stats = new Stats();

import * as dat from 'dat.gui';
let scene, camera, renderer, container, group, mesh;

const params = {
	count: 10,
};

function setupThreeJs() {
	container = document.getElementById('container3D');
	container.appendChild(stats.dom);
	renderer = new THREE.WebGLRenderer();
	renderer.setClearColor(0x666666);
	scene = new THREE.Scene();

	container.appendChild(renderer.domElement);

	camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
	camera.position.set(120, 120, 120);
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

function buildScene() {
	if (mesh) scene.remove(mesh);

	mesh = createInstancedCylinders(params.count * 1000);
	scene.add(mesh);
}

function createUI() {
	const gui = new dat.GUI();

	let prev = params.multiplier;

	let options = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 1200, 1500];

	gui.add(params, 'count', options).onChange((value) => {
		if (prev != value) {
			buildScene();
		}
		prev = value;
	});
}

function createInstancedCylinders(count) {
	// Crear la geometría instanciada de cilindros
	console.log('cantidad instanciada:' + count);

	const cylinderGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1, true);
	// desplazo 0.5 en y para que el Origen este en la tapa inferior
	cylinderGeometry.translate(0, 0.5, 0);
	//Esto es clave, la geometria tiene que estar alineada con el eje -Z
	// porque el lookAt apunta el -z en la direccion del target
	cylinderGeometry.rotateX(-Math.PI / 2);

	const instancedCylinderGeometry = new THREE.InstancedBufferGeometry();

	instancedCylinderGeometry.copy(cylinderGeometry);

	// Crear el material y el objeto InstancedMesh
	const material = new THREE.MeshNormalMaterial();

	const instancedCylinders = new THREE.InstancedMesh(instancedCylinderGeometry, material, count);

	// Crear matrices de transformación aleatorias para cada instancia
	const rotMatrix = new THREE.Matrix4();
	const translationMatrix = new THREE.Matrix4();
	const matrix = new THREE.Matrix4();

	let origin = new THREE.Vector3();
	const RANGE = 100;

	// orientamos y posicionamos cada instancia
	for (let i = 0; i < count; i++) {
		// la arista va desde position hasta target

		// elijo una posicion al azar
		let position = new THREE.Vector3(
			(Math.random() - 0.5) * RANGE,
			(Math.random() - 0.5) * RANGE,
			(Math.random() - 0.5) * RANGE
		);

		// elijo un target al azar
		let target = new THREE.Vector3(
			(Math.random() - 0.5) * RANGE,
			(Math.random() - 0.5) * RANGE,
			(Math.random() - 0.5) * RANGE
		);
		translationMatrix.makeTranslation(position);

		// determina un direccion entre 0,0,0 y target
		rotMatrix.lookAt(origin, target, new THREE.Vector3(0, 1, 0));

		// calculo distancia entre position y target
		length = target.sub(position).length();

		matrix.identity();
		matrix.makeScale(1, 1, length);
		matrix.premultiply(rotMatrix);
		matrix.premultiply(translationMatrix);

		instancedCylinders.setMatrixAt(i, matrix);
	}

	return instancedCylinders;
}

function animate() {
	requestAnimationFrame(animate);
	stats.begin();
	renderer.render(scene, camera);
	if (mesh) mesh.rotation.y += 0.005;
	stats.end();
}

setupThreeJs();
buildScene();
createUI();
animate();
