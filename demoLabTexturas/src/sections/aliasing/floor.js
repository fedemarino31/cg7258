import * as THREE from 'three';

// Escena base del capítulo: un piso texturado visto por una cámara simulada de baja resolución.
// El muestreo del viewport se emula por CPU (nearest / linear / mipmaps / anisotropía) para poder
// inspeccionar cada píxel; la vista 3D usa los filtros reales de la GPU con la misma configuración.
export const TILE = 8; // unidades de mundo por repetición de la textura
export const TEX_SIZE = 256;
export const FLOOR = { halfW: 60, zNear: 10, zFar: -290 };
export const FOV = 50;
export const MAX_LEVEL = Math.log2(TEX_SIZE);

// ---------- texturas diagnósticas (256 × 256, repetibles) ----------
function canvas256() {
	const c = document.createElement('canvas');
	c.width = c.height = TEX_SIZE;
	return [c, c.getContext('2d')];
}

// Gris claro / gris oscuro (no blanco/negro puro): así el checker no compite visualmente con el
// contorno rojo del frustum ni con el amarillo de la huella del píxel en la escena 3D.
function checker() {
	const [c, g] = canvas256();
	g.fillStyle = '#9a9fa8';
	g.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
	g.fillStyle = '#44484f';
	const s = 16;
	for (let j = 0; j < TEX_SIZE / s; j++) for (let i = 0; i < TEX_SIZE / s; i++) if ((i + j) % 2) g.fillRect(i * s, j * s, s, s);
	return c;
}

function lines() {
	const [c, g] = canvas256();
	g.fillStyle = '#1c2029';
	g.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
	g.fillStyle = '#f0f0f2';
	for (let y = 0; y < TEX_SIZE; y += 8) g.fillRect(0, y, TEX_SIZE, 4);
	return c;
}

function grid() {
	const [c, g] = canvas256();
	g.fillStyle = '#1c2029';
	g.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
	g.fillStyle = '#f0f0f2';
	for (let k = 0; k < TEX_SIZE; k += 16) {
		g.fillRect(k, 0, 2, TEX_SIZE);
		g.fillRect(0, k, TEX_SIZE, 2);
	}
	return c;
}

export const FLOOR_TEXTURES = [
	{ value: 'checker', label: 'Checkerboard de alta frecuencia', make: checker },
	{ value: 'lines', label: 'Líneas periódicas', make: lines },
	{ value: 'grid', label: 'Cuadriculado fino', make: grid },
];

// ---------- cadena de mipmaps (promedio 2×2 en espacio lineal) ----------
const LIN = new Float32Array(256).map((_, i) => Math.pow(i / 255, 2.2));
const toByte = (x) => Math.round(255 * Math.pow(Math.max(0, Math.min(1, x)), 1 / 2.2));

export function buildMips(canvas) {
	const src = canvas.getContext('2d').getImageData(0, 0, TEX_SIZE, TEX_SIZE).data;
	let cur = new Float32Array(TEX_SIZE * TEX_SIZE * 3);
	for (let k = 0; k < TEX_SIZE * TEX_SIZE; k++) for (let c = 0; c < 3; c++) cur[k * 3 + c] = LIN[src[k * 4 + c]];
	const levels = [{ size: TEX_SIZE, data: cur }];
	for (let size = TEX_SIZE / 2; size >= 1; size /= 2) {
		const prev = levels[levels.length - 1];
		const next = new Float32Array(size * size * 3);
		for (let y = 0; y < size; y++)
			for (let x = 0; x < size; x++)
				for (let c = 0; c < 3; c++) {
					const p = (i, j) => prev.data[((2 * y + j) * prev.size + 2 * x + i) * 3 + c];
					next[(y * size + x) * 3 + c] = (p(0, 0) + p(1, 0) + p(0, 1) + p(1, 1)) / 4;
				}
		levels.push({ size, data: next });
	}
	return levels;
}

// Nivel como bytes sRGB RGBA (para texturas de GPU y miniaturas).
export function levelBytes(level) {
	const out = new Uint8Array(level.size * level.size * 4);
	for (let k = 0; k < level.size * level.size; k++) {
		out[k * 4] = toByte(level.data[k * 3]);
		out[k * 4 + 1] = toByte(level.data[k * 3 + 1]);
		out[k * 4 + 2] = toByte(level.data[k * 3 + 2]);
		out[k * 4 + 3] = 255;
	}
	return out;
}

// ---------- muestreo emulado ----------
const wrap = (i, n) => ((i % n) + n) % n;

// Acumula w × color del nivel en `acc`. (u, v) normalizados; fila 0 = arriba de la imagen.
function fetchLevel(level, u, v, linear, w, acc) {
	const n = level.size;
	const d = level.data;
	if (!linear) {
		const o = (wrap(Math.floor(v * n), n) * n + wrap(Math.floor(u * n), n)) * 3;
		acc[0] += w * d[o];
		acc[1] += w * d[o + 1];
		acc[2] += w * d[o + 2];
		return;
	}
	const x = u * n - 0.5;
	const y = v * n - 0.5;
	const x0 = Math.floor(x);
	const y0 = Math.floor(y);
	const fx = x - x0;
	const fy = y - y0;
	const xa = wrap(x0, n);
	const xb = wrap(x0 + 1, n);
	const ya = wrap(y0, n) * n;
	const yb = wrap(y0 + 1, n) * n;
	const w00 = (1 - fx) * (1 - fy) * w;
	const w10 = fx * (1 - fy) * w;
	const w01 = (1 - fx) * fy * w;
	const w11 = fx * fy * w;
	for (let c = 0; c < 3; c++) acc[c] += w00 * d[(ya + xa) * 3 + c] + w10 * d[(ya + xb) * 3 + c] + w01 * d[(yb + xa) * 3 + c] + w11 * d[(yb + xb) * 3 + c];
}

// Devuelve { color, lod, samples, major, minor } para un píxel con derivadas dudx, dvdx, dudy, dvdy (en UV).
// mip: usar mipmaps. linear: filtro. aniso: máximo de muestras anisotrópicas. forced: nivel fijo o null.
export function shade(levels, { mip, linear, aniso, forced }, u, v, dudx, dvdx, dudy, dvdy) {
	const S = TEX_SIZE;
	const px = Math.hypot(dudx * S, dvdx * S);
	const py = Math.hypot(dudy * S, dvdy * S);
	const major = Math.max(px, py);
	const minor = Math.max(1e-6, Math.min(px, py));
	const acc = [0, 0, 0];
	// La imagen tiene la fila 0 arriba: v de imagen = -v de UV (la repetición es periódica).
	if (!mip) {
		fetchLevel(levels[0], u, -v, linear, 1, acc);
		return { color: acc, lod: 0, samples: 1, major, minor };
	}
	const [mx, my] = px >= py ? [dudx, dvdx] : [dudy, dvdy];
	const n = aniso > 1 ? Math.max(1, Math.min(aniso, Math.ceil(major / minor))) : 1;
	let lod = forced ?? Math.log2(Math.max(major / n, 1e-6));
	lod = Math.max(0, Math.min(MAX_LEVEL, lod));
	const l0 = Math.floor(lod);
	const f = lod - l0;
	for (let k = 0; k < n; k++) {
		const t = (k + 0.5) / n - 0.5;
		const su = u + mx * t;
		const sv = -(v + my * t);
		if (!linear) {
			fetchLevel(levels[Math.min(MAX_LEVEL, Math.round(lod))], su, sv, false, 1 / n, acc);
		} else {
			fetchLevel(levels[l0], su, sv, true, (1 - f) / n, acc);
			if (f > 0) fetchLevel(levels[Math.min(MAX_LEVEL, l0 + 1)], su, sv, true, f / n, acc);
		}
	}
	return { color: acc, lod, samples: n, major, minor };
}

export const linToCss = (c) => `rgb(${toByte(c[0])},${toByte(c[1])},${toByte(c[2])})`;
export const linToBytes = (c) => [toByte(c[0]), toByte(c[1]), toByte(c[2])];

// ---------- cámara y piso ----------
export class FloorModel {
	constructor() {
		this.camera = new THREE.PerspectiveCamera(FOV, 4 / 3, 0.1, 30);
		this.cols = 160;
		this.rows = 120;
	}

	setup({ height, pitch, advance, cols, rows }) {
		this.cols = cols;
		this.rows = rows;
		this.pos = [0, height, 2 - advance];
		const p = THREE.MathUtils.degToRad(pitch);
		this.fwd = [0, -Math.sin(p), -Math.cos(p)];
		this.up = [0, Math.cos(p), -Math.sin(p)];
		this.tanY = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
		this.tanX = (this.tanY * cols) / rows;
		const c = this.camera;
		c.aspect = cols / rows;
		c.position.set(...this.pos);
		c.rotation.set(-p, 0, 0);
		c.updateProjectionMatrix();
		c.updateMatrixWorld(true);
	}

	// Punto del piso visto en la posición (px, py) del viewport (py hacia abajo). null si es cielo.
	hit(px, py) {
		const nx = (px / this.cols) * 2 - 1;
		const ny = 1 - (py / this.rows) * 2;
		const dx = nx * this.tanX;
		const dy = this.fwd[1] + this.up[1] * ny * this.tanY;
		if (dy > -1e-6) return null;
		const dz = this.fwd[2] + this.up[2] * ny * this.tanY;
		const t = -this.pos[1] / dy;
		const x = this.pos[0] + t * dx;
		const z = this.pos[2] + t * dz;
		if (Math.abs(x) > FLOOR.halfW || z > FLOOR.zNear || z < FLOOR.zFar) return null;
		return { u: x / TILE, v: z / TILE, x, z, t };
	}

	// Derivadas por píxel (en UV) a partir de las cuatro esquinas.
	derivs(c) {
		const [a, b, d, e] = c; // arriba-izq, arriba-der, abajo-der, abajo-izq
		return {
			dudx: (b.u - a.u + d.u - e.u) / 2,
			dvdx: (b.v - a.v + d.v - e.v) / 2,
			dudy: (e.u - a.u + d.u - b.u) / 2,
			dvdy: (e.v - a.v + d.v - b.v) / 2,
		};
	}

	footprint(i, j) {
		const corners = [this.hit(i, j), this.hit(i + 1, j), this.hit(i + 1, j + 1), this.hit(i, j + 1)];
		const center = this.hit(i + 0.5, j + 0.5);
		const valid = corners.every(Boolean) && !!center;
		return { valid, corners: valid ? corners : null, center, d: valid ? this.derivs(corners) : null };
	}

	pixelOfWorld(p) {
		const v = new THREE.Vector3(p.x, p.y, p.z).project(this.camera);
		return [(v.x + 1) / 2, (1 - v.y) / 2];
	}

	// Fila (fracción de alto) de la zona cercana o lejana del piso, en la columna central.
	pickRow(kind) {
		const { rows, cols } = this;
		let top = -1;
		for (let j = 0; j < rows; j++)
			if (this.hit(cols / 2, j + 0.5)) {
				top = j;
				break;
			}
		if (top < 0) return 0.5;
		return kind === 'far' ? (Math.min(rows - 1, top + Math.max(2, rows * 0.03)) + 0.5) / rows : (rows - 2.5) / rows;
	}

	// Imagen completa del viewport. Devuelve { rgba, lod } con un lod por píxel (NaN = cielo).
	render(levels, params) {
		const { cols, rows } = this;
		const rgba = new Uint8ClampedArray(cols * rows * 4);
		const lod = new Float32Array(cols * rows).fill(NaN);
		const grid = new Array((cols + 1) * (rows + 1));
		for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) grid[j * (cols + 1) + i] = this.hit(i, j);
		for (let j = 0; j < rows; j++)
			for (let i = 0; i < cols; i++) {
				const o = (j * cols + i) * 4;
				const g = (di, dj) => grid[(j + dj) * (cols + 1) + i + di];
				const corners = [g(0, 0), g(1, 0), g(1, 1), g(0, 1)];
				const c = this.hit(i + 0.5, j + 0.5);
				if (!c || !corners.every(Boolean)) {
					rgba.set([12, 14, 18, 255], o);
					continue;
				}
				const d = this.derivs(corners);
				const r = shade(levels, params, c.u, c.v, d.dudx, d.dvdx, d.dudy, d.dvdy);
				rgba.set([...linToBytes(r.color), 255], o);
				lod[j * cols + i] = r.lod;
			}
		return { rgba, lod };
	}
}
