import * as THREE from 'three';
import { drawImageKind } from '../../shared/textures.js';

// Tres texturas de prueba pensadas para distinguir clamp, repeat y mirrored repeat.
const SIZE = 512;
const FONT = 'system-ui, "Segoe UI", sans-serif';

function make() {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = SIZE;
	return [canvas, canvas.getContext('2d')];
}

// A: cuadrícula 3×3 con letra + número. Orientación inequívoca y borde visible (no es seamless).
function numbered() {
	const [canvas, ctx] = make();
	const cell = SIZE / 3;
	const hues = [210, 150, 40, 280, 0, 190, 320, 90, 20];
	for (let j = 0; j < 3; j++)
		for (let i = 0; i < 3; i++) {
			const k = j * 3 + i;
			ctx.fillStyle = `hsl(${hues[k]} 55% ${k % 2 ? 34 : 42}%)`;
			ctx.fillRect(i * cell, j * cell, cell, cell);
			ctx.font = `800 ${cell * 0.42}px ${FONT}`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.lineWidth = 6;
			ctx.strokeStyle = 'rgba(0,0,0,.55)';
			const label = 'ABC'[j] + (i + 1);
			ctx.strokeText(label, (i + 0.5) * cell, (j + 0.5) * cell);
			ctx.fillStyle = '#fff';
			ctx.fillText(label, (i + 0.5) * cell, (j + 0.5) * cell);
		}
	ctx.strokeStyle = 'rgba(255,255,255,.45)';
	ctx.lineWidth = 2;
	for (let i = 1; i < 3; i++) {
		ctx.beginPath();
		ctx.moveTo(i * cell, 0);
		ctx.lineTo(i * cell, SIZE);
		ctx.moveTo(0, i * cell);
		ctx.lineTo(SIZE, i * cell);
		ctx.stroke();
	}
	ctx.strokeStyle = '#ffd84d';
	ctx.lineWidth = 14;
	ctx.strokeRect(7, 7, SIZE - 14, SIZE - 14);
	return canvas;
}

// B: motivo central con fondo y borde uniformes. Con clamp los texels del borde se prolongan.
function motif() {
	const [canvas, ctx] = make();
	ctx.fillStyle = '#f2efe6';
	ctx.fillRect(0, 0, SIZE, SIZE);
	const c = SIZE / 2;
	ctx.fillStyle = '#e4572e';
	ctx.beginPath();
	ctx.arc(c, c, SIZE * 0.3, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = '#1f4e8c';
	ctx.fillRect(c - SIZE * 0.13, c - SIZE * 0.13, SIZE * 0.26, SIZE * 0.26);
	ctx.fillStyle = '#f2efe6';
	ctx.beginPath();
	ctx.moveTo(c, c - SIZE * 0.09);
	ctx.lineTo(c + SIZE * 0.08, c + SIZE * 0.07);
	ctx.lineTo(c - SIZE * 0.08, c + SIZE * 0.07);
	ctx.closePath();
	ctx.fill();
	return canvas;
}

function arrow(ctx, x, y, len, thick, head, color) {
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.moveTo(x, y - thick / 2);
	ctx.lineTo(x + len - head, y - thick / 2);
	ctx.lineTo(x + len - head, y - head * 0.8);
	ctx.lineTo(x + len, y);
	ctx.lineTo(x + len - head, y + head * 0.8);
	ctx.lineTo(x + len - head, y + thick / 2);
	ctx.lineTo(x, y + thick / 2);
	ctx.closePath();
	ctx.fill();
}

// C: flechas fuertemente asimétricas para reconocer reflejos y rotaciones.
function arrows() {
	const [canvas, ctx] = make();
	const g = ctx.createLinearGradient(0, 0, SIZE, SIZE);
	g.addColorStop(0, '#1a2a48');
	g.addColorStop(1, '#2c4a6e');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, SIZE, SIZE);
	arrow(ctx, SIZE * 0.1, SIZE * 0.66, SIZE * 0.8, SIZE * 0.16, SIZE * 0.26, '#ffb347');
	ctx.save();
	ctx.translate(SIZE * 0.2, SIZE * 0.42);
	ctx.rotate(-Math.PI / 2);
	arrow(ctx, 0, 0, SIZE * 0.26, SIZE * 0.07, SIZE * 0.12, '#5be0d0');
	ctx.restore();
	ctx.fillStyle = '#ff5c69';
	ctx.beginPath();
	ctx.arc(SIZE * 0.82, SIZE * 0.2, SIZE * 0.07, 0, Math.PI * 2);
	ctx.fill();
	ctx.font = `800 ${SIZE * 0.13}px ${FONT}`;
	ctx.textAlign = 'left';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = '#fff';
	ctx.fillText('F', SIZE * 0.4, SIZE * 0.2);
	ctx.strokeStyle = '#fff';
	ctx.lineWidth = 8;
	ctx.strokeRect(4, 4, SIZE - 8, SIZE - 8);
	return canvas;
}

// D: paisaje (mismo mapa que en Dimensiones y tipos de textura). No es seamless: se ve bien el borde.
function paisaje() {
	const [canvas, ctx] = make();
	drawImageKind(ctx, SIZE);
	return canvas;
}

export const WRAP_TEXTURES = [
	{ value: 'numbered', label: 'Patrón numerado', make: numbered },
	{ value: 'motif', label: 'Motivo central', make: motif },
	{ value: 'arrows', label: 'Flechas direccionales', make: arrows },
	{ value: 'paisaje', label: 'Paisaje', make: paisaje },
];

// Sprite sheet real (imagen del proyecto) para animar offset/repeat en el tiempo.
export function loadSpriteSheet(url, onReady) {
	const texture = new THREE.TextureLoader().load(url, () => {
		texture.colorSpace = THREE.SRGBColorSpace;
		// Sin mipmaps: evita que el filtrado mezcle texels del cuadro vecino en los bordes de cada celda.
		texture.generateMipmaps = false;
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;
		texture.needsUpdate = true;
		onReady?.();
	});
	texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
	return texture;
}

// Copias reducidas (512/256/128/64) para que la vista UV no produzca aliasing al muestrear.
export function readLevel(canvas, size) {
	const c = document.createElement('canvas');
	c.width = c.height = size;
	const ctx = c.getContext('2d');
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(canvas, 0, 0, size, size);
	return ctx.getImageData(0, 0, size, size).data;
}
