import * as THREE from 'three';

// Orden de caras de un cubemap (convención OpenGL / three.js)
export const FACES = ['+X', '-X', '+Y', '-Y', '+Z', '-Z'];

export const ENV_KINDS = [
	{ value: 'faces', label: 'Caras numeradas' },
	{ value: 'sunset', label: 'Atardecer' },
];

const FACE_COLORS = ['#e5484d', '#8a3a3f', '#46a758', '#245a30', '#3e63dd', '#243a80'];

function paintFaces(kind, i, ctx, N) {
	if (kind === 'faces') {
		const g = ctx.createRadialGradient(N / 2, N / 2, N * 0.05, N / 2, N / 2, N * 0.75);
		g.addColorStop(0, '#ffffff55');
		g.addColorStop(1, '#00000066');
		ctx.fillStyle = FACE_COLORS[i];
		ctx.fillRect(0, 0, N, N);
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, N, N);
		ctx.strokeStyle = 'rgba(255,255,255,0.35)';
		ctx.lineWidth = 2;
		for (let k = 1; k < 4; k++) {
			ctx.beginPath();
			ctx.moveTo((k * N) / 4, 0);
			ctx.lineTo((k * N) / 4, N);
			ctx.moveTo(0, (k * N) / 4);
			ctx.lineTo(N, (k * N) / 4);
			ctx.stroke();
		}
		ctx.strokeStyle = '#fff';
		ctx.lineWidth = 6;
		ctx.strokeRect(3, 3, N - 6, N - 6);
		ctx.fillStyle = '#fff';
		ctx.font = `bold ${N / 3}px sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(FACES[i], N / 2, N / 2);
		ctx.font = `bold ${N / 12}px sans-serif`;
		ctx.fillText('▲ arriba', N / 2, N / 12);
		return;
	}
	// atardecer: laterales con horizonte a mitad de altura
	if (i === 2) {
		const g = ctx.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N * 0.75);
		g.addColorStop(0, '#1e4fa8');
		g.addColorStop(1, '#5a8fe0');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, N, N);
		return;
	}
	if (i === 3) {
		ctx.fillStyle = '#3a2b22';
		ctx.fillRect(0, 0, N, N);
		ctx.strokeStyle = '#5c4636';
		ctx.lineWidth = 2;
		for (let k = 0; k <= 8; k++) {
			ctx.beginPath();
			ctx.moveTo((k * N) / 8, 0);
			ctx.lineTo((k * N) / 8, N);
			ctx.moveTo(0, (k * N) / 8);
			ctx.lineTo(N, (k * N) / 8);
			ctx.stroke();
		}
		return;
	}
	const sky = ctx.createLinearGradient(0, 0, 0, N / 2);
	sky.addColorStop(0, '#2a5bb8');
	sky.addColorStop(0.7, '#f19a5a');
	sky.addColorStop(1, '#ffd08a');
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, N, N / 2);
	ctx.fillStyle = '#3a2b22';
	ctx.fillRect(0, N / 2, N, N / 2);
	if (i === 0) {
		ctx.fillStyle = '#fff6c9';
		ctx.beginPath();
		ctx.arc(N * 0.5, N * 0.42, N * 0.09, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.fillStyle = '#1b1a26';
	const seed = [3, 7, 2, 5][i > 3 ? i - 2 : i] || 4;
	for (let k = 0; k < 6; k++) {
		const w = N / 9;
		const h = N * (0.05 + ((k * seed) % 5) * 0.03);
		ctx.fillRect(k * (N / 6) + 4, N / 2 - h, w, h);
	}
	ctx.fillStyle = '#ffffff22';
	ctx.fillRect(0, N / 2 - 1, N, 2);
}

export function createEnvFaces(kind, N = 256) {
	return FACES.map((_, i) => {
		const c = document.createElement('canvas');
		c.width = c.height = N;
		const ctx = c.getContext('2d', { willReadFrequently: true });
		paintFaces(kind, i, ctx, N);
		c.pixels = ctx.getImageData(0, 0, N, N).data;
		return c;
	});
}

export function createCubeTexture(faces) {
	const t = new THREE.CubeTexture(faces);
	t.colorSpace = THREE.SRGBColorSpace;
	t.needsUpdate = true;
	return t;
}

// Selección de cara y coordenadas (s,t) para una dirección (convención de three.js: el eje x del
// cubemap está invertido respecto del mundo).
export function cubeLookup(dir) {
	const x = -dir.x,
		y = dir.y,
		z = dir.z;
	const ax = Math.abs(x),
		ay = Math.abs(y),
		az = Math.abs(z);
	let face, sc, tc, ma;
	if (ax >= ay && ax >= az) {
		ma = ax;
		if (x > 0) [face, sc, tc] = [0, -z, -y];
		else [face, sc, tc] = [1, z, -y];
	} else if (ay >= az) {
		ma = ay;
		if (y > 0) [face, sc, tc] = [2, x, z];
		else [face, sc, tc] = [3, x, -z];
	} else {
		ma = az;
		if (z > 0) [face, sc, tc] = [4, x, -y];
		else [face, sc, tc] = [5, -x, -y];
	}
	return { face, s: (sc / ma + 1) / 2, t: (tc / ma + 1) / 2 };
}

export function faceColor(faces, face, s, t) {
	const c = faces[face];
	const N = c.width;
	const x = Math.min(N - 1, Math.floor(s * N));
	const y = Math.min(N - 1, Math.floor(t * N));
	const k = (y * N + x) * 4;
	return [c.pixels[k], c.pixels[k + 1], c.pixels[k + 2]];
}

export const ENV_VS = `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
export const ENV_FS = `
uniform samplerCube uEnv; uniform float uAlpha; varying vec3 vDir;
void main(){
	vec4 c = texture(uEnv, vec3(-vDir.x, vDir.y, vDir.z));
	gl_FragColor = vec4(c.rgb, uAlpha);
	#include <colorspace_fragment>
}`;
