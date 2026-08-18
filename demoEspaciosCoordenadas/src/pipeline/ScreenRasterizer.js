import { SCREEN_RASTER_CONFIG } from '../config/screenRasterConfig.js';
import { sampleGrassChecker } from '../config/grassCheckerConfig.js';

const BACKGROUND = [135, 206, 235];
const SUN_DIRECTION = normalizeVector({ x: -5, y: 10, z: 6 });

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function calculateRasterDimensions(viewport, rasterWidth = SCREEN_RASTER_CONFIG.width) {
	const safeWidth = Math.max(1, viewport.width);
	const safeHeight = Math.max(1, viewport.height);
	const width = Math.max(1, Math.round(rasterWidth));
	return {
		width,
		height: Math.max(1, Math.round(width * safeHeight / safeWidth)),
	};
}

export function ndcToRasterPosition(position, width, height) {
	return {
		x: (position.x * 0.5 + 0.5) * width,
		y: (1 - (position.y * 0.5 + 0.5)) * height,
	};
}

export function ndcToRasterPixel(position, width, height) {
	const raster = ndcToRasterPosition(position, width, height);
	return {
		x: clamp(Math.floor(raster.x), 0, width - 1),
		y: clamp(Math.floor(raster.y), 0, height - 1),
	};
}

function edge(a, b, point) {
	return (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x);
}

function distanceIntensity(distance, near, far) {
	const normalized = clamp((distance - near) / Math.max(far - near, 1e-6), 0, 1);
	return 0.94 - normalized * 0.8;
}

function normalizeVector(vector) {
	const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
	return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function solidLightIntensity(triangle) {
	const normal = normalizeVector(triangle.lightingNormal ?? { x: 0, y: 0, z: 1 });
	const hemisphere = 0.34 + (normal.y * 0.5 + 0.5) * 0.18;
	const diffuse = Math.max(
		normal.x * SUN_DIRECTION.x + normal.y * SUN_DIRECTION.y + normal.z * SUN_DIRECTION.z,
		0
	) * 0.72;
	return clamp(hemisphere + diffuse, 0.28, 1.18);
}

function perspectiveCorrectUv(triangle, weights) {
	if (!triangle.mesh?.userData.grassChecker) return null;
	let denominator = 0;
	let u = 0;
	let v = 0;
	triangle.vertices.forEach((vertex, index) => {
		const reciprocalW = 1 / Math.max(Math.abs(vertex.clipW ?? vertex.cameraDepth), 1e-7);
		const weighted = weights[index] * reciprocalW;
		denominator += weighted;
		u += vertex.uv.x * weighted;
		v += vertex.uv.y * weighted;
	});
	return { x: u / denominator, y: v / denominator };
}

function shadePixel(triangle, weights, shadingMode, depthRange) {
	if (shadingMode === 'distance') {
		const intensity = triangle.vertices.reduce((sum, vertex, index) => (
			sum + distanceIntensity(vertex.cameraDepth, depthRange.near, depthRange.far) * weights[index]
		), 0);
		const channel = Math.round(intensity * 255);
		return [channel, channel, channel, 1];
	}

	const checkerUv = perspectiveCorrectUv(triangle, weights);
	const baseColor = checkerUv ? sampleGrassChecker(checkerUv) : (triangle.color ?? { r: 1, g: 1, b: 1 });
	const alpha = shadingMode === 'wireframe' ? 0.42 : 1;
	const light = shadingMode === 'solid' ? solidLightIntensity(triangle) : 1;
	return [
		Math.round(clamp(baseColor.r * light, 0, 1) * 255),
		Math.round(clamp(baseColor.g * light, 0, 1) * 255),
		Math.round(clamp(baseColor.b * light, 0, 1) * 255),
		alpha,
	];
}

export function rasterizeTriangles(triangles, dimensions, options = {}) {
	const { width, height } = dimensions;
	const shadingMode = options.shadingMode ?? 'solid';
	const depthRange = options.depthRange ?? { near: 0, far: 1 };
	const pixels = new Uint8ClampedArray(width * height * 4);
	const depth = new Float64Array(width * height);
	depth.fill(Number.POSITIVE_INFINITY);

	for (let index = 0; index < width * height; index += 1) {
		const offset = index * 4;
		pixels[offset] = BACKGROUND[0];
		pixels[offset + 1] = BACKGROUND[1];
		pixels[offset + 2] = BACKGROUND[2];
		pixels[offset + 3] = 255;
	}

	for (const triangle of triangles) {
		const points = triangle.vertices.map((vertex) => ndcToRasterPosition(vertex.position, width, height));
		const area = edge(points[0], points[1], points[2]);
		if (Math.abs(area) < 1e-10) continue;

		const minimumX = clamp(Math.floor(Math.min(...points.map((point) => point.x))), 0, width - 1);
		const maximumX = clamp(Math.ceil(Math.max(...points.map((point) => point.x))) - 1, 0, width - 1);
		const minimumY = clamp(Math.floor(Math.min(...points.map((point) => point.y))), 0, height - 1);
		const maximumY = clamp(Math.ceil(Math.max(...points.map((point) => point.y))) - 1, 0, height - 1);

		for (let y = minimumY; y <= maximumY; y += 1) {
			for (let x = minimumX; x <= maximumX; x += 1) {
				const sample = { x: x + 0.5, y: y + 0.5 };
				const weights = [
					edge(points[1], points[2], sample) / area,
					edge(points[2], points[0], sample) / area,
					edge(points[0], points[1], sample) / area,
				];
				if (weights.some((weight) => weight < -1e-9)) continue;

				const fragmentDepth = triangle.vertices.reduce((sum, vertex, index) => (
					sum + vertex.position.z * weights[index]
				), 0);
				const pixelIndex = y * width + x;
				if (fragmentDepth >= depth[pixelIndex]) continue;

				depth[pixelIndex] = fragmentDepth;
				const [red, green, blue, alpha] = shadePixel(triangle, weights, shadingMode, depthRange);
				const offset = pixelIndex * 4;
				pixels[offset] = Math.round(red * alpha + BACKGROUND[0] * (1 - alpha));
				pixels[offset + 1] = Math.round(green * alpha + BACKGROUND[1] * (1 - alpha));
				pixels[offset + 2] = Math.round(blue * alpha + BACKGROUND[2] * (1 - alpha));
			}
		}
	}

	return { pixels, depth, width, height };
}
