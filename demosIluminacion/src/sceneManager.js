import * as THREE from 'three';
import { loadModels } from './../../demoExcavadora/src/loader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

let torus, cube, cone;

export class SceneManager {
	constructor(scene) {
		const light = new THREE.DirectionalLight(0xffffff, 1);

		light.position.set(1, 1, 1);
		scene.add(light);

		const ambientLight = new THREE.AmbientLight(0x666666);
		scene.add(ambientLight);

		const grid = new THREE.GridHelper(10, 10);
		scene.add(grid);

		const axes = new THREE.AxesHelper(3);
		scene.add(axes);
	}

	loadModels(scene) {}

	animate() {}
}
