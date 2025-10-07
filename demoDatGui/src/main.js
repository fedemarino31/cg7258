import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as dat from 'dat.gui';

let scene, camera, renderer, container, sceneManager, torus;

let params = {
	cantidadTotal: 5,
	alturaMaxima: 10,
	reiniciar: function () {
		alert('apreto reiniciar');
	},
	detener: function () {
		alert('apreto detener');
	},
	modo: 'random',
	ancho: 0,
	umbral: 100,
	samples: 2,
};

function setupThreeJs() {
	container = document.getElementById('container3D');

	renderer = new THREE.WebGLRenderer();
	scene = new THREE.Scene();

	container.appendChild(renderer.domElement);

	camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
	camera.position.set(0, 6, 6);
	camera.lookAt(0, 0, 0);

	const controls = new OrbitControls(camera, renderer.domElement);

	window.addEventListener('resize', onResize);
	onResize();

	const hemiLight = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
	scene.add(hemiLight);

	const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
	dirLight.position.set(5, 10, 7);
	scene.add(dirLight);

	let gridHelper = new THREE.GridHelper(10, 10);
	scene.add(gridHelper);

	torus = new THREE.Mesh(
		new THREE.TorusKnotGeometry(1, 0.4, 100, 16),
		new THREE.MeshPhongMaterial({ color: 0x00ff00 })
	);
	scene.add(torus);
}

function onResize() {
	camera.aspect = container.offsetWidth / container.offsetHeight;
	camera.updateProjectionMatrix();

	renderer.setSize(container.offsetWidth, container.offsetHeight);
}

function createUI() {
	// creamos el menu

	let gui = new dat.GUI();

	gui.add(params, 'cantidadTotal', 0, 10);

	// definimos una carpeta comandos en la variable f1
	let f1 = gui.addFolder('Comandos');

	//el metodo add recibe un objeto y el nombre del atributo o funcion en forma de STRING
	f1.add(params, 'reiniciar').name('Reiniciar');
	f1.add(params, 'detener').name('detener');

	f1.open(); // hace que la carpeta f1 inicie abierta

	let f2 = gui.addFolder('Parametros generales');

	f2.add(params, 'alturaMaxima', 1.0, 60.0).name('altura maxima').step(0.5);
	f2.add(params, 'ancho', 4, 25).name('Ancho');

	f2.add(params, 'modo', ['random', 'secuencial']).name('modo');

	let f3 = gui.addFolder('Parametros Especiales ');
	f3.add(params, 'umbral', 0.0, 200.0).name('umbral');
	f3.add(params, 'samples', 0, 30)
		.name('samples')
		.onChange(function (v) {
			console.log(' cambio el valor de params.samples a ' + v);
		});

	f2.open();
	f3.open();

	let f4 = gui.addFolder('Objeto 3D');
	f4.open();
	f4.add(torus.position, 'x', -10, 10).name('posicion x');
	f4.add(torus.position, 'y', -10, 10).name('posicion y');
	f4.add(torus.position, 'z', -10, 10).name('posicion z');
	f4.add(torus.scale, 'x', 0, 10).name('escala x');
	f4.add(torus.scale, 'y', 0, 10).name('escala y');
	f4.add(torus.scale, 'z', 0, 10).name('escala z');
	f4.add(torus.rotation, 'x', 0, Math.PI * 2).name('rotacion x');
	f4.add(torus.rotation, 'y', 0, Math.PI * 2).name('rotacion y');
	f4.add(torus.rotation, 'z', 0, Math.PI * 2).name('rotacion z');
}

function animate() {
	requestAnimationFrame(animate);
	renderer.render(scene, camera);
}

setupThreeJs();
createUI();
animate();
