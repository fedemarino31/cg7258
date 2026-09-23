import * as THREE from 'three';

const makeCanvas = (size = 768) => {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = size;
	return canvas;
};

export function createUvDiagnosticTexture(size = 768) {
	const canvas = makeCanvas(size);
	const ctx = canvas.getContext('2d');
	const cell = size / 8;
	ctx.fillStyle = '#18243b';
	ctx.fillRect(0, 0, size, size);
	for (let y = 0; y < 8; y++)
		for (let x = 0; x < 8; x++) {
			ctx.fillStyle = (x + y) % 2 ? '#283b61' : '#35517f';
			ctx.fillRect(x * cell, y * cell, cell, cell);
		}
	ctx.lineWidth = Math.max(2, size / 256);
	ctx.strokeStyle = 'rgba(255,255,255,.54)';
	for (let i = 0; i <= 8; i++) {
		ctx.beginPath();
		ctx.moveTo(i * cell, 0);
		ctx.lineTo(i * cell, size);
		ctx.moveTo(0, i * cell);
		ctx.lineTo(size, i * cell);
		ctx.stroke();
	}
	ctx.font = `700 ${Math.round(size / 31)}px system-ui`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	for (let y = 0; y < 8; y++)
		for (let x = 0; x < 8; x++) {
			ctx.lineWidth = size / 180;
			ctx.strokeStyle = 'rgba(0,0,0,.75)';
			ctx.strokeText(`${x},${7 - y}`, (x + 0.5) * cell, (y + 0.5) * cell);
			ctx.fillStyle = '#fff';
			ctx.fillText(`${x},${7 - y}`, (x + 0.5) * cell, (y + 0.5) * cell);
		}
	ctx.fillStyle = '#ff5c69';
	ctx.fillRect(0, size - size * 0.035, size, size * 0.035);
	ctx.fillStyle = '#48df91';
	ctx.fillRect(0, 0, size * 0.035, size);
	ctx.fillStyle = '#fff';
	ctx.font = `800 ${Math.round(size / 16)}px system-ui`;
	ctx.textAlign = 'right';
	ctx.fillText('U →', size - size * 0.035, size - size * 0.07);
	ctx.save();
	ctx.translate(size * 0.075, size * 0.14);
	ctx.rotate(-Math.PI / 2);
	ctx.fillText('V →', 0, 0);
	ctx.restore();
	return canvas;
}

export function createCheckerTexture(size = 768) {
	const canvas = makeCanvas(size);
	const ctx = canvas.getContext('2d');
	const cell = size / 12;
	for (let y = 0; y < 12; y++)
		for (let x = 0; x < 12; x++) {
			ctx.fillStyle = (x + y) % 2 ? '#162035' : '#e7edf8';
			ctx.fillRect(x * cell, y * cell, cell, cell);
		}
	ctx.fillStyle = '#ffcf4a';
	ctx.beginPath();
	ctx.moveTo(size * 0.08, size * 0.9);
	ctx.lineTo(size * 0.28, size * 0.9);
	ctx.lineTo(size * 0.28, size * 0.84);
	ctx.lineTo(size * 0.41, size * 0.94);
	ctx.lineTo(size * 0.28, size);
	ctx.lineTo(size * 0.28, size * 0.95);
	ctx.lineTo(size * 0.08, size * 0.95);
	ctx.fill();
	return canvas;
}

// Textura para el barrido tubular: u recorre la sección (da la vuelta al tubo una vez),
// v recorre el recorrido a lo largo del tubo (se repite ×3 al aplicarla, ver UVStrategiesLab).
export function createTubeTexture(size = 768) {
	const canvas = makeCanvas(size);
	const ctx = canvas.getContext('2d');
	const bands = ['#173456', '#24628a', '#2b8f9d', '#38b99a', '#86d06c', '#d8c951'];
	// Las bandas de color varían con u (horizontal): dan la vuelta al tubo.
	for (let x = 0; x < bands.length; x++) {
		ctx.fillStyle = bands[x];
		ctx.fillRect((x * size) / bands.length, 0, size / bands.length + 1, size);
	}
	// Líneas finas a lo largo de v (vertical): marcan la repetición del wrapping en el recorrido.
	ctx.globalAlpha = 0.5;
	ctx.strokeStyle = '#ffffff';
	ctx.lineWidth = Math.max(1, size / 340);
	for (let y = 1; y < 4; y++) {
		ctx.beginPath();
		ctx.moveTo(0, (y * size) / 4);
		ctx.lineTo(size, (y * size) / 4);
		ctx.stroke();
	}
	ctx.globalAlpha = 1;

	// "SECCIÓN" se repite dando la vuelta al tubo: un rótulo horizontal por banda (eje u).
	ctx.fillStyle = 'rgba(255,255,255,.94)';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = `800 ${Math.round(size / 30)}px system-ui`;
	for (let x = 0; x < bands.length; x++) {
		ctx.save();
		ctx.translate((x + 0.5) * (size / bands.length), size * 0.13);
		ctx.fillText('SECCIÓN', 0, 0);
		ctx.restore();
	}

	// "RECORRIDO" va en el sentido del recorrido: rótulo vertical (eje v), se repite con el wrapping.
	ctx.save();
	ctx.translate(size * 0.5, size * 0.58);
	ctx.rotate(-Math.PI / 2);
	ctx.font = `800 ${Math.round(size / 13)}px system-ui`;
	ctx.fillText('RECORRIDO ↑', 0, 0);
	ctx.restore();
	return canvas;
}

// Textura de la superficie completa de una botella de vidrio tipo gaseosa "cola": la etiqueta ocupa
// solo una franja central (~25% de la altura); el resto simula vidrio con nervaduras verticales:
// abajo, oscuro (hay líquido); arriba, grisado (vacío, sugiere transparencia sin serlo).
// v=0 es la base y v=1 la boca (ver generatedBottle en geometry.js); por el flipY de la textura,
// el canvas se dibuja "de arriba hacia abajo" tal como se ve la botella parada.
export function createColaLabelTexture(size = 768) {
	const canvas = makeCanvas(size);
	const ctx = canvas.getContext('2d');
	const labelTop = size * 0.375;
	const labelBottom = size * 0.625;
	const labelH = labelBottom - labelTop;

	// Parte superior: hombro y cuello, sin líquido. Vidrio grisado (no es transparente de verdad).
	const topGrad = ctx.createLinearGradient(0, 0, 0, labelTop);
	topGrad.addColorStop(0, '#d7dde0');
	topGrad.addColorStop(1, '#8b9298');
	ctx.fillStyle = topGrad;
	ctx.fillRect(0, 0, size, labelTop);

	// Parte inferior: cuerpo con líquido. Vidrio oscuro, con nervaduras verticales (relieve simulado).
	const bottomGrad = ctx.createLinearGradient(0, labelBottom, 0, size);
	bottomGrad.addColorStop(0, '#1c1210');
	bottomGrad.addColorStop(1, '#0a0705');
	ctx.fillStyle = bottomGrad;
	ctx.fillRect(0, labelBottom, size, size - labelBottom);

	// Nervaduras: bandas verticales angostas con sombra de un lado y brillo del otro, sugieren
	// el relieve acanalado típico del vidrio de una botella de cola clásica.
	const ribs = 22;
	for (let i = 0; i < ribs; i++) {
		const cx = ((i + 0.5) / ribs) * size;
		const w = size / ribs;
		const shade = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
		shade.addColorStop(0, 'rgba(0,0,0,.22)');
		shade.addColorStop(0.45, 'rgba(255,255,255,.12)');
		shade.addColorStop(0.55, 'rgba(255,255,255,.12)');
		shade.addColorStop(1, 'rgba(0,0,0,.22)');
		ctx.fillStyle = shade;
		ctx.fillRect(cx - w / 2, labelBottom, w, size - labelBottom);
	}

	// Etiqueta central roja, franja de ~25% de la altura.
	ctx.fillStyle = '#c8102e';
	ctx.fillRect(0, labelTop, size, labelH);
	ctx.fillStyle = 'rgba(0,0,0,.2)';
	ctx.fillRect(0, labelTop, size, size * 0.008);
	ctx.fillRect(0, labelBottom - size * 0.008, size, size * 0.008);

	// Marca genérica en la mitad superior de la etiqueta (no reproduce un logo real).
	ctx.fillStyle = '#fff';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = `italic 800 ${Math.round(labelH * 0.4)}px Georgia, 'Times New Roman', serif`;
	ctx.fillText('3D Cola', size / 2, labelTop + labelH * 0.34);

	// Cinta blanca ondulada en la mitad inferior de la etiqueta.
	ctx.save();
	ctx.strokeStyle = 'rgba(255,255,255,.94)';
	ctx.lineWidth = labelH * 0.22;
	ctx.lineCap = 'round';
	const waveY = labelTop + labelH * 0.72;
	ctx.beginPath();
	for (let i = 0; i <= size; i += 4) {
		const y = waveY + Math.sin((i / size) * Math.PI * 2) * labelH * 0.1;
		if (i === 0) ctx.moveTo(i, y);
		else ctx.lineTo(i, y);
	}
	ctx.stroke();
	ctx.restore();

	// Burbujas decorativas sobre la etiqueta.
	ctx.fillStyle = 'rgba(255,255,255,.3)';
	for (let i = 0; i < 18; i++) {
		const x = (i * 97) % size;
		const y = labelTop + ((i * 53) % labelH);
		const r = 2 + ((i * 13) % 5);
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.fill();
	}

	return canvas;
}

export function canvasTexture(canvas) {
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.anisotropy = 8;
	texture.needsUpdate = true;
	return texture;
}

export function loadColorTexture(url, onLoad, onError) {
	return new THREE.TextureLoader().load(
		url,
		(texture) => {
			texture.colorSpace = THREE.SRGBColorSpace;
			texture.anisotropy = 8;
			texture.needsUpdate = true;
			onLoad?.(texture);
		},
		undefined,
		onError
	);
}

export const ASSET_URLS = {
	terrain: new URL('../../../maps/terrain-planar-topdown.jpg', import.meta.url).href,
	cylindricalStone: new URL('../../../maps/piedra-cilindrica-seamless.jpg', import.meta.url).href,
	boxRock: new URL('../../../maps/roca-box-seamless.jpg', import.meta.url).href,
	earth: new URL('../../../maps/earth.jpg', import.meta.url).href,
	// El atlas viaja embebido dentro del GLB (imagen JPEG por bufferView): no hace falta un PNG aparte.
	unwrapModel: new URL('../../../models/unwrap-example.glb', import.meta.url).href,
};
