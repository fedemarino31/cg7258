import test from 'node:test';
import assert from 'node:assert/strict';
import {
	calculateRasterDimensions,
	ndcToRasterPixel,
	rasterizeTriangles,
} from '../src/pipeline/ScreenRasterizer.js';

const vertex = (x, y, z, cameraDepth = 1) => ({ position: { x, y, z }, cameraDepth });
const triangle = (z, color) => ({
	color,
	lightingNormal: { x: -5, y: 10, z: 6 },
	vertices: [vertex(-1, -1, z), vertex(1, -1, z), vertex(-1, 1, z)],
});

test('calcula una grilla de 64 columnas conservando el aspect ratio', () => {
	assert.deepEqual(calculateRasterDimensions({ width: 1600, height: 900 }), { width: 64, height: 36 });
	assert.deepEqual(calculateRasterDimensions({ width: 900, height: 1600 }), { width: 64, height: 114 });
	assert.deepEqual(calculateRasterDimensions({ width: 500, height: 500 }), { width: 64, height: 64 });
});

test('convierte NDC a pixels e invierte el eje Y', () => {
	assert.deepEqual(ndcToRasterPixel({ x: -1, y: 1 }, 64, 36), { x: 0, y: 0 });
	assert.deepEqual(ndcToRasterPixel({ x: 0, y: 0 }, 64, 36), { x: 32, y: 18 });
	assert.deepEqual(ndcToRasterPixel({ x: 1, y: -1 }, 64, 36), { x: 63, y: 35 });
});

test('el z-buffer conserva el triángulo más cercano sin depender del orden', () => {
	const near = triangle(-0.5, { r: 1, g: 0, b: 0 });
	const far = triangle(0.5, { r: 0, g: 0, b: 1 });
	for (const triangles of [[near, far], [far, near]]) {
		const result = rasterizeTriangles(triangles, { width: 4, height: 4 }, { shadingMode: 'solid' });
		const offset = (2 * 4) * 4;
		assert.deepEqual(Array.from(result.pixels.slice(offset, offset + 3)), [255, 0, 0]);
	}
});

test('el sombreado sólido cambia el tono según la normal de la superficie', () => {
	const color = { r: 0.5, g: 0.5, b: 0.5 };
	const lit = { ...triangle(0, color), lightingNormal: { x: -5, y: 10, z: 6 } };
	const shadowed = { ...triangle(0, color), lightingNormal: { x: 5, y: -10, z: -6 } };
	const options = { shadingMode: 'solid' };
	const litPixels = rasterizeTriangles([lit], { width: 4, height: 4 }, options).pixels;
	const shadowedPixels = rasterizeTriangles([shadowed], { width: 4, height: 4 }, options).pixels;
	assert.ok(litPixels[32] > shadowedPixels[32]);
});
