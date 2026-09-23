import * as THREE from 'three';

// Frustum dibujado con geometría real (12 cilindros, uno por arista) en vez de líneas: un grosor
// en píxeles vía shader depende de la resolución del canvas y es frágil (si la vista arranca
// oculta, la resolución es 0 y el shader genera triángulos gigantes). Con geometría el grosor es
// un radio fijo en unidades de mundo, siempre correcto sin importar el tamaño del canvas.
export function createFrustumMesh(radius = 0.017, color = 0xffffff) {
	const edgeGeo = new THREE.CylinderGeometry(radius, radius, 1, 6);
	const edgeMat = new THREE.MeshBasicMaterial({ color });
	const group = new THREE.Group();
	group.matrixAutoUpdate = false;
	const edges = Array.from({ length: 12 }, () => {
		const m = new THREE.Mesh(edgeGeo, edgeMat);
		group.add(m);
		return m;
	});
	const UP = new THREE.Vector3(0, 1, 0);

	// Recalcula las 8 esquinas del frustum des-proyectando el cubo NDC con projectionMatrixInverse
	// y orienta los 12 cilindros. El grupo entero se mueve como un todo con matrix = matrixWorld,
	// así que esto es válido sin importar dónde esté la cámara.
	function update(camera) {
		group.matrix.copy(camera.matrixWorld);
		const NDC = [
			[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], // near
			[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1], // far
		];
		const [n1, n2, n3, n4, f1, f2, f3, f4] = NDC.map(([x, y, z]) => new THREE.Vector3(x, y, z).applyMatrix4(camera.projectionMatrixInverse));
		const pairs = [
			[n1, n2], [n2, n3], [n3, n4], [n4, n1],
			[f1, f2], [f2, f3], [f3, f4], [f4, f1],
			[n1, f1], [n2, f2], [n3, f3], [n4, f4],
		];
		pairs.forEach(([a, b], k) => {
			const mesh = edges[k];
			const dir = new THREE.Vector3().subVectors(b, a);
			const len = dir.length();
			mesh.position.copy(a).addScaledVector(dir, 0.5);
			mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
			mesh.scale.set(1, len, 1);
		});
	}

	return { group, edges, edgeGeo, edgeMat, update };
}

// Cámara de filmación: caja + un pequeño lente al frente + dos carretes arriba, sombreado Phong
// naranja (necesita una luz en la escena). El "frente" del modelo es su -Z local: coincide con
// hacia dónde mira `camera` (las cámaras de three.js miran hacia su -Z), así que al copiar
// `camera.quaternion` el lente queda apuntando exactamente hacia donde apunta el frustum.
// BACK_OFFSET es cuánto se corre la malla hacia atrás (+Z local) para que el vértice del frustum
// (la posición real de `camera`) no quede incrustado dentro del cuerpo.
export const MOVIE_CAMERA_BACK_OFFSET = 0.3;

export function createMovieCamera(color = 0xff8a1e) {
	const mat = new THREE.MeshPhongMaterial({ color, shininess: 35 });
	const group = new THREE.Group();

	const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.26, 0.3), mat);
	group.add(body);

	// Lente: un cubo chico que sobresale del frente (-Z).
	const lens = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.12), mat);
	lens.position.set(0, -0.02, -0.21);
	group.add(lens);

	// Carretes: dos discos apoyados arriba del cuerpo, con el eje a lo ancho (X) para que se vean
	// como ruedas en la vista 3/4 habitual de la escena.
	const reelGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.05, 24);
	reelGeo.rotateZ(Math.PI / 2);
	const reelY = 0.13 + 0.1 * 0.5;
	const reelL = new THREE.Mesh(reelGeo, mat);
	reelL.position.set(-0.1, reelY, 0);
	const reelR = new THREE.Mesh(reelGeo, mat);
	reelR.position.set(0.1, reelY, 0);
	group.add(reelL, reelR);

	return group;
}

// Ubica la malla de la cámara detrás del vértice real del frustum (la posición de `camera`),
// corrida a lo largo de su eje +Z (el opuesto de hacia dónde mira), para que no se solape con el frustum.
export function placeMovieCamera(mesh, camera, back = MOVIE_CAMERA_BACK_OFFSET) {
	mesh.quaternion.copy(camera.quaternion);
	const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
	mesh.position.copy(camera.position).addScaledVector(dir, back);
}

// Sprite 2D con texto: reemplaza etiquetas HTML superpuestas (que van un frame detrás del render
// y "vibran" al arrastrar) por geometría sincronizada con la escena. `center.y` se fija de forma
// que el sprite quede `gapPx` píxeles por encima del punto que ancla (sin mover `position`, así que
// el hueco no depende de dónde esté ese punto); `heightPx` es el alto en pantalla, independiente del
// zoom: fitLabelToScreen() debe llamarse en cada frame para recalcular la escala según la distancia.
export function createLabelSprite(text, color = '#ffffff', { heightPx = 15, gapPx = 22.5 } = {}) {
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	const font = '600 40px system-ui, sans-serif';
	ctx.font = font;
	const pad = 16;
	const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
	const h = 56;
	canvas.width = w;
	canvas.height = h;
	ctx.font = font;
	ctx.textBaseline = 'middle';
	ctx.fillStyle = 'rgba(10,12,16,0.8)';
	ctx.beginPath();
	if (ctx.roundRect) ctx.roundRect(0, 0, w, h, 10);
	else ctx.rect(0, 0, w, h);
	ctx.fill();
	ctx.fillStyle = color;
	ctx.fillText(text, pad, h / 2 + 2);
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
	const sprite = new THREE.Sprite(material);
	sprite.center.set(0.5, -gapPx / heightPx);
	sprite.userData.aspect = w / h;
	sprite.userData.heightPx = heightPx;
	sprite.renderOrder = 10;
	return sprite;
}

// Recalcula la escala del sprite para que mida `heightPx` píxeles en pantalla sin importar la
// distancia a `renderCamera` (la que efectivamente renderiza la vista) ni el zoom del orbit control.
export function fitLabelToScreen(sprite, renderCamera, viewportHeightPx) {
	if (!viewportHeightPx) return;
	const dist = renderCamera.position.distanceTo(sprite.position);
	const vFov = THREE.MathUtils.degToRad(renderCamera.fov);
	const worldPerPixel = (2 * Math.tan(vFov / 2) * dist) / viewportHeightPx;
	const h = sprite.userData.heightPx * worldPerPixel;
	sprite.scale.set(h * sprite.userData.aspect, h, 1);
}

export function disposeLabelSprite(sprite) {
	sprite.material.map.dispose();
	sprite.material.dispose();
}
