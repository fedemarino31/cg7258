import * as THREE from 'three';

// Escena base del capítulo: un plano de 4 × 4 unidades inclinado, visto por una cámara simulada
// cuyo viewport tiene resolución muy baja. UV = coordenadas locales del plano llevadas a [0,1].
export const PLANE_SIZE = 4;

export const CAMERA_PRESETS = [
	{ value: 'angle', label: 'Vista en ángulo', pos: [2.2, 1.4, 5] },
	{ value: 'front', label: 'Frontal', pos: [0, 0, 6] },
	{ value: 'near', label: 'Cercana', pos: [0.8, 0.5, 2.6] },
	{ value: 'far', label: 'Lejana', pos: [1.5, 1, 12] },
];

export const VIEWPORT_RES = [
	{ value: '8x6', label: '8 × 6', cols: 8, rows: 6 },
	{ value: '16x12', label: '16 × 12', cols: 16, rows: 12 },
	{ value: '32x24', label: '32 × 24', cols: 32, rows: 24 },
];

// Cuatro esquinas de un píxel, en fracciones (x hacia la derecha, y hacia abajo).
const CORNERS = [
	[0, 0],
	[1, 0],
	[1, 1],
	[0, 1],
];

export class SamplerModel {
	constructor() {
		this.camera = new THREE.PerspectiveCamera(40, 4 / 3, 0.1, 30);
		this.raycaster = new THREE.Raycaster();
		this.planeMatrix = new THREE.Matrix4();
		this.inv = new THREE.Matrix4();
		this.plane = new THREE.Plane();
		this.cols = 16;
		this.rows = 12;
		this._n = new THREE.Vector2();
		this._p = new THREE.Vector3();
	}

	// No toca la posición/orientación de la cámara: eso lo maneja moveToPreset(). setup() solo
	// actualiza lo que depende de la resolución y la inclinación del plano.
	// tilt inclina el plano sobre el eje X (como antes); tilt2 le suma un giro lateral sobre el eje Z,
	// aplicado primero, así que el plano queda inclinado en dos ejes a la vez.
	setup({ tilt, tilt2 = 0, cols, rows }) {
		this.cols = cols;
		this.rows = rows;
		this.camera.aspect = cols / rows;
		this.camera.far = this.camera.position.length() * 1.5;
		this.camera.updateProjectionMatrix();
		this.camera.updateMatrixWorld(true);
		const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -THREE.MathUtils.degToRad(tilt));
		const qz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(tilt2));
		this.planeMatrix.makeRotationFromQuaternion(qx.multiply(qz));
		this.inv.copy(this.planeMatrix).invert();
		const normal = new THREE.Vector3(0, 0, 1).transformDirection(this.planeMatrix);
		this.plane.setFromNormalAndCoplanarPoint(normal, new THREE.Vector3());
	}

	// Salta a una posición de cámara preestablecida (acción explícita, no un binding continuo).
	moveToPreset(value) {
		const preset = CAMERA_PRESETS.find((c) => c.value === value) || CAMERA_PRESETS[0];
		this.camera.position.set(...preset.pos);
		this.camera.far = this.camera.position.length() * 1.5;
		this.camera.lookAt(0, 0, 0);
		this.camera.updateProjectionMatrix();
		this.camera.updateMatrixWorld(true);
	}

	// Punto del plano (coordenadas locales) visto en la posición (fx, fy) de píxel; null si no hay superficie.
	localAt(px, py) {
		this._n.set((px / this.cols) * 2 - 1, 1 - (py / this.rows) * 2);
		this.raycaster.setFromCamera(this._n, this.camera);
		const hit = this.raycaster.ray.intersectPlane(this.plane, this._p);
		return hit ? this._p.clone().applyMatrix4(this.inv) : null;
	}

	uvAt(px, py) {
		const l = this.localAt(px, py);
		return l ? [l.x / PLANE_SIZE + 0.5, l.y / PLANE_SIZE + 0.5] : null;
	}

	// Píxel (i, j) contando j desde arriba. `corners` = esquinas en UV; `center` = centro (punto de muestreo).
	footprint(i, j) {
		const local = CORNERS.map(([fx, fy]) => this.localAt(i + fx, j + fy));
		const c = this.localAt(i + 0.5, j + 0.5);
		const toUV = (l) => [l.x / PLANE_SIZE + 0.5, l.y / PLANE_SIZE + 0.5];
		const valid = local.every(Boolean);
		const center = c ? toUV(c) : null;
		return {
			valid,
			local: valid ? local : null,
			corners: valid ? local.map(toUV) : null,
			center,
			hit: !!center && center[0] >= 0 && center[0] <= 1 && center[1] >= 0 && center[1] <= 1,
		};
	}

	// Píxel del viewport que ve un punto del mundo.
	pixelOfWorld(world) {
		const v = world.clone().project(this.camera);
		return [(v.x + 1) / 2, (1 - v.y) / 2];
	}
}

// Área de un polígono UV, medida en texels.
export function areaInTexels(uvs, n) {
	let a = 0;
	for (let i = 0; i < uvs.length; i++) {
		const [x0, y0] = uvs[i];
		const [x1, y1] = uvs[(i + 1) % uvs.length];
		a += x0 * y1 - x1 * y0;
	}
	return Math.abs(a / 2) * n * n;
}
