import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

let scene, camera, renderer, labelRenderer, container;
let geo1, geo2;

const frustumSize = 1.5;

const textures = {
	uv1: { url: 'uv.jpg', object: null },
};

// Colores por triángulo para el espacio UV
const COLOR_T1 = '#ff88ff';
const COLOR_T2 = '#88ffdd';

// UVs iniciales por vértice: [id_u, id_v, u, v]
const DEFAULT_UVS = [
	['t1v0u', 't1v0v', 0, 0],
	['t1v1u', 't1v1v', 1, 0],
	['t1v2u', 't1v2v', 0, 1],
	['t2v3u', 't2v3v', 0, 1],
	['t2v4u', 't2v4v', 1, 0],
	['t2v5u', 't2v5v', 1, 1],
];

function setupThreeJs() {
	container = document.getElementById('container3D');

	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setClearColor(0x000000);
	container.appendChild(renderer.domElement);

	const aspect = container.clientWidth / container.clientHeight;
	camera = new THREE.OrthographicCamera(
		-frustumSize * aspect,
		frustumSize * aspect,
		frustumSize,
		-frustumSize,
		0.1,
		100
	);
	camera.position.set(0, 0, 5);
	camera.lookAt(0, 0, 0);

	labelRenderer = new CSS2DRenderer();
	labelRenderer.domElement.style.position = 'absolute';
	labelRenderer.domElement.style.top = '0';
	labelRenderer.domElement.style.left = '0';
	labelRenderer.domElement.style.pointerEvents = 'none';
	container.appendChild(labelRenderer.domElement);

	window.addEventListener('resize', onResize);
	onResize();
}

function onResize() {
	const w = container.offsetWidth;
	const h = container.offsetHeight;
	const aspect = w / h;

	camera.left = -frustumSize * aspect;
	camera.right = frustumSize * aspect;
	camera.top = frustumSize;
	camera.bottom = -frustumSize;
	camera.updateProjectionMatrix();

	renderer.setSize(w, h);
	labelRenderer.setSize(w, h);

	drawUVSpace();
}

function buildScene() {
	scene = new THREE.Scene();

	const mat = new THREE.MeshBasicMaterial({
		map: textures.uv1.object,
		side: THREE.DoubleSide,
	});

	// Triángulo 1: ángulo recto en v0 (abajo-izquierda)
	const positions1 = new Float32Array([
		-1.1, -1.0, 0, // v0
		-0.1, -1.0, 0, // v1
		-1.1,  1.0, 0, // v2
	]);
	const uvs1 = new Float32Array([
		0, 0, // v0
		1, 0, // v1
		0, 1, // v2
	]);
	geo1 = new THREE.BufferGeometry();
	geo1.setAttribute('position', new THREE.BufferAttribute(positions1, 3));
	geo1.setAttribute('uv', new THREE.BufferAttribute(uvs1, 2));
	scene.add(new THREE.Mesh(geo1, mat));

	// Triángulo 2: ángulo recto en v5 (arriba-derecha)
	const positions2 = new Float32Array([
		0.1,  1.0, 0, // v3
		1.1, -1.0, 0, // v4
		1.1,  1.0, 0, // v5
	]);
	const uvs2 = new Float32Array([
		0, 1, // v3
		1, 0, // v4
		1, 1, // v5
	]);
	geo2 = new THREE.BufferGeometry();
	geo2.setAttribute('position', new THREE.BufferAttribute(positions2, 3));
	geo2.setAttribute('uv', new THREE.BufferAttribute(uvs2, 2));
	scene.add(new THREE.Mesh(geo2, mat));

	addVertexLabels();
}

function addVertexLabels() {
	const vertices = [
		['v0', -1.1, -1.0, 0],
		['v1', -0.1, -1.0, 0],
		['v2', -1.1,  1.0, 0],
		['v3',  0.1,  1.0, 0],
		['v4',  1.1, -1.0, 0],
		['v5',  1.1,  1.0, 0],
	];

	for (const [name, x, y, z] of vertices) {
		const div = document.createElement('div');
		div.textContent = name;
		div.style.cssText =
			'background:rgba(0,0,0,0.65);color:#ffdd88;padding:2px 6px;' +
			'border-radius:4px;font-size:12px;font-family:Arial,sans-serif;' +
			'border:1px solid #ffdd8866;';
		const label = new CSS2DObject(div);
		label.position.set(x, y, z);
		scene.add(label);
	}
}

const WRAP_MODES = {
	clamp:  THREE.ClampToEdgeWrapping,
	repeat: THREE.RepeatWrapping,
	mirror: THREE.MirroredRepeatWrapping,
};

function applyWrapping() {
	const tex = textures.uv1.object;
	if (!tex) return;
	tex.wrapS = WRAP_MODES[document.getElementById('wrapS').value];
	tex.wrapT = WRAP_MODES[document.getElementById('wrapT').value];
	tex.needsUpdate = true;
}

function applyUVs() {
	const uvAttr1 = geo1.attributes.uv;
	uvAttr1.setXY(0, readFloat('t1v0u'), readFloat('t1v0v'));
	uvAttr1.setXY(1, readFloat('t1v1u'), readFloat('t1v1v'));
	uvAttr1.setXY(2, readFloat('t1v2u'), readFloat('t1v2v'));
	uvAttr1.needsUpdate = true;

	const uvAttr2 = geo2.attributes.uv;
	uvAttr2.setXY(0, readFloat('t2v3u'), readFloat('t2v3v'));
	uvAttr2.setXY(1, readFloat('t2v4u'), readFloat('t2v4v'));
	uvAttr2.setXY(2, readFloat('t2v5u'), readFloat('t2v5v'));
	uvAttr2.needsUpdate = true;

	applyWrapping();
	drawUVSpace();
}

function setupUVControls() {
	const inputs = document.querySelectorAll('#panel-editor input');

	// Formato inicial: mostrar siempre un decimal
	inputs.forEach((input) => {
		const val = parseFloat(input.value);
		input.value = isNaN(val) ? '0.0' : val.toFixed(3);
	});

	// Al perder el foco: formatear y actualizar
	inputs.forEach((input) => {
		input.addEventListener('blur', () => {
			const val = parseFloat(input.value);
			input.value = isNaN(val) ? '0.0' : val.toFixed(3);
			applyUVs();
		});
	});

	document.getElementById('wrapS').addEventListener('change', applyUVs);
	document.getElementById('wrapT').addEventListener('change', applyUVs);

	document.getElementById('btnActualizar').addEventListener('click', applyUVs);

	document.getElementById('btnReset').addEventListener('click', () => {
		DEFAULT_UVS.forEach(([idU, idV, u, v]) => {
			document.getElementById(idU).value = u.toFixed(1);
			document.getElementById(idV).value = v.toFixed(1);
		});
		applyUVs();
	});
}

function readFloat(id) {
	return parseFloat(document.getElementById(id).value) || 0;
}

// ---------------------------------------------------------------------------
// Visualización del espacio UV en el canvas 2D
// ---------------------------------------------------------------------------

function drawUVSpace() {
	const canvas = document.getElementById('uvCanvas');
	if (!canvas) return;

	const wrap = document.getElementById('uv-canvas-wrap');
	const W = wrap.clientWidth;
	const H = wrap.clientHeight;
	if (W === 0 || H === 0) return;

	// Ajustar resolución interna del canvas al tamaño del contenedor
	canvas.width = W;
	canvas.height = H;

	const ctx = canvas.getContext('2d');
	ctx.clearRect(0, 0, W, H);

	// Margen para etiquetas de ejes
	const ML = 32; // izquierda (eje V)
	const MB = 28; // abajo (eje U)
	const MT = 8;
	const MR = 8;
	const drawW = W - ML - MR;
	const drawH = H - MT - MB;

	// Convierte coordenadas UV → píxeles en el canvas
	// V=0 queda abajo, V=1 queda arriba (invertir Y)
	function uvToXY(u, v) {
		return [ML + u * drawW, MT + (1 - v) * drawH];
	}

	// Fondo negro del área UV
	ctx.fillStyle = '#111';
	ctx.fillRect(ML, MT, drawW, drawH);

	// Textura como fondo si está disponible
	const img = textures.uv1.object && textures.uv1.object.image;
	if (img && img.complete) {
		ctx.drawImage(img, ML, MT, drawW, drawH);
	}

	// --- Grid y ejes ---
	const ticks = [0, 0.25, 0.5, 0.75, 1.0];

	ctx.font = '10px Arial';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'top';

	for (const t of ticks) {
		const [x] = uvToXY(t, 0);
		const [, y] = uvToXY(0, t);

		// Línea vertical (U constante)
		ctx.strokeStyle = t === 0 || t === 1 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)';
		ctx.lineWidth = t === 0 || t === 1 ? 1.5 : 0.5;
		ctx.beginPath();
		ctx.moveTo(x, MT);
		ctx.lineTo(x, MT + drawH);
		ctx.stroke();

		// Línea horizontal (V constante)
		ctx.beginPath();
		ctx.moveTo(ML, y);
		ctx.lineTo(ML + drawW, y);
		ctx.stroke();

		// Etiqueta eje U (abajo)
		ctx.fillStyle = 'rgba(255,255,255,0.8)';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		ctx.fillText(t.toString(), x, MT + drawH + 4);

		// Etiqueta eje V (izquierda)
		ctx.textAlign = 'right';
		ctx.textBaseline = 'middle';
		ctx.fillText(t.toString(), ML - 4, y);
	}

	// Título ejes
	ctx.fillStyle = 'rgba(200,200,255,0.9)';
	ctx.font = 'bold 11px Arial';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'top';
	ctx.fillText('U', ML + drawW / 2, MT + drawH + 16);

	ctx.save();
	ctx.translate(10, MT + drawH / 2);
	ctx.rotate(-Math.PI / 2);
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('V', 0, 0);
	ctx.restore();

	// --- Triángulos UV ---
	const uvsT1 = [
		[readFloat('t1v0u'), readFloat('t1v0v'), 'v0'],
		[readFloat('t1v1u'), readFloat('t1v1v'), 'v1'],
		[readFloat('t1v2u'), readFloat('t1v2v'), 'v2'],
	];
	const uvsT2 = [
		[readFloat('t2v3u'), readFloat('t2v3v'), 'v3'],
		[readFloat('t2v4u'), readFloat('t2v4v'), 'v4'],
		[readFloat('t2v5u'), readFloat('t2v5v'), 'v5'],
	];

	drawUVTriangle(ctx, uvsT1, COLOR_T1, uvToXY);
	drawUVTriangle(ctx, uvsT2, COLOR_T2, uvToXY);
}

function drawUVTriangle(ctx, verts, color, uvToXY) {
	const pts = verts.map(([u, v]) => uvToXY(u, v));

	// Relleno semitransparente
	ctx.beginPath();
	ctx.moveTo(pts[0][0], pts[0][1]);
	ctx.lineTo(pts[1][0], pts[1][1]);
	ctx.lineTo(pts[2][0], pts[2][1]);
	ctx.closePath();
	ctx.fillStyle = color + '33'; // ~20% opacidad
	ctx.fill();

	// Contorno
	ctx.strokeStyle = color;
	ctx.lineWidth = 1.5;
	ctx.stroke();

	// Puntos y etiquetas en cada vértice
	for (let i = 0; i < verts.length; i++) {
		const [px, py] = pts[i];
		const label = verts[i][2];

		ctx.beginPath();
		ctx.arc(px, py, 3.5, 0, Math.PI * 2);
		ctx.fillStyle = color;
		ctx.fill();

		ctx.fillStyle = 'white';
		ctx.font = 'bold 10px Arial';
		ctx.textAlign = 'left';
		ctx.textBaseline = 'bottom';
		ctx.fillText(label, px + 5, py - 2);
	}
}

// ---------------------------------------------------------------------------

function loadTextures(callback) {
	const loadingManager = new THREE.LoadingManager();
	loadingManager.onLoad = () => {
		callback();
	};

	for (const key in textures) {
		const loader = new THREE.TextureLoader(loadingManager);
		const texture = textures[key];
		texture.object = loader.load(
			'maps/' + texture.url,
			(tex) => {
				tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
				textures[key].object = tex;
			},
			null,
			(error) => {
				console.error('Error al cargar textura', key, error);
			}
		);
	}
}

function animate() {
	requestAnimationFrame(animate);
	renderer.render(scene, camera);
	labelRenderer.render(scene, camera);
}

function start() {
	setupThreeJs();
	buildScene();
	setupUVControls();
	drawUVSpace();
	animate();
}

loadTextures(start);
