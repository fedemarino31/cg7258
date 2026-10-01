import * as THREE from 'three';

export const WRAP_GEOMETRIES = [
	{ value: 'plane', label: 'Plano' },
	{ value: 'cylinder', label: 'Cilindro sin tapas' },
	{ value: 'box', label: 'Caja' },
];

// Dominio UV que cubre cada geometría (deliberadamente fuera de [0,1]).
export const UV_DOMAIN = {
	plane: { u: [-2, 3], v: [-1, 2] },
	cylinder: { u: [-2, 3], v: [-1, 2] },
	box: { u: [-1, 2], v: [-1, 2] },
};

export const CAMERA = {
	plane: [2.2, 1.6, 10.5],
	cylinder: [4.6, 2.6, 6.6],
	box: [4.2, 3.2, 5.6],
};

export function buildWrapGeometry(kind) {
	let g;
	if (kind === 'cylinder') g = new THREE.CylinderGeometry(1, 1, 3.77, 40, 6, true);
	else if (kind === 'box') g = new THREE.BoxGeometry(2.4, 2.4, 2.4, 3, 3, 3);
	else g = new THREE.PlaneGeometry(6.5, 3.9, 10, 6);
	const { u, v } = UV_DOMAIN[kind];
	const uv = g.attributes.uv;
	for (let i = 0; i < uv.count; i++) uv.setXY(i, u[0] + (u[1] - u[0]) * uv.getX(i), v[0] + (v[1] - v[0]) * uv.getY(i));
	uv.needsUpdate = true;
	return g;
}

// Devuelve todas las posiciones de la superficie cuyo UV de malla es (u,v).
// En la caja el mismo UV existe en varias caras, por eso puede haber más de un punto.
export function surfacePointsAt(geometry, u, v, max = 6) {
	const pos = geometry.attributes.position;
	const uv = geometry.attributes.uv;
	const nrm = geometry.attributes.normal;
	const idx = geometry.index;
	const out = [];
	const eps = -1e-6;
	const tri = idx.count / 3;
	for (let t = 0; t < tri && out.length < max; t++) {
		const a = idx.getX(t * 3), b = idx.getX(t * 3 + 1), c = idx.getX(t * 3 + 2);
		const ax = uv.getX(a), ay = uv.getY(a);
		const bx = uv.getX(b), by = uv.getY(b);
		const cx = uv.getX(c), cy = uv.getY(c);
		const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
		if (Math.abs(d) < 1e-12) continue;
		const l1 = ((by - cy) * (u - cx) + (cx - bx) * (v - cy)) / d;
		const l2 = ((cy - ay) * (u - cx) + (ax - cx) * (v - cy)) / d;
		const l3 = 1 - l1 - l2;
		if (l1 < eps || l2 < eps || l3 < eps) continue;
		const p = new THREE.Vector3();
		const n = new THREE.Vector3();
		p.addScaledVector(new THREE.Vector3().fromBufferAttribute(pos, a), l1);
		p.addScaledVector(new THREE.Vector3().fromBufferAttribute(pos, b), l2);
		p.addScaledVector(new THREE.Vector3().fromBufferAttribute(pos, c), l3);
		n.addScaledVector(new THREE.Vector3().fromBufferAttribute(nrm, a), l1);
		n.addScaledVector(new THREE.Vector3().fromBufferAttribute(nrm, b), l2);
		n.addScaledVector(new THREE.Vector3().fromBufferAttribute(nrm, c), l3);
		out.push(p.addScaledVector(n.normalize(), 0.04));
	}
	return out;
}
