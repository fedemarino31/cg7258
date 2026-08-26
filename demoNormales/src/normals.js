import * as THREE from 'three';

export function faceNormal(a, b, c) {
	return new THREE.Vector3()
		.crossVectors(new THREE.Vector3().subVectors(b, a), new THREE.Vector3().subVectors(c, a))
		.normalize();
}

export function barycentric(point, a, b, c, target = new THREE.Vector3()) {
	THREE.Triangle.getBarycoord(point, a, b, c, target);
	return target;
}

export function interpolateNormal(weights, normals, target = new THREE.Vector3()) {
	return target
		.set(0, 0, 0)
		.addScaledVector(normals[0], weights.x)
		.addScaledVector(normals[1], weights.y)
		.addScaledVector(normals[2], weights.z)
		.normalize();
}

export function interpolatePosition(weights, triangle, target = new THREE.Vector3()) {
	return target
		.set(0, 0, 0)
		.addScaledVector(triangle.vertices[0], weights.x)
		.addScaledVector(triangle.vertices[1], weights.y)
		.addScaledVector(triangle.vertices[2], weights.z);
}

