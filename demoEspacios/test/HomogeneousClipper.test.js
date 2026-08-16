import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { clipTriangle } from '../src/pipeline/HomogeneousClipper.js';

const vector = (x, y, z, w = 1) => new THREE.Vector4(x, y, z, w);

test('conserva un triángulo completamente dentro del volumen', () => {
	const result = clipTriangle([vector(-0.5, -0.5, 0), vector(0.5, -0.5, 0), vector(0, 0.5, 0)]);
	assert.equal(result.length, 1);
	assert.ok(result[0].every((vertex) => !vertex.generatedByClipping));
});

test('descarta un triángulo completamente fuera', () => {
	const result = clipTriangle([vector(2, 0, 0), vector(2, 0.5, 0), vector(2, -0.5, 0)]);
	assert.equal(result.length, 0);
});

test('recorta y triangula cuando un vértice queda fuera', () => {
	const result = clipTriangle([vector(-0.5, -0.5, 0), vector(0.5, -0.5, 0), vector(0, 2, 0)]);
	assert.equal(result.length, 2);
	assert.ok(result.flat().some((vertex) => vertex.generatedByClipping));
	assert.ok(result.flat().every(({ position }) => Math.abs(position.x) <= position.w + 1e-8 && Math.abs(position.y) <= position.w + 1e-8));
});

test('recorta correctamente contra el near plane homogéneo', () => {
	const result = clipTriangle([vector(-0.4, -0.4, -2), vector(0.4, -0.4, 0), vector(0, 0.4, 0)]);
	assert.equal(result.length, 2);
	assert.ok(result.flat().every(({ position }) => position.z >= -position.w - 1e-8));
});

test('interpola las coordenadas UV de los vértices generados por clipping', () => {
	const input = [
		{ position: vector(-0.5, -0.5, 0), uv: new THREE.Vector2(0, 0) },
		{ position: vector(0.5, -0.5, 0), uv: new THREE.Vector2(1, 0) },
		{ position: vector(0, 2, 0), uv: new THREE.Vector2(0.5, 1) },
	];
	const result = clipTriangle(input);
	const generated = result.flat().filter((vertex) => vertex.generatedByClipping);
	assert.ok(generated.length > 0);
	assert.ok(generated.every((vertex) => Number.isFinite(vertex.uv.x) && Number.isFinite(vertex.uv.y)));
});

test('interpola la profundidad de cámara de los vértices generados', () => {
	const input = [
		{ position: vector(-0.5, -0.5, 0), cameraDepth: 2 },
		{ position: vector(0.5, -0.5, 0), cameraDepth: 4 },
		{ position: vector(0, 2, 0), cameraDepth: 8 },
	];
	const generated = clipTriangle(input).flat().filter((vertex) => vertex.generatedByClipping);
	assert.ok(generated.length > 0);
	assert.ok(generated.every((vertex) => Number.isFinite(vertex.cameraDepth)));
});
