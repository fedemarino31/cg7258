import * as THREE from 'three';
let epsilon = 0.001;

export function getCirculo(radio, segmentos) {
	var shape = { posiciones: [], normales: [], tangentes: [], closed: true };

	if (!segmentos) segmentos = 8;

	for (var i = 0; i <= segmentos; i++) {
		var alfa = (2 * Math.PI * i) / segmentos;

		shape.posiciones.push(new THREE.Vector2(radio * Math.cos(alfa), radio * Math.sin(alfa)));
		shape.normales.push(new THREE.Vector2(Math.cos(alfa), Math.sin(alfa)));
		//shape.normales.push(new THREE.Vector2(1,0));
		shape.tangentes.push(new THREE.Vector2(Math.cos(alfa + Math.PI * 0.5), Math.sin(alfa + Math.PI * 0.5)));
	}

	return shape;
}

// Perfil abierto de una copa de champagne. Al barrerlo con un path circular,
// el eje de revolución queda en X = -radioEje del espacio local del perfil.
export function getPerfilCopaChampagne(segmentos = 24, radioEje = 6) {
	const escala = 2;
	const perfil = [
		[0, 0], [2.6, 0.06], [3.15, 0.2], [1.15, 0.42],
		[0.42, 0.68], [0.3, 2.9], [0.42, 3.35], [1.05, 4.1],
		// Exterior: base, tallo y cáliz.
		[2.15, 5.1], [3.0, 6.35], [3.35, 7.85], [3.25, 8.1],
		// Borde e interior del cáliz. El último punto vuelve al eje de
		// revolución y cierra el fondo interior, sin dejar un agujero.
		[3.05, 8.15], [3.02, 7.45], [2.65, 6.15], [1.95, 5.15],
		[1.15, 4.5], [0.48, 4.2], [0, 4.1],
	].map(([radio, altura]) => new THREE.Vector3(radio, altura, 0));
	const curva = new THREE.CatmullRomCurve3(perfil, false, 'centripetal');
	const shape = { posiciones: [], normales: [], tangentes: [], closed: false, reverseWinding: true };

	for (let i = 0; i <= segmentos; i++) {
		const u = i / segmentos;
		const punto = curva.getPoint(u);
		const tangenteRadial = curva.getTangent(u).normalize();
		const tangente = new THREE.Vector2(tangenteRadial.x, tangenteRadial.y).normalize();
		// El perfil vive a la izquierda del origen: el punto (0, 0) local se
		// transforma en el centro del path y X = -radioEje coincide con el eje.
		// Escala respecto del primer vértice (-radioEje, 0), que coincide con
		// el eje de revolución; así el eje permanece fijo y no aparece un hueco.
		shape.posiciones.push(new THREE.Vector2(escala * punto.x - radioEje, escala * punto.y));
		// Normal exterior de la superficie de revolución (perfil abierto).
		shape.normales.push(new THREE.Vector2(tangente.y, -tangente.x));
		shape.tangentes.push(tangente);
	}

	return shape;
}

// Semicírculo en el semiplano X < 0. Barrido con el path circular forma una esfera.
export function getSemicirculoEsfera(segmentos = 24, radioEje = 6, radio = 3) {
	const escala = 2;
	const radioPerfil = Math.min(radio, radioEje);
	const shape = { posiciones: [], normales: [], tangentes: [], closed: false, reverseWinding: true };
	for (let i = 0; i <= segmentos; i++) {
		const angulo = -Math.PI / 2 + Math.PI * i / segmentos;
		const tangente = new THREE.Vector2(-Math.sin(angulo), Math.cos(angulo));
		shape.posiciones.push(new THREE.Vector2(escala * radioPerfil * Math.cos(angulo) - radioEje, escala * (radioPerfil + radioPerfil * Math.sin(angulo))));
		shape.normales.push(new THREE.Vector2(tangente.y, -tangente.x));
		shape.tangentes.push(tangente);
	}
	return shape;
}

// Base, lateral y tapa: tres segmentos que cierran el cilindro al revolucionar.
export function getPerfilCilindro(radioEje = 6, radio = 3, altura = 6) {
	const escala = 2;
	const radioPerfil = Math.min(radio, radioEje);
	const puntos = [
		[-radioEje, 0], [escala * radioPerfil - radioEje, 0],
		[escala * radioPerfil - radioEje, escala * altura], [-radioEje, escala * altura],
	];
	return {
		posiciones: puntos.map(([x, y]) => new THREE.Vector2(x, y)),
		normales: [new THREE.Vector2(0, -1), new THREE.Vector2(1, 0), new THREE.Vector2(0, 1), new THREE.Vector2(0, 1)],
		tangentes: [new THREE.Vector2(1, 0), new THREE.Vector2(0, 1), new THREE.Vector2(-1, 0), new THREE.Vector2(-1, 0)],
		closed: false,
		reverseWinding: true,
	};
}

export function getShapePos(path, len, pivot, scale) {
	var p = path.getPointAtLength(len);

	p.y = -p.y;
	p.x = -p.x;
	if (pivot) {
		p.x -= pivot[0];
		p.y -= pivot[1];
	}
	if (scale) {
		p.x *= scale;
		p.y *= scale;
	}

	return p;
}

export function getShapeTangent(path, u) {
	var p1 = getShapePos(path, u);
	var p2 = getShapePos(path, u + epsilon);

	var x = p2.x - p1.x;
	var y = p2.y - p1.y;
	var modulo = Math.sqrt(x * x + y * y);

	return {
		x: x / modulo,
		y: y / modulo,
	};
}

export function getShapeNormal(path, u) {
	var p1 = getShapePos(path, u);
	var p2 = getShapePos(path, u + epsilon);

	var x = p2.x - p1.x;
	var y = p2.y - p1.y;
	var modulo = Math.sqrt(x * x + y * y);

	return {
		x: y / modulo,
		y: -x / modulo,
	};
}

export function getShapePivot(pathId) {
	var sh = getShape(pathId, 100);

	var x = 0;
	var y = 0;
	for (var i = 0; i < sh.posiciones.length; i++) {
		x += sh.posiciones[i].x;
		y += sh.posiciones[i].y;
	}
	x /= sh.posiciones.length;
	y /= sh.posiciones.length;

	return [x, y];
}

export function getShape(pathId, segmentos, pivot, scale, uMax, transform = {}) {
	if (!uMax) uMax = 9999;

	var shape = { posiciones: [], normales: [], tangentes: [], closed: true };

	if (!segmentos) segmentos = 8;

	var path = document.getElementById(pathId);
	var pathLength = Math.floor(path.getTotalLength());

	for (var i = 0; i <= segmentos; i++) {
		var u = i / segmentos;
		if (u <= uMax) {
			var len = u * pathLength;

			var pos = getShapePos(path, len, pivot, scale);
			var tan = getShapeTangent(path, len);
			var nrm = getShapeNormal(path, len);

			// Un espejo debe aplicarse también a las direcciones para conservar la geometría.
			if (transform.flipHorizontal) {
				pos.x *= -1;
				tan.x *= -1;
				nrm.x *= -1;
			}
			if (transform.invertNormals) {
				nrm.x *= -1;
				nrm.y *= -1;
			}

			shape.posiciones.push(new THREE.Vector2(pos.x, pos.y));
			shape.normales.push(new THREE.Vector2(nrm.x, nrm.y));
			shape.tangentes.push(new THREE.Vector2(tan.x, tan.y));
		}
	}

	return shape;
}
