import * as THREE from 'three';

// Each function is positive on the visible side of its homogeneous clip plane.
export const CLIP_PLANES = [
	(v) => v.w + v.x,
	(v) => v.w - v.x,
	(v) => v.w + v.y,
	(v) => v.w - v.y,
	(v) => v.w + v.z,
	(v) => v.w - v.z,
];

export function interpolateVertex(a, b, t) {
	return {
		position: new THREE.Vector4().lerpVectors(a.position, b.position, t),
		uv: a.uv && b.uv ? new THREE.Vector2().lerpVectors(a.uv, b.uv, t) : undefined,
		cameraDepth: Number.isFinite(a.cameraDepth) && Number.isFinite(b.cameraDepth)
			? THREE.MathUtils.lerp(a.cameraDepth, b.cameraDepth, t)
			: undefined,
		generatedByClipping: true,
	};
}

export function clipPolygonAgainstPlane(polygon, plane) {
	if (!polygon.length) return [];
	const output = [];
	for (let index = 0; index < polygon.length; index += 1) {
		const current = polygon[index];
		const previous = polygon[(index + polygon.length - 1) % polygon.length];
		const currentDistance = plane(current.position);
		const previousDistance = plane(previous.position);
		const currentInside = currentDistance >= 0;
		const previousInside = previousDistance >= 0;

		if (currentInside !== previousInside) {
			const t = previousDistance / (previousDistance - currentDistance);
			output.push(interpolateVertex(previous, current, t));
		}
		if (currentInside) output.push(current);
	}
	return output;
}

export function clipTriangle(vertices) {
	let polygon = vertices.map((vertex) => vertex.position
		? { ...vertex, position: vertex.position.clone(), uv: vertex.uv?.clone(), generatedByClipping: false }
		: { position: vertex.clone(), generatedByClipping: false });
	for (const plane of CLIP_PLANES) {
		polygon = clipPolygonAgainstPlane(polygon, plane);
		if (!polygon.length) return [];
	}

	const triangles = [];
	for (let index = 1; index < polygon.length - 1; index += 1) {
		triangles.push([polygon[0], polygon[index], polygon[index + 1]]);
	}
	return triangles;
}
