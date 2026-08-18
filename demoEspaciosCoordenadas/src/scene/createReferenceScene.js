import * as THREE from 'three';
import { paintGrassChecker } from '../config/grassCheckerConfig.js';

const COLORS = {
	ground: 0x456f5d,
	house: 0xe87549,
	roof: 0x9d3e3e,
	trunk: 0x8a5b3d,
	leaves: 0x67a86b,
	sphere: 0x4f88c6,
	feature: 0xef6fa8,
	cylinder: 0x4f88c6,
};

function material(color) {
	return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true });
}

function pipelineMesh(geometry, color, name) {
	const mesh = new THREE.Mesh(geometry, material(color));
	mesh.name = name;
	mesh.userData.pipelineColor = new THREE.Color(color);
	return mesh;
}

function createGrassCheckerTexture() {
	const canvas = document.createElement('canvas');
	canvas.width = 160;
	canvas.height = 160;
	const context = canvas.getContext('2d');
	paintGrassChecker(context, canvas.width, canvas.height);
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.magFilter = THREE.NearestFilter;
	return texture;
}

export function createReferenceScene() {
	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0x87ceeb);
	const pipelineObjects = [];

	const ambient = new THREE.HemisphereLight(0xd8ecff, 0x342d26, 1.45);
	const sun = new THREE.DirectionalLight(0xfff0d6, 2.2);
	sun.position.set(-5, 10, 6);
	scene.add(ambient, sun);

	const groundGeometry = new THREE.PlaneGeometry(12, 12);
	groundGeometry.rotateX(-Math.PI / 2);
	const ground = pipelineMesh(groundGeometry, COLORS.ground, 'Terreno');
	ground.material.color.set(0xffffff);
	ground.material.map = createGrassCheckerTexture();
	ground.material.needsUpdate = true;
	ground.userData.grassChecker = true;
	ground.position.y = -0.075;
	scene.add(ground);
	pipelineObjects.push(ground);

	const house = pipelineMesh(new THREE.BoxGeometry(2.5, 2, 2.2), COLORS.house, 'Casa');
	house.position.set(-2.7, 1, -1.3);
	scene.add(house);
	pipelineObjects.push(house);

	const roofGeometry = new THREE.ConeGeometry(1.95, 1.3, 4);
	roofGeometry.rotateY(Math.PI / 4);
	const roof = pipelineMesh(roofGeometry, COLORS.roof, 'Techo');
	roof.position.set(-2.7, 2.65, -1.3);
	roof.scale.z = 0.82;
	scene.add(roof);
	pipelineObjects.push(roof);

	const door = pipelineMesh(new THREE.BoxGeometry(0.65, 1.25, 0.12), 0x553b34, 'Puerta');
	door.position.set(-2.7, 0.63, -0.14);
	scene.add(door);
	pipelineObjects.push(door);

	const trunk = pipelineMesh(new THREE.CylinderGeometry(0.25, 0.35, 2.1, 8), COLORS.trunk, 'Tronco');
	trunk.position.set(2.8, 1, -1.9);
	scene.add(trunk);
	pipelineObjects.push(trunk);

	const leaves = pipelineMesh(new THREE.IcosahedronGeometry(1.25, 1), COLORS.leaves, 'Copa');
	leaves.position.set(2.8, 2.65, -1.9);
	scene.add(leaves);
	pipelineObjects.push(leaves);

	//  cylinder
	const cylinder = pipelineMesh(new THREE.CylinderGeometry(0.9, 0.9, 1, 12), COLORS.cylinder, 'Cilindro azul');
	cylinder.position.set(0.5, 1, -2);
	scene.add(cylinder);
	pipelineObjects.push(cylinder);

	const feature = pipelineMesh(new THREE.ConeGeometry(0.9, 2.2, 12, 3), COLORS.feature, 'Cono rosa');
	feature.position.set(0, 1.1, 2.25);
	feature.rotation.set(0, 0.35, 0);
	scene.add(feature);
	pipelineObjects.push(feature);

	// orange torus on the floor
	const torus = pipelineMesh(new THREE.TorusGeometry(0.6, 0.3, 12, 24), 0xffa500, 'Torus naranja');
	torus.position.set(2.5, 0.2, 1);
	torus.rotation.x = Math.PI / 2;
	scene.add(torus);
	pipelineObjects.push(torus);

	const axes = new THREE.AxesHelper(2.6);
	axes.position.y = -0.04;
	scene.add(axes);

	const teachingCamera = new THREE.PerspectiveCamera(46, 1.35, 2, 20);
	teachingCamera.name = 'Teaching Camera';
	teachingCamera.position.set(0, 2.85, 7.8);
	teachingCamera.lookAt(0, 1.25, 0);
	teachingCamera.updateMatrixWorld(true);
	scene.add(teachingCamera);

	const cameraHelper = new THREE.CameraHelper(teachingCamera);
	cameraHelper.name = 'Teaching Camera Frustum';
	scene.add(cameraHelper);

	const cameraBody = new THREE.Group();
	const cameraMaterial = new THREE.MeshBasicMaterial({
		color: 0xffffff,
		transparent: true,
		opacity: 0.5,
		depthWrite: false,
		side: THREE.DoubleSide,
	});
	const body = new THREE.Mesh(
		new THREE.BoxGeometry(0.7, 0.48, 0.9),
		cameraMaterial
	);
	const lens = new THREE.Mesh(
		new THREE.CylinderGeometry(0.2, 0.28, 0.5, 12),
		cameraMaterial
	);
	lens.rotation.x = Math.PI / 2;
	lens.position.z = -0.66;
	cameraBody.add(body, lens);
	teachingCamera.add(cameraBody);

	return {
		scene,
		pipelineObjects,
		feature,
		teachingCamera,
		cameraHelper,
		trackedVertex: { mesh: feature, index: 19 },
	};
}
