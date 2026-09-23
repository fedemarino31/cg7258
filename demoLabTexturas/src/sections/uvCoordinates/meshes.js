import * as THREE from 'three';

// Malla "sopa de triángulos": cada triángulo tiene sus 3 vértices propios (posición, normal, uv) e isla.
class Soup {
	constructor() {
		this.pos = [];
		this.nor = [];
		this.uv = [];
		this.island = [];
	}
	tri(p, n, uv, island) {
		for (let k = 0; k < 3; k++) {
			this.pos.push(p[k].x, p[k].y, p[k].z);
			this.nor.push(n[k].x, n[k].y, n[k].z);
			this.uv.push(uv[k][0], uv[k][1]);
		}
		this.island.push(island);
	}
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function roundedCube() {
	const soup = new Soup();
	const n = 6;
	// [normal, right, up, columna, fila] del despliegue en cruz (4 columnas × 3 filas)
	const faces = [
		[V(0, 0, 1), V(1, 0, 0), V(0, 1, 0), 1, 1],
		[V(1, 0, 0), V(0, 0, -1), V(0, 1, 0), 2, 1],
		[V(0, 0, -1), V(-1, 0, 0), V(0, 1, 0), 3, 1],
		[V(-1, 0, 0), V(0, 0, 1), V(0, 1, 0), 0, 1],
		[V(0, 1, 0), V(1, 0, 0), V(0, 0, -1), 1, 2],
		[V(0, -1, 0), V(1, 0, 0), V(0, 0, 1), 1, 0],
	];
	const cell = 0.25;
	faces.forEach(([N, R, U, col, row], fi) => {
		const P = (a, b) => {
			const p = N.clone().addScaledVector(R, 2 * a - 1).addScaledVector(U, 2 * b - 1);
			const inner = p.clone().clampScalar(-0.62, 0.62);
			const d = p.clone().sub(inner).normalize();
			const q = inner.addScaledVector(d, 0.38);
			return [q.multiplyScalar(1.3), d];
		};
		const UV = (a, b) => [(col + a) * cell, 0.125 + (row + b) * cell];
		for (let i = 0; i < n; i++)
			for (let j = 0; j < n; j++) {
				const a0 = i / n,
					a1 = (i + 1) / n,
					b0 = j / n,
					b1 = (j + 1) / n;
				const p00 = P(a0, b0),
					p10 = P(a1, b0),
					p11 = P(a1, b1),
					p01 = P(a0, b1);
				soup.tri([p00[0], p10[0], p11[0]], [p00[1], p10[1], p11[1]], [UV(a0, b0), UV(a1, b0), UV(a1, b1)], fi);
				soup.tri([p00[0], p11[0], p01[0]], [p00[1], p11[1], p01[1]], [UV(a0, b0), UV(a1, b1), UV(a0, b1)], fi);
			}
	});
	return { soup, islandNames: ['+Z', '+X', '-Z', '-X', '+Y', '-Y'] };
}

function cylinder() {
	const soup = new Soup();
	const R = 0.85,
		H = 1.7,
		segs = 28,
		rows = 6;
	const k = 0.9 / (2 * Math.PI * R);
	const sideV0 = 0.06;
	const at = (t, y) => V(Math.cos(t) * R, y, -Math.sin(t) * R);
	const nor = (t) => V(Math.cos(t), 0, -Math.sin(t));
	for (let i = 0; i < segs; i++)
		for (let j = 0; j < rows; j++) {
			const t0 = (i / segs) * 2 * Math.PI,
				t1 = ((i + 1) / segs) * 2 * Math.PI;
			const y0 = -H / 2 + (j / rows) * H,
				y1 = -H / 2 + ((j + 1) / rows) * H;
			const uv = (a, y) => [0.05 + (a / segs) * 0.9, sideV0 + (y + H / 2) * k];
			const p = [at(t0, y0), at(t1, y0), at(t1, y1), at(t0, y1)];
			const nn = [nor(t0), nor(t1), nor(t1), nor(t0)];
			const u = [uv(i, y0), uv(i + 1, y0), uv(i + 1, y1), uv(i, y1)];
			soup.tri([p[0], p[1], p[2]], [nn[0], nn[1], nn[2]], [u[0], u[1], u[2]], 0);
			soup.tri([p[0], p[2], p[3]], [nn[0], nn[2], nn[3]], [u[0], u[2], u[3]], 0);
		}
	const cap = (y, up, cx, cy, island) => {
		const ny = V(0, up ? 1 : -1, 0);
		const rings = 3;
		const P = (r, t) => V(Math.cos(t) * r * R, y, -Math.sin(t) * r * R);
		const uvOf = (r, t) => [cx + Math.cos(t) * r * R * k, cy + Math.sin(t) * r * R * k];
		const tri = (a, b, c) => {
			const list = up ? [a, b, c] : [a, c, b];
			soup.tri(list.map((q) => P(...q)), [ny, ny, ny], list.map((q) => uvOf(...q)), island);
		};
		for (let i = 0; i < segs; i++) {
			const t0 = (i / segs) * 2 * Math.PI,
				t1 = ((i + 1) / segs) * 2 * Math.PI;
			for (let j = 0; j < rings; j++) {
				const r0 = j / rings,
					r1 = (j + 1) / rings;
				if (j === 0) tri([0, t0], [r1, t0], [r1, t1]);
				else {
					tri([r0, t0], [r1, t0], [r1, t1]);
					tri([r0, t0], [r1, t1], [r0, t1]);
				}
			}
		}
	};
	cap(H / 2, true, 0.3, 0.74, 1);
	cap(-H / 2, false, 0.7, 0.74, 2);
	return { soup, islandNames: ['Lateral', 'Tapa superior', 'Tapa inferior'] };
}

function sphere() {
	const soup = new Soup();
	const W = 32,
		Hh = 16,
		R = 1.4;
	const P = (i, j) => {
		const th = (i / W) * 2 * Math.PI;
		const ph = (j / Hh) * Math.PI;
		return V(Math.cos(th) * Math.sin(ph) * R, Math.cos(ph) * R, -Math.sin(th) * Math.sin(ph) * R);
	};
	const UV = (i, j) => [0.02 + (i / W) * 0.96, 0.02 + (1 - j / Hh) * 0.96];
	for (let i = 0; i < W; i++)
		for (let j = 0; j < Hh; j++) {
			const a = [i, j],
				b = [i + 1, j],
				c = [i + 1, j + 1],
				d = [i, j + 1];
			const pa = P(...a),
				pb = P(...b),
				pc = P(...c),
				pd = P(...d);
			const nn = (p) => p.clone().normalize();
			if (j > 0) soup.tri([pa, pc, pb], [nn(pa), nn(pc), nn(pb)], [UV(...a), UV(...c), UV(...b)], 0);
			if (j < Hh - 1) soup.tri([pa, pd, pc], [nn(pa), nn(pd), nn(pc)], [UV(...a), UV(...d), UV(...c)], 0);
		}
	return { soup, islandNames: ['Única isla'] };
}

const BUILDERS = { cube: roundedCube, cylinder, sphere };
export const MESH_KINDS = [
	{ value: 'cube', label: 'Cubo redondeado (6 islas)' },
	{ value: 'cylinder', label: 'Cilindro (3 islas)' },
	{ value: 'sphere', label: 'Esfera (1 isla, con polos)' },
];

const key = (p) => `${Math.round(p.x * 1e4) + 0},${Math.round(p.y * 1e4) + 0},${Math.round(p.z * 1e4) + 0}`;

function heat(t) {
	const c = new THREE.Color();
	c.setHSL((1 - Math.min(1, Math.max(0, t))) * 0.66, 0.85, 0.5);
	return c;
}

const ISLAND_COLORS = ['#e5484d', '#f5a25d', '#ffd84d', '#46a758', '#3e63dd', '#a259d9'];
export const islandColor = (i) => ISLAND_COLORS[i % ISLAND_COLORS.length];

export function buildMesh(kind) {
	const { soup, islandNames } = BUILDERS[kind]();
	const T = soup.island.length;
	const pos = new Float32Array(soup.pos);
	const nor = new Float32Array(soup.nor);
	const uv = new Float32Array(soup.uv);
	const island = Int32Array.from(soup.island);

	// costuras: aristas cuya misma posición 3D tiene UV distintas (o que no tienen vecino)
	const edges = new Map();
	const vp = (t, k) => V(pos[(t * 3 + k) * 3], pos[(t * 3 + k) * 3 + 1], pos[(t * 3 + k) * 3 + 2]);
	const vuv = (t, k) => [uv[(t * 3 + k) * 2], uv[(t * 3 + k) * 2 + 1]];
	for (let t = 0; t < T; t++)
		for (let e = 0; e < 3; e++) {
			const ka = key(vp(t, e)),
				kb = key(vp(t, (e + 1) % 3));
			const flip = ka > kb;
			const id = flip ? kb + '|' + ka : ka + '|' + kb;
			const ua = vuv(t, e),
				ub = vuv(t, (e + 1) % 3);
			if (!edges.has(id)) edges.set(id, []);
			edges.get(id).push({ t, e, u0: flip ? ub : ua, u1: flip ? ua : ub });
		}
	const seams = [];
	for (const list of edges.values()) {
		let seam = list.length < 2;
		for (let k = 1; k < list.length && !seam; k++) {
			const d = Math.hypot(list[0].u0[0] - list[k].u0[0], list[0].u0[1] - list[k].u0[1]) + Math.hypot(list[0].u1[0] - list[k].u1[0], list[0].u1[1] - list[k].u1[1]);
			if (d > 1e-4) seam = true;
		}
		if (seam) list.forEach((h) => seams.push({ t: h.t, e: h.e }));
	}

	// áreas y densidad de texels
	const area3 = new Float32Array(T);
	const areaUV = new Float32Array(T);
	const dens = new Float32Array(T);
	for (let t = 0; t < T; t++) {
		const a = vp(t, 0),
			b = vp(t, 1),
			c = vp(t, 2);
		area3[t] = b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
		const [ua, ub, uc] = [vuv(t, 0), vuv(t, 1), vuv(t, 2)];
		areaUV[t] = Math.abs((ub[0] - ua[0]) * (uc[1] - ua[1]) - (uc[0] - ua[0]) * (ub[1] - ua[1])) / 2;
		dens[t] = Math.sqrt(areaUV[t] / Math.max(area3[t], 1e-9));
	}
	const sorted = Array.from(dens).sort((x, y) => x - y);
	const median = sorted[Math.floor(sorted.length / 2)] || 1;
	const rel = Float32Array.from(dens, (d) => d / median);

	const colIsland = new Float32Array(T * 9);
	const colDens = new Float32Array(T * 9);
	for (let t = 0; t < T; t++) {
		const ci = new THREE.Color(islandColor(island[t]));
		const cd = heat(0.5 + Math.log2(Math.max(rel[t], 1e-3)) / 4);
		for (let k = 0; k < 3; k++) {
			colIsland.set([ci.r, ci.g, ci.b], (t * 3 + k) * 3);
			colDens.set([cd.r, cd.g, cd.b], (t * 3 + k) * 3);
		}
	}
	const islandCentroids = islandNames.map(() => [0, 0, 0]);
	for (let t = 0; t < T; t++) {
		const c = islandCentroids[island[t]];
		for (let k = 0; k < 3; k++) {
			c[0] += uv[(t * 3 + k) * 2];
			c[1] += uv[(t * 3 + k) * 2 + 1];
			c[2]++;
		}
	}
	return {
		T,
		pos,
		nor,
		uv,
		island,
		islandNames,
		seams,
		area3,
		areaUV,
		rel,
		colIsland,
		colDens,
		islandCentroids: islandCentroids.map((c) => [c[0] / c[2], c[1] / c[2]]),
		trisOfIsland: (id) => {
			const r = [];
			for (let t = 0; t < T; t++) if (island[t] === id) r.push(t);
			return r;
		},
		vp,
		vuv,
	};
}
