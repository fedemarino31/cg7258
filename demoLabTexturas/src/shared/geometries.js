import * as THREE from 'three';
import { TeapotGeometry } from 'three/examples/jsm/geometries/TeapotGeometry.js';

export function normalizeGeometry(geo, size = 3) {
	geo.computeBoundingBox();
	const c = geo.boundingBox.getCenter(new THREE.Vector3());
	const s = geo.boundingBox.getSize(new THREE.Vector3());
	geo.translate(-c.x, -c.y, -c.z);
	geo.scale(size / Math.max(s.x, s.y, s.z), size / Math.max(s.x, s.y, s.z), size / Math.max(s.x, s.y, s.z));
	geo.computeBoundingSphere();
	return geo;
}

export function makeTeapot(size = 3, segments = 12) {
	return normalizeGeometry(new TeapotGeometry(1, segments), size);
}

export function makeSphere(radius = 1.4) {
	return new THREE.SphereGeometry(radius, 64, 32);
}

// Cubo con UV por defecto de BoxGeometry: cada una de las 6 caras repite la textura completa [0,1]².
export function makeCube(size = 2.6) {
	return new THREE.BoxGeometry(size, size, size);
}

// Cilindro con UV por defecto de CylinderGeometry: en la pared u recorre 0..1 (0°..360°) y v la altura;
// en las tapas (x,z) se proyecta de forma plana sobre [0,1]².
export function makeCylinder(radius = 1.3, height = 2.9, radialSegments = 48, heightSegments = 1) {
	return new THREE.CylinderGeometry(radius, radius, height, radialSegments, heightSegments, false);
}

// Marcador de punto en 3D: dos esferas anidadas (borde negro + relleno de color) sin test de profundidad,
// para que se vea como un punto plano de tamaño constante independientemente del ángulo de vista.
export function makePointMarker({ color = 0xffd84d, radius = 0.045, border = 0.014 } = {}) {
	const group = new THREE.Group();
	const outer = new THREE.Mesh(
		new THREE.SphereGeometry(radius + border, 16, 12),
		new THREE.MeshBasicMaterial({ color: 0x000000, depthTest: false })
	);
	const inner = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), new THREE.MeshBasicMaterial({ color, depthTest: false }));
	outer.renderOrder = 9;
	inner.renderOrder = 10;
	group.add(outer, inner);
	group.userData.setColor = (c) => inner.material.color.set(c);
	return group;
}

// Punto y normal interpolados en el punto de impacto de un raycast (en coordenadas de mundo).
export function hitNormalWorld(hit) {
	const geo = hit.object.geometry;
	const nAttr = geo.attributes.normal;
	const pos = geo.attributes.position;
	const { a, b, c } = hit.face;
	const local = hit.object.worldToLocal(hit.point.clone());
	const bary = new THREE.Vector3();
	THREE.Triangle.getBarycoord(
		local,
		new THREE.Vector3().fromBufferAttribute(pos, a),
		new THREE.Vector3().fromBufferAttribute(pos, b),
		new THREE.Vector3().fromBufferAttribute(pos, c),
		bary
	);
	const n = new THREE.Vector3()
		.fromBufferAttribute(nAttr, a)
		.multiplyScalar(bary.x)
		.addScaledVector(new THREE.Vector3().fromBufferAttribute(nAttr, b), bary.y)
		.addScaledVector(new THREE.Vector3().fromBufferAttribute(nAttr, c), bary.z);
	return n.transformDirection(hit.object.matrixWorld);
}
