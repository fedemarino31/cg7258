import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { configureTeachingCamera } from '../src/scene/teachingCamera.js';

const parameters = { aspect: 2, fov: 50, orthographicSize: 8, near: 2, far: 20 };

test('configura los límites ortográficos respetando el aspect ratio', () => {
	const camera = configureTeachingCamera(new THREE.OrthographicCamera(), parameters);
	assert.deepEqual([camera.left, camera.right, camera.top, camera.bottom], [-8, 8, 4, -4]);
	assert.equal(camera.near, 2);
	assert.equal(camera.far, 20);
});

test('la proyección ortográfica conserva el tamaño con la profundidad', () => {
	const camera = configureTeachingCamera(new THREE.OrthographicCamera(), parameters);
	const nearPoint = new THREE.Vector3(2, 1, -4).project(camera);
	const farPoint = new THREE.Vector3(2, 1, -12).project(camera);
	assert.equal(nearPoint.x, farPoint.x);
	assert.equal(nearPoint.y, farPoint.y);
});

test('la proyección perspectiva reduce el tamaño con la profundidad', () => {
	const camera = configureTeachingCamera(new THREE.PerspectiveCamera(), parameters);
	const nearPoint = new THREE.Vector3(2, 1, -4).project(camera);
	const farPoint = new THREE.Vector3(2, 1, -12).project(camera);
	assert.ok(Math.abs(nearPoint.x) > Math.abs(farPoint.x));
	assert.ok(Math.abs(nearPoint.y) > Math.abs(farPoint.y));
});
