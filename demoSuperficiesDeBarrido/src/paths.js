import * as THREE from 'three';

export function getPathLinea(segmentosTotales, longitud) {
	let path = {
		matricesVertices: [],
		matricesNormales: [],
	};

	for (let i = 0; i < segmentosTotales; i++) {
		let pos = new THREE.Vector3(0, 0, -longitud / 2 + (longitud * i) / segmentosTotales);

		let tan = new THREE.Vector3(0, 0, -1);
		let nrm = new THREE.Vector3(0, 1, 0);
		let bin = new THREE.Vector3(-1, 0, 0);
		//bin.crossVectors(nrm,tan);
		//bin.normalize();

		let m1 = new THREE.Matrix4();
		m1.makeTranslation(pos.x, pos.y, pos.z);

		let m2 = new THREE.Matrix4();
		m2.makeBasis(bin, nrm, tan);

		let m3 = new THREE.Matrix4();
		m3.multiplyMatrices(m1, m2);

		path.matricesVertices.push(m3);
		path.matricesNormales.push(m2);
	}

	return path;
}

export function getPathRectangular(ancho, largo, segmentosTotales = 32) {
	const halfW = ancho / 2, halfL = largo / 2;
	const corners = [new THREE.Vector3(-halfW, 0, -halfL), new THREE.Vector3(halfW, 0, -halfL), new THREE.Vector3(halfW, 0, halfL), new THREE.Vector3(-halfW, 0, halfL)];
	const points = [];
	const perimeter = 2 * (ancho + largo);
	for (let i = 0; i < segmentosTotales; i++) {
		let distance = perimeter * i / segmentosTotales, sideLength;
		for (let side = 0; side < 4; side++) {
			sideLength = side % 2 === 0 ? ancho : largo;
			if (distance <= sideLength || side === 3) { const a = corners[side], b = corners[(side + 1) % 4]; points.push(a.clone().lerp(b, distance / sideLength)); break; }
			distance -= sideLength;
		}
	}
	const path = { matricesVertices: [], matricesNormales: [] };
	for (let i = 0; i < points.length; i++) {
		const p = points[i], next = points[(i + 1) % points.length];
		const tan = next.clone().sub(p).normalize(), nrm = new THREE.Vector3(0, 1, 0), bin = new THREE.Vector3().crossVectors(nrm, tan).normalize();
		const basis = new THREE.Matrix4().makeBasis(bin, nrm, tan);
		path.matricesVertices.push(new THREE.Matrix4().makeTranslation(p.x, p.y, p.z).multiply(basis));
		path.matricesNormales.push(basis);
	}
	return path;
}

export const getPathRectangulo = getPathRectangular;

// `ejeXHaciaExterior` permite que un perfil de revolución use X local hacia
// afuera del círculo, manteniendo sus coordenadas 2D y su proyección 3D alineadas.
export function getPathCirculo(radio, segmentosTotales, ejeXHaciaExterior = false) {
	let path = {
		matricesVertices: [],
		matricesNormales: [],
	};

	for (let i = 0; i <= segmentosTotales; i++) {
		let alfa = 2 * Math.PI * (i / segmentosTotales);

		let x = radio * Math.cos(alfa);
		let z = radio * Math.sin(alfa);

		let tx = -Math.sin(alfa);
		let tz = Math.cos(alfa);

		let direccionX = ejeXHaciaExterior ? 1 : -1;
		let bx = direccionX * Math.cos(alfa);
		let bz = direccionX * Math.sin(alfa);

		let pos = new THREE.Vector3(x, 0, z);

		let tan = new THREE.Vector3(tx, 0, tz);
		let nrm = new THREE.Vector3(0, 1, 0);
		let bin = new THREE.Vector3(bx, 0, bz);

		bin.normalize();

		let m1 = new THREE.Matrix4();
		m1.makeTranslation(pos.x, pos.y, pos.z);

		let m2 = new THREE.Matrix4();
		m2.makeBasis(bin, nrm, tan);

		let m3 = new THREE.Matrix4();
		m3.multiplyMatrices(m1, m2);

		path.matricesVertices.push(m3);
		path.matricesNormales.push(m2);
	}

	return path;
}

export function getPathHelice(radio, paso, vueltas, segPorVuelta) {
	if (!segPorVuelta) segPorVuelta = 8;

	let path = {
		matricesVertices: [],
		matricesNormales: [],
	};

	let fPaso = paso / (2 * Math.PI);

	let segmentosTotales = Math.floor(segPorVuelta * vueltas);

	let c2r2 = Math.sqrt(fPaso * fPaso + radio * radio);

	let h = paso * vueltas;

	for (let i = 0; i < segmentosTotales; i++) {
		let alfa = vueltas * 2 * Math.PI * (i / segmentosTotales);

		let pos = new THREE.Vector3(radio * Math.cos(alfa), radio * Math.sin(alfa), fPaso * alfa - h / 2);

		let tan = new THREE.Vector3((-radio * Math.sin(alfa)) / c2r2, (radio * Math.cos(alfa)) / c2r2, fPaso / c2r2);
		let nrm = new THREE.Vector3(-Math.cos(alfa), -Math.sin(alfa), 0);
		let bin = new THREE.Vector3();
		bin.crossVectors(nrm, tan);

		let m1 = new THREE.Matrix4();
		m1.makeTranslation(pos.x, pos.y, pos.z);

		let m2 = new THREE.Matrix4();
		m2.makeBasis(nrm, bin, tan);

		let m3 = new THREE.Matrix4();
		m3.multiplyMatrices(m1, m2);

		path.matricesVertices.push(m3);
		path.matricesNormales.push(m2);
	}

	return path;
}
