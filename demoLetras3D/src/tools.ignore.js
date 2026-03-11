import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';

function buildTargets(text, scene) {
	text.matrixAutoUpdate = true;
	let mat2 = new THREE.MeshPhongMaterial({
		color: 0xff00ff,
		wireframe: false,
		transparent: true,
		opacity: 0.3,
		side: THREE.DoubleSide,
	});
	let target1 = text.clone();
	target1.material = mat2;
	target1.geometry = text.geometry.clone();
	let target2 = target1.clone();
	target2.geometry = text.geometry.clone();
	let target3 = target1.clone();
	target3.geometry = text.geometry.clone();
	let target4 = target1.clone();
	target4.geometry = text.geometry.clone();

	target1.geometry.scale(1, 2, 1);
	target1.geometry.rotateY(Math.PI / 4);
	target1.geometry.translate(0, 0, -1);

	//target1.position.set(0, 0, -1);
	//target1.rotation.set(0, Math.PI / 4, 0);
	//target1.scale.set(1, 2, 1);

	target2.geometry.scale(2, 1, 1);
	target2.geometry.rotateZ(Math.PI / 4);
	target2.geometry.translate(-2, 0, 0);

	//target2.position.set(-2, 0, 0);
	//target2.rotation.set(0, 0, Math.PI / 4);
	//target2.scale.set(2, 1, 1);

	target3.geometry.scale(0.5, 1, 4);
	target3.geometry.rotateY(Math.PI / 2);
	target3.geometry.translate(-1, 0, 1);

	//target3.position.set(-1, 0, 1);
	//target3.rotation.set(0, Math.PI / 2, 0);
	//target3.scale.set(0.5, 1, 4);

	target4.geometry.scale(-1, 0.5, 1);
	target4.geometry.rotateX(-Math.PI / 4);
	target4.geometry.translate(2, 0, 0);

	//target4.position.set(2, 0, 0);
	//target4.scale.set(-1, 0.25, 1);

	/*
	scene.add(target1);
	scene.add(target2);
	scene.add(target3);
	scene.add(target4);
	*/
	let mergedGeo = BufferGeometryUtils.mergeGeometries([
		target1.geometry,
		target2.geometry,
		target3.geometry,
		target4.geometry,
	]);
	let mergedMesh = new THREE.Mesh(mergedGeo, mat2);
	let scene2 = new THREE.Scene();
	scene2.add(mergedMesh);
	saveGeometryToGLB(scene2, 'text.glb');
}

function saveGeometryToGLB(scene, filename) {
	const exporter = new GLTFExporter();
	const options = {
		binary: true,
		onlyVisible: true,
		trs: false,
		truncateDrawRange: true,
		embedImages: false,
		animations: [],
		forceIndices: false,
		forcePowerOfTwoTextures: false,
		includeCustomExtensions: false,
	};

	exporter.parse(
		scene,
		function (result) {
			if (result instanceof ArrayBuffer) {
				saveArrayBuffer(result, 'scene.glb');
			} else {
				const output = JSON.stringify(result, null, 2);
				console.log(output);
				saveString(output, 'scene.gltf');
			}
		},
		function (error) {
			console.log('An error happened during parsing', error);
		},
		options
	);

	const link = document.createElement('a');
	link.style.display = 'none';
	document.body.appendChild(link); // Firefox workaround, see #6594

	function save(blob, filename) {
		link.href = URL.createObjectURL(blob);
		link.download = filename;
		link.click();

		// URL.revokeObjectURL( url ); breaks Firefox...
	}

	function saveString(text, filename) {
		save(new Blob([text], { type: 'text/plain' }), filename);
	}

	function saveArrayBuffer(buffer, filename) {
		save(new Blob([buffer], { type: 'application/octet-stream' }), filename);
	}
}
