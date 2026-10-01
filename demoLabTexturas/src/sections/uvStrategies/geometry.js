import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const positionKey = (p) => `${Math.round(p.x * 1e4)},${Math.round(p.y * 1e4)},${Math.round(p.z * 1e4)}`;

function ensureSoup(geometry) {
	let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
	if (!g.getAttribute('normal')) g.computeVertexNormals();
	return g;
}

function findUvSeams(data) {
	const edges = new Map();
	for (let t = 0; t < data.triangleCount; t++) {
		for (let e = 0; e < 3; e++) {
			const a = data.positionAt(t, e);
			const b = data.positionAt(t, (e + 1) % 3);
			const ka = positionKey(a);
			const kb = positionKey(b);
			const flip = ka > kb;
			const id = flip ? `${kb}|${ka}` : `${ka}|${kb}`;
			const ua = data.uvAt(t, e);
			const ub = data.uvAt(t, (e + 1) % 3);
			if (!edges.has(id)) edges.set(id, []);
			edges.get(id).push({ t, e, u0: flip ? ub : ua, u1: flip ? ua : ub });
		}
	}
	const seams = [];
	for (const list of edges.values()) {
		if (list.length < 2) continue;
		const first = list[0];
		const seam = list.slice(1).some((edge) =>
			Math.hypot(first.u0[0] - edge.u0[0], first.u0[1] - edge.u0[1]) +
			Math.hypot(first.u1[0] - edge.u1[0], first.u1[1] - edge.u1[1]) > 1e-4
		);
		if (seam) list.forEach(({ t, e }) => seams.push({ t, e }));
	}
	return seams;
}

export function geometryData(geometry, { strategy, groups = null, groupNames = ['Todos'], guides = [] } = {}) {
	const g = ensureSoup(geometry);
	const position = g.getAttribute('position');
	const normal = g.getAttribute('normal');
	const uv = g.getAttribute('uv');
	if (!uv) throw new Error('La geometría no contiene coordenadas UV.');
	const triangleCount = position.count / 3;
	const data = {
		geometry: g,
		position: position.array,
		normal: normal.array,
		uv: uv.array,
		triangleCount,
		groups: groups || new Int8Array(triangleCount),
		groupNames,
		strategy,
		guides,
		positionAt(t, k) {
			const i = (t * 3 + k) * 3;
			return new THREE.Vector3(this.position[i], this.position[i + 1], this.position[i + 2]);
		},
		uvAt(t, k) {
			const i = (t * 3 + k) * 2;
			return [this.uv[i], this.uv[i + 1]];
		},
	};
	data.seams = findUvSeams(data);
	return data;
}

function generatedPlane() {
	const geometry = new THREE.PlaneGeometry(3.3, 3.3, 8, 8);
	geometry.rotateX(-Math.PI / 2);
	return geometryData(geometry, { strategy: 'Parámetros de PlaneGeometry: u → ancho, v → profundidad.' });
}

function generatedCylinder() {
	return geometryData(new THREE.CylinderGeometry(1.05, 1.05, 2.8, 32, 8, true), {
		strategy: 'Parámetros de CylinderGeometry: u → ángulo, v → altura.',
	});
}

function generatedBottle() {
	// Perfil tipo botella de vidrio clásica ("contour bottle"), esbelta: base, ensanche inferior
	// acanalado, cintura marcada, cuerpo (zona de etiqueta), hombro y cuello largo hasta la boca.
	// 17 puntos (índices 0..16): la etiqueta va de v=6/16=0.375 a v=10/16=0.625 (25% de la altura),
	// para que coincida con la franja central que dibuja createColaLabelTexture.
	const profile = [
		[0.0, -1.9], [0.42, -1.87], [0.47, -1.74], [0.5, -1.55], [0.4, -1.32],
		[0.33, -1.08], [0.44, -0.86], [0.475, -0.55], [0.475, -0.15], [0.47, 0.2],
		[0.45, 0.42], [0.4, 0.62], [0.28, 0.88], [0.16, 1.08], [0.145, 1.42], [0.17, 1.55], [0.115, 1.66],
	].map(([r, y]) => new THREE.Vector2(r, y));
	return geometryData(new THREE.LatheGeometry(profile, 48), {
		strategy: 'Parámetros de LatheGeometry: u → giro, v → índice del perfil.',
	});
}

function generatedSphere() {
	return geometryData(new THREE.SphereGeometry(1.45, 40, 22), {
		strategy: 'Parámetros de SphereGeometry: u → longitud, v → latitud.',
	});
}

// TubeGeometry devuelve por defecto u → a lo largo del recorrido, v → alrededor de la sección.
// Se invierten para que coincida con la convención del resto del capítulo (como en el cilindro:
// u → ángulo/sección, v → altura/recorrido). Un intercambio simple (u,v) → (v,u) es una reflexión
// (determinante -1): invierte el sentido de giro de la UV respecto al winding de los triángulos y
// la textura queda en espejo. Por eso se combina con un flip de un solo eje, (u,v) → (1-v, u), que
// es una rotación de 90° (orientación preservada) y deja "recorrido" avanzando en el mismo sentido
// que la curva original.
function swapUV(geometry) {
	const uv = geometry.attributes.uv;
	for (let i = 0; i < uv.count; i++) {
		const u = uv.getX(i);
		const v = uv.getY(i);
		uv.setXY(i, 1 - v, u);
	}
	uv.needsUpdate = true;
}

function generatedTube() {
	const curve = new THREE.CatmullRomCurve3([
		V(-2.25, -0.9, -0.65), V(-1.55, 0.55, 0.55), V(-0.65, -0.25, 0.9),
		V(0.15, 0.9, 0.2), V(1.05, -0.35, -0.8), V(2.15, 0.65, 0.35),
	], false, 'catmullrom', 0.28);
	const tubularSegments = 96;
	const radius = 0.34;
	const geometry = new THREE.TubeGeometry(curve, tubularSegments, radius, 14, false);
	swapUV(geometry);
	const path = curve.getPoints(tubularSegments);
	const data = geometryData(geometry, {
		strategy: 'Parámetros de TubeGeometry (invertidos): u → alrededor de la sección, v → a lo largo del recorrido.',
		guides: [{ points: path, color: 0x5b9cff, label: 'v · recorrido' }],
	});
	// Metadatos para recalcular el anillo de la sección transversal en cualquier punto del recorrido (slider).
	data.tube = { curve, radius, tubularSegments };
	return data;
}

// Anillo de la sección transversal del tubo en t ∈ [0,1] a lo largo del recorrido (para el slider).
export function tubeSectionRing(tube, t) {
	const { curve, radius, tubularSegments } = tube;
	const clampedT = Math.min(1, Math.max(0, t));
	const frames = curve.computeFrenetFrames(tubularSegments, false);
	const frameIndex = Math.min(tubularSegments, Math.round(clampedT * tubularSegments));
	const center = curve.getPointAt(clampedT);
	const ring = [];
	for (let i = 0; i <= 32; i++) {
		const a = (i / 32) * Math.PI * 2;
		ring.push(center.clone()
			.addScaledVector(frames.normals[frameIndex], Math.cos(a) * radius * 1.08)
			.addScaledVector(frames.binormals[frameIndex], Math.sin(a) * radius * 1.08));
	}
	return ring;
}

const GENERATED = {
	plane: generatedPlane,
	cylinder: generatedCylinder,
	bottle: generatedBottle,
	sphere: generatedSphere,
	tube: generatedTube,
};

export const GENERATED_OBJECTS = [
	{ value: 'plane', label: 'Plano' },
	{ value: 'cylinder', label: 'Cilindro sin tapas' },
	{ value: 'bottle', label: 'Botella de revolución' },
	{ value: 'sphere', label: 'Esfera' },
	{ value: 'tube', label: 'Barrido tubular' },
];

export function buildGenerated(kind) {
	return GENERATED[kind]();
}

export function buildTerrain() {
	const n = 26;
	const size = 4.6;
	const geometry = new THREE.PlaneGeometry(size, size, n, n);
	geometry.rotateX(-Math.PI / 2);
	const p = geometry.getAttribute('position');
	for (let i = 0; i < p.count; i++) {
		const x = p.getX(i);
		const z = p.getZ(i);
		const ridge = 0.82 * Math.exp(-Math.pow(x + z * 0.12 - 0.55, 2) * 4.2);
		const waves = Math.sin(x * 2.25) * 0.2 + Math.cos(z * 2.7) * 0.16 + Math.sin((x - z) * 3.1) * 0.08;
		p.setY(i, ridge + waves - 0.28);
	}
	geometry.computeVertexNormals();
	const soup = geometry.toNonIndexed();
	const sp = soup.getAttribute('position');
	const uv = new Float32Array(sp.count * 2);
	for (let i = 0; i < sp.count; i++) {
		uv[i * 2] = sp.getX(i) / size + 0.5;
		uv[i * 2 + 1] = sp.getZ(i) / size + 0.5;
	}
	soup.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
	return geometryData(soup, { strategy: 'Proyección planar XZ: u = (x − minX) / rangoX; v = (z − minZ) / rangoZ.' });
}

function buildIrregularColumnGeometry() {
	const radial = 34;
	const rows = 13;
	const height = 3.4;
	const positions = [];
	for (let row = 0; row <= rows; row++) {
		const y = -height / 2 + (row / rows) * height;
		for (let i = 0; i <= radial; i++) {
			const a = (i / radial) * Math.PI * 2;
			const r = 0.95 + 0.075 * Math.sin(a * 3 + row * 0.55) + 0.045 * Math.cos(a * 7 - row * 0.38);
			positions.push(Math.cos(a) * r, y, Math.sin(a) * r);
		}
	}
	const indices = [];
	for (let row = 0; row < rows; row++) for (let i = 0; i < radial; i++) {
		const a = row * (radial + 1) + i;
		const b = a + 1;
		const d = (row + 1) * (radial + 1) + i;
		const c = d + 1;
		indices.push(a, d, b, b, d, c);
	}
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setIndex(indices);
	geometry.computeVertexNormals();
	return geometry.toNonIndexed();
}

export function buildCylindricalProjection() {
	const geometry = buildIrregularColumnGeometry();
	const p = geometry.getAttribute('position');
	const uv = new Float32Array(p.count * 2);
	for (let t = 0; t < p.count / 3; t++) {
		const us = [];
		for (let k = 0; k < 3; k++) {
			const i = t * 3 + k;
			const a = Math.atan2(p.getZ(i), p.getX(i));
			us.push((a + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2));
		}
		if (Math.max(...us) - Math.min(...us) > 0.5) for (let k = 0; k < 3; k++) if (us[k] < 0.5) us[k] += 1;
		for (let k = 0; k < 3; k++) {
			const i = t * 3 + k;
			uv[i * 2] = us[k];
			uv[i * 2 + 1] = (p.getY(i) + 1.7) / 3.4;
		}
	}
	geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
	return geometryData(geometry, { strategy: 'Proyección cilíndrica: u → ángulo alrededor de Y; v → altura normalizada.' });
}

export function buildBoxProjection() {
	let geometry = new THREE.BoxGeometry(2.55, 2.45, 2.6, 9, 9, 9);
	const p = geometry.getAttribute('position');
	for (let i = 0; i < p.count; i++) {
		const x = p.getX(i);
		const y = p.getY(i);
		const z = p.getZ(i);
		const noise = 1 + 0.07 * Math.sin(x * 4.7 + y * 2.1) * Math.cos(z * 3.9 - y * 1.8) + 0.035 * Math.sin((x + z) * 8.1);
		p.setXYZ(i, x * noise, y * noise, z * noise);
	}
	geometry = geometry.toNonIndexed();
	geometry.computeVertexNormals();
	const pos = geometry.getAttribute('position');
	const uv = new Float32Array(pos.count * 2);
	const groups = new Int8Array(pos.count / 3);
	const a = new THREE.Vector3();
	const b = new THREE.Vector3();
	const c = new THREE.Vector3();
	const normal = new THREE.Vector3();
	const norm = (value, half) => THREE.MathUtils.clamp(value / (half * 2) + 0.5, 0, 1);
	for (let t = 0; t < groups.length; t++) {
		a.fromBufferAttribute(pos, t * 3);
		b.fromBufferAttribute(pos, t * 3 + 1);
		c.fromBufferAttribute(pos, t * 3 + 2);
		normal.crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
		const abs = [Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z)];
		const axis = abs.indexOf(Math.max(...abs));
		groups[t] = axis;
		for (let k = 0; k < 3; k++) {
			const i = t * 3 + k;
			const x = norm(pos.getX(i), 1.45);
			const y = norm(pos.getY(i), 1.4);
			const z = norm(pos.getZ(i), 1.45);
			let u;
			let v;
			if (axis === 0) {
				u = normal.x > 0 ? 1 - z : z;
				v = y;
			} else if (axis === 1) {
				u = x;
				v = normal.y > 0 ? z : 1 - z;
			} else {
				u = normal.z > 0 ? x : 1 - x;
				v = y;
			}
			uv[i * 2] = u;
			uv[i * 2 + 1] = v;
		}
	}
	geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
	return geometryData(geometry, {
		strategy: 'Box mapping: cada triángulo elige X, Y o Z según la componente dominante de su normal.',
		groups,
		groupNames: ['X', 'Y', 'Z'],
	});
}

export function dataFromModelGeometry(geometry) {
	return geometryData(geometry, { strategy: 'Unwrap diseñado y almacenado en el atributo UV del archivo GLB.' });
}
