import * as THREE from 'three';

export const TEXTURE_KINDS = [
	{ value: 'grid', label: 'Cuadrícula UV numerada' },
	{ value: 'checker', label: 'Checkerboard' },
	{ value: 'image', label: 'Imagen (paisaje)' },
];

export const WRAP_MODES = [
	{ value: 'clamp', label: 'Clamp' },
	{ value: 'repeat', label: 'Repeat' },
	{ value: 'mirror', label: 'Mirrored Repeat' },
];

export function wrapCoord(x, mode) {
	if (mode === 'repeat') return x - Math.floor(x);
	if (mode === 'mirror') {
		const t = ((x % 2) + 2) % 2;
		return t > 1 ? 2 - t : t;
	}
	return Math.min(1, Math.max(0, x));
}

export function wrapIndex(i, n, mode) {
	if (mode === 'repeat') return ((i % n) + n) % n;
	if (mode === 'mirror') {
		const m = ((i % (2 * n)) + 2 * n) % (2 * n);
		return m < n ? m : 2 * n - 1 - m;
	}
	return Math.min(n - 1, Math.max(0, i));
}

export const threeWrap = (mode) =>
	mode === 'repeat' ? THREE.RepeatWrapping : mode === 'mirror' ? THREE.MirroredRepeatWrapping : THREE.ClampToEdgeWrapping;

function drawGrid(ctx, N) {
	const img = ctx.createImageData(N, N);
	for (let y = 0; y < N; y++)
		for (let x = 0; x < N; x++) {
			const u = (x + 0.5) / N;
			const v = 1 - (y + 0.5) / N;
			const k = (y * N + x) * 4;
			img.data[k] = 70 + 150 * u;
			img.data[k + 1] = 70 + 150 * v;
			img.data[k + 2] = 120;
			img.data[k + 3] = 255;
		}
	ctx.putImageData(img, 0, 0);
	ctx.strokeStyle = 'rgba(255,255,255,0.85)';
	ctx.lineWidth = Math.max(1, N / 90);
	for (let i = 0; i <= 4; i++) {
		const p = Math.min(N - ctx.lineWidth / 2, Math.max(ctx.lineWidth / 2, (i * N) / 4));
		ctx.beginPath();
		ctx.moveTo(p, 0);
		ctx.lineTo(p, N);
		ctx.moveTo(0, p);
		ctx.lineTo(N, p);
		ctx.stroke();
	}
	if (N >= 64) {
		ctx.strokeStyle = 'rgba(255,255,255,0.3)';
		ctx.lineWidth = Math.max(1, N / 256);
		for (let i = 1; i < 8; i += 2) {
			const p = (i * N) / 8;
			ctx.beginPath();
			ctx.moveTo(p, 0);
			ctx.lineTo(p, N);
			ctx.moveTo(0, p);
			ctx.lineTo(N, p);
			ctx.stroke();
		}
		ctx.font = `bold ${Math.round(N / 11)}px sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		for (let i = 0; i < 4; i++)
			for (let j = 0; j < 4; j++) {
				const cx = ((i + 0.5) * N) / 4;
				const cy = N - ((j + 0.5) * N) / 4;
				ctx.lineWidth = Math.max(2, N / 60);
				ctx.strokeStyle = 'rgba(0,0,0,0.7)';
				ctx.strokeText(`${i},${j}`, cx, cy);
				ctx.fillStyle = '#fff';
				ctx.fillText(`${i},${j}`, cx, cy);
			}
	}
}

function drawChecker(ctx, N) {
	const c = N / 8;
	for (let i = 0; i < 8; i++)
		for (let j = 0; j < 8; j++) {
			ctx.fillStyle = (i + j) % 2 ? '#3a3d46' : '#e8e8ea';
			if (i === 0 && j === 0) ctx.fillStyle = '#f5a25d';
			if (i === 7 && j === 7) ctx.fillStyle = '#4cc9c0';
			ctx.fillRect(i * c, N - (j + 1) * c, Math.ceil(c), Math.ceil(c));
		}
}

export function drawImageKind(ctx, N) {
	ctx.save();
	ctx.scale(N / 256, N / 256);
	const sky = ctx.createLinearGradient(0, 0, 0, 170);
	sky.addColorStop(0, '#2d6cdf');
	sky.addColorStop(1, '#a9d4ff');
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, 256, 256);
	ctx.fillStyle = '#ffd84d';
	ctx.beginPath();
	ctx.arc(196, 62, 22, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = '#7d8aa3';
	ctx.beginPath();
	ctx.moveTo(0, 170);
	ctx.lineTo(70, 90);
	ctx.lineTo(140, 170);
	ctx.fill();
	ctx.fillStyle = '#5f6d88';
	ctx.beginPath();
	ctx.moveTo(90, 170);
	ctx.lineTo(160, 105);
	ctx.lineTo(240, 170);
	ctx.fill();
	ctx.fillStyle = '#3f9b4a';
	ctx.fillRect(0, 170, 256, 86);
	ctx.fillStyle = '#e04f4f';
	ctx.fillRect(40, 175, 64, 44);
	ctx.fillStyle = '#7a2e2e';
	ctx.beginPath();
	ctx.moveTo(32, 177);
	ctx.lineTo(72, 145);
	ctx.lineTo(112, 177);
	ctx.fill();
	ctx.fillStyle = '#ffe9a8';
	ctx.fillRect(62, 192, 20, 27);
	ctx.fillStyle = '#fff';
	ctx.font = 'bold 30px sans-serif';
	ctx.textAlign = 'center';
	ctx.fillText('ARRIBA', 92, 36);
	ctx.fillRect(196 - 3, 110, 6, 40);
	ctx.beginPath();
	ctx.moveTo(196, 96);
	ctx.lineTo(182, 116);
	ctx.lineTo(210, 116);
	ctx.fill();
	ctx.restore();
}

const cache = new Map();

export class TextureData {
	constructor(kind, size) {
		this.kind = kind;
		this.size = size;
		this.canvas = document.createElement('canvas');
		this.canvas.width = this.canvas.height = size;
		const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
		if (kind === 'grid') drawGrid(ctx, size);
		else if (kind === 'checker') drawChecker(ctx, size);
		else drawImageKind(ctx, size);
		this.data = ctx.getImageData(0, 0, size, size).data;
	}

	// i: columna desde la izquierda; j: fila desde abajo (v = 0)
	texel(i, j) {
		const n = this.size;
		const k = ((n - 1 - j) * n + i) * 4;
		return [this.data[k], this.data[k + 1], this.data[k + 2]];
	}

	// Devuelve el color y los texels que consulta el sampler (GL: nearest / linear).
	sample(u, v, wrap, filter) {
		const n = this.size;
		if (filter === 'nearest') {
			const i = Math.min(n - 1, Math.floor(wrapCoord(u, wrap) * n));
			const j = Math.min(n - 1, Math.floor(wrapCoord(v, wrap) * n));
			return { rgb: this.texel(i, j), texels: [{ i, j, w: 1 }] };
		}
		const uf = u * n - 0.5;
		const vf = v * n - 0.5;
		const i0 = Math.floor(uf);
		const j0 = Math.floor(vf);
		const fx = uf - i0;
		const fy = vf - j0;
		const texels = [];
		const rgb = [0, 0, 0];
		for (let dj = 0; dj < 2; dj++)
			for (let di = 0; di < 2; di++) {
				const w = (di ? fx : 1 - fx) * (dj ? fy : 1 - fy);
				const i = wrapIndex(i0 + di, n, wrap);
				const j = wrapIndex(j0 + dj, n, wrap);
				const t = this.texel(i, j);
				for (let c = 0; c < 3; c++) rgb[c] += t[c] * w;
				texels.push({ i, j, w });
			}
		return { rgb: rgb.map(Math.round), texels };
	}

	toThree(wrap = 'clamp', filter = 'linear') {
		const t = new THREE.CanvasTexture(this.canvas);
		t.colorSpace = THREE.SRGBColorSpace;
		t.anisotropy = 4;
		applyTextureParams(t, wrap, filter);
		return t;
	}
}

export function applyTextureParams(t, wrap, filter) {
	t.wrapS = t.wrapT = threeWrap(wrap);
	if (filter === 'nearest') {
		t.magFilter = THREE.NearestFilter;
		t.minFilter = THREE.NearestFilter;
		t.generateMipmaps = false;
	} else {
		t.magFilter = THREE.LinearFilter;
		t.minFilter = THREE.LinearMipmapLinearFilter;
		t.generateMipmaps = true;
	}
	t.needsUpdate = true;
}

export function getTextureData(kind, size = 256) {
	const key = kind + size;
	if (!cache.has(key)) cache.set(key, new TextureData(kind, size));
	return cache.get(key);
}

export const rgbCss = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
