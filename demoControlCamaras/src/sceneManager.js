import * as THREE from 'three';

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

		torus = new THREE.Mesh(
			new THREE.TorusGeometry(1, 0.4, 16, 100),
			new THREE.MeshPhongMaterial({ color: 0xff00ff })
		);
		torus.position.set(0, 1, 0);
		scene.add(torus);

		cone = new THREE.Mesh(new THREE.ConeGeometry(1, 2, 16, 1), new THREE.MeshPhongMaterial({ color: 0x00ffff }));
		cone.position.set(3, 1, 0);
		scene.add(cone);

		cube = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshPhongMaterial({ color: 0xffff00 }));
		cube.rotation.set(0, Math.PI / 4, 0);
		cube.position.set(-3, 1, 0);
		scene.add(cube);
	}

	animate() {
		torus.rotation.x += 0.01;
		torus.rotation.y += 0.01;
	}
}
