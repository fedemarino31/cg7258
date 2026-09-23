import * as THREE from 'three';

export const VOLUME_KINDS = [
	{ value: 'bands', label: 'Bandas (ejes RGB)' },
	{ value: 'rock', label: 'Roca · estratos (ruido Perlin)' },
	{ value: 'noise', label: 'Ruido' },
	{ value: 'cells', label: 'Celdas' },
	{ value: 'synthetic', label: 'Volumen sintético' },
];

function hash(x, y, z, s = 0) {
	let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647) + Math.imul(s, 1442695041);
	n = Math.imul(n ^ (n >>> 13), 1274126177);
	n ^= n >>> 16;
	return (n >>> 0) / 4294967295;
}

const sm = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

function vnoise(x, y, z) {
	const ix = Math.floor(x),
		iy = Math.floor(y),
		iz = Math.floor(z);
	const fx = sm(x - ix),
		fy = sm(y - iy),
		fz = sm(z - iz);
	let r = 0;
	for (let dz = 0; dz < 2; dz++)
		for (let dy = 0; dy < 2; dy++)
			for (let dx = 0; dx < 2; dx++)
				r += hash(ix + dx, iy + dy, iz + dz) * (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz);
	return r;
}

function fbm(x, y, z) {
	let a = 0.5,
		f = 1,
		r = 0;
	for (let o = 0; o < 4; o++) {
		r += a * vnoise(x * f, y * f, z * f);
		a *= 0.5;
		f *= 2;
	}
	return r / 0.9375;
}

// Gradiente tipo "heatmap": de cálido (rojo/naranja) a frío (azul/violeta), con paradas
// bien separadas en matiz para que las capas de la roca se distingan claramente entre sí.
const HEATMAP_STOPS = [
	[0.0, [120, 12, 24]],
	[0.15, [214, 39, 40]],
	[0.3, [241, 143, 24]],
	[0.45, [247, 217, 40]],
	[0.58, [90, 191, 92]],
	[0.72, [40, 170, 190]],
	[0.86, [45, 100, 210]],
	[1.0, [70, 35, 140]],
];

function heatmapColor(t) {
	t = Math.min(1, Math.max(0, t));
	for (let i = 0; i < HEATMAP_STOPS.length - 1; i++) {
		const [t0, c0] = HEATMAP_STOPS[i];
		const [t1, c1] = HEATMAP_STOPS[i + 1];
		if (t <= t1 || i === HEATMAP_STOPS.length - 2) {
			const f = (t - t0) / (t1 - t0);
			return [lerp(c0[0], c1[0], f), lerp(c0[1], c1[1], f), lerp(c0[2], c1[2], f)];
		}
	}
	return HEATMAP_STOPS[HEATMAP_STOPS.length - 1][1];
}

// Interior de una roca irregular: estratos curvos y plegados (deformados con ruido, no bandas
// rectas), cada uno con un color bien diferenciable tomado de un gradiente cálido→frío, más
// grano fino para que la superficie de cada capa no quede plana.
function rockColor(u, v, w) {
	const wx = u + 0.42 * (fbm(u * 1.7 + 4.2, v * 1.7 + 1.1, w * 1.7 + 7.3) - 0.5);
	const wy = v + 0.42 * (fbm(u * 1.7 - 3.4, v * 1.7 + 5.8, w * 1.7 - 2.2) - 0.5);
	const wz = w + 0.42 * (fbm(u * 1.7 + 8.1, v * 1.7 - 6.6, w * 1.7 + 0.4) - 0.5);

	// "Profundidad" diagonal a través de la roca, con un segundo pliegue de baja frecuencia
	// para que los estratos se curven y no queden alineados a los ejes.
	let depth = wx * 0.4 + wy * 0.85 + wz * 0.35;
	depth += 0.4 * (fbm(u * 2.6 + 11, v * 2.6 + 3, w * 2.6 + 9) - 0.5);
	depth -= Math.floor(depth); // envuelve a [0,1): varias capas a lo largo del volumen

	const LAYERS = 7;
	const grain = fbm(u * 11 + 1, v * 11 + 5, w * 11 + 2);
	const layer = Math.floor(depth * LAYERS);
	const t = Math.min(1, Math.max(0, layer / (LAYERS - 1) + (grain - 0.5) * 0.1));

	const c = heatmapColor(t);
	const speckle = fbm(u * 22 + 5, v * 22 + 9, w * 22 + 1);
	const shade = 0.78 + 0.34 * speckle;
	return [c[0] * shade, c[1] * shade, c[2] * shade];
}

function hsl(h, s, l) {
	const k = (n) => (n + h * 12) % 12;
	const a = s * Math.min(l, 1 - l);
	const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
	return [f(0) * 255, f(8) * 255, f(4) * 255];
}

// Color (0..255) de la textura volumétrica en la coordenada (u,v,w) ∈ [0,1]³.
export function volumeColor(kind, u, v, w) {
	if (kind === 'bands') {
		const b = (t) => (Math.floor(t * 6) % 2 ? 235 : 45);
		return [b(u), b(v), b(w)];
	}
	if (kind === 'rock') return rockColor(u, v, w);
	if (kind === 'noise') {
		const n = fbm(u * 5, v * 5, w * 5);
		const t = Math.min(1, Math.max(0, (n - 0.25) * 1.9));
		return [lerp(25, 250, t), lerp(50, 225, t * t), lerp(110, 190, t)];
	}
	if (kind === 'cells') {
		const px = u * 4,
			py = v * 4,
			pz = w * 4;
		const cx = Math.floor(px),
			cy = Math.floor(py),
			cz = Math.floor(pz);
		let f1 = 9,
			f2 = 9,
			id = 0;
		for (let dz = -1; dz <= 1; dz++)
			for (let dy = -1; dy <= 1; dy++)
				for (let dx = -1; dx <= 1; dx++) {
					const x = cx + dx,
						y = cy + dy,
						z = cz + dz;
					const fx = x + hash(x, y, z, 1) - px;
					const fy = y + hash(x, y, z, 2) - py;
					const fz = z + hash(x, y, z, 3) - pz;
					const d = Math.hypot(fx, fy, fz);
					if (d < f1) {
						f2 = f1;
						f1 = d;
						id = hash(x, y, z, 4);
					} else if (d < f2) f2 = d;
				}
		const edge = Math.min(1, (f2 - f1) * 5);
		const c = hsl(id, 0.65, 0.55);
		const k = 0.25 + 0.75 * edge;
		return [c[0] * k, c[1] * k, c[2] * k];
	}
	const d = Math.hypot(u - 0.5, v - 0.5, w - 0.5);
	const marble = 0.5 + 0.5 * Math.sin(12 * (u + 0.5 * fbm(u * 4, v * 4, w * 4)) * Math.PI);
	const shell = Math.floor(d * 12) % 2 ? 1 : 0.7;
	const c = hsl((d * 1.4) % 1, 0.7, 0.35 + 0.3 * marble);
	return [c[0] * shell, c[1] * shell, c[2] * shell];
}

export function createVolumeTexture(kind, N = 40) {
	const data = new Uint8ClampedArray(N * N * N * 4);
	let k = 0;
	for (let z = 0; z < N; z++)
		for (let y = 0; y < N; y++)
			for (let x = 0; x < N; x++) {
				const c = volumeColor(kind, (x + 0.5) / N, (y + 0.5) / N, (z + 0.5) / N);
				data[k++] = c[0];
				data[k++] = c[1];
				data[k++] = c[2];
				data[k++] = 255;
			}
	const t = new THREE.Data3DTexture(data, N, N, N);
	t.format = THREE.RGBAFormat;
	t.type = THREE.UnsignedByteType;
	t.minFilter = t.magFilter = THREE.LinearFilter;
	t.wrapS = t.wrapT = t.wrapR = THREE.ClampToEdgeWrapping;
	t.unpackAlignment = 1;
	t.needsUpdate = true;
	return t;
}

export function drawSliceToCanvas(canvas, kind, w) {
	const n = canvas.width;
	const ctx = canvas.getContext('2d');
	const img = ctx.createImageData(n, n);
	for (let y = 0; y < n; y++)
		for (let x = 0; x < n; x++) {
			const c = volumeColor(kind, (x + 0.5) / n, 1 - (y + 0.5) / n, w);
			const k = (y * n + x) * 4;
			img.data[k] = c[0];
			img.data[k + 1] = c[1];
			img.data[k + 2] = c[2];
			img.data[k + 3] = 255;
		}
	ctx.putImageData(img, 0, 0);
}

export const VOLUME_VS = `
varying vec3 vUvw; varying vec3 vN;
void main() {
	vec4 wp = modelMatrix * vec4(position, 1.0);
	vUvw = wp.xyz * 0.5 + 0.5;
	vN = normalize(mat3(modelMatrix) * normal);
	gl_Position = projectionMatrix * viewMatrix * wp;
}`;

export const VOLUME_FS = `
precision highp sampler3D;
uniform sampler3D uVol; uniform float uAlpha; uniform float uShade; uniform float uHatch;
varying vec3 vUvw; varying vec3 vN;
void main() {
	vec3 c = texture(uVol, clamp(vUvw, 0.0, 1.0)).rgb;
	float l = 0.55 + 0.45 * max(dot(normalize(vN), normalize(vec3(0.4, 0.8, 0.6))), 0.0);
	c *= mix(1.0, l, uShade);
	bool outside = any(lessThan(vUvw, vec3(0.0))) || any(greaterThan(vUvw, vec3(1.0)));
	if (outside && uHatch > 0.5) {
		float s = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) / 10.0));
		c = mix(c * 0.25, vec3(0.9, 0.2, 0.5), s * 0.6);
	}
	gl_FragColor = vec4(c, uAlpha);
}`;
