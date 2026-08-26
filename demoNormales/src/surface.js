import * as THREE from 'three';
import { barycentric, faceNormal } from './normals.js';

export const TRIANGLE_NAMES = ['A1', 'A2', 'B1', 'B2'];
export const TRIANGLE_COLORS = [0x3d8ea8, 0x55a7bd, 0xd48755, 0xe29b67];

function vertex(x, y, z) {
	return new THREE.Vector3(x, y, z);
}

export function createSurfaceData(angleDegrees) {
	const angle = THREE.MathUtils.degToRad(angleDegrees);
	const c = Math.cos(angle);
	const s = Math.sin(angle);

	const leftLow = vertex(-2, 0, -1.5);
	const leftHigh = vertex(-2, 0, 1.5);
	const hingeLow = vertex(0, 0, -1.5);
	const hingeHigh = vertex(0, 0, 1.5);
	const rightLow = vertex(2 * c, 2 * s, -1.5);
	const rightHigh = vertex(2 * c, 2 * s, 1.5);

	const vertices = [
		[leftLow, hingeHigh, hingeLow],
		[leftLow, leftHigh, hingeHigh],
		[hingeLow, rightHigh, rightLow],
		[hingeLow, hingeHigh, rightHigh],
	];
	const faceNormals = vertices.map(([a, b, c0]) => faceNormal(a, b, c0));
	const normalA = faceNormals[0].clone();
	const normalB = faceNormals[2].clone();
	const normalHinge = normalA.clone().add(normalB).normalize();

	const triangles = vertices.map((triangleVertices, index) => {
		const flatNormals = triangleVertices.map(() => faceNormals[index].clone());
		const smoothNormals = triangleVertices.map((position) => {
			if (Math.abs(position.x) < 1e-6 && Math.abs(position.y) < 1e-6) return normalHinge.clone();
			return index < 2 ? normalA.clone() : normalB.clone();
		});

		return {
			name: TRIANGLE_NAMES[index],
			vertices: triangleVertices.map((position) => position.clone()),
			faceNormal: faceNormals[index].clone(),
			flatNormals,
			smoothNormals,
		};
	});

	return { triangles, normalA, normalB, normalHinge };
}

export function createGeometry(surfaceData, mode) {
	const positions = [];
	const normals = [];

	for (const triangle of surfaceData.triangles) {
		const triangleNormals = mode === 'flat' ? triangle.flatNormals : triangle.smoothNormals;
		for (let index = 0; index < 3; index += 1) {
			positions.push(...triangle.vertices[index].toArray());
			normals.push(...triangleNormals[index].toArray());
		}
	}

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
	for (let index = 0; index < 4; index += 1) geometry.addGroup(index * 3, 3, index);
	geometry.computeBoundingSphere();
	return geometry;
}

export function triangleNormalSet(triangle, mode) {
	return mode === 'flat' ? triangle.flatNormals : triangle.smoothNormals;
}

export function locatePoint(surfaceData, point) {
	const weights = new THREE.Vector3();
	for (let index = 0; index < surfaceData.triangles.length; index += 1) {
		const triangle = surfaceData.triangles[index];
		barycentric(point, ...triangle.vertices, weights);
		if (weights.x >= -1e-5 && weights.y >= -1e-5 && weights.z >= -1e-5) {
			return { triangleIndex: index, weights: weights.clone() };
		}
	}
	return null;
}

