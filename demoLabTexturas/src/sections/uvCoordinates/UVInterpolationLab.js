import * as THREE from 'three';
import { TriangleBase, VCOL, VNAME } from './TriangleBase.js';
import { drawTexelGrid, fillTexel, drawHandle, drawTag, drawLine, pathTriangle, fmt } from '../../shared/uvDraw.js';
import { rgbCss } from '../../shared/textures.js';

const DEFAULT_UV = [
	[0.08, 0.1],
	[0.92, 0.18],
	[0.42, 0.94],
];

const STEPS = [
	['Fragmento', 'El rasterizador genera un fragmento en el punto <b>P</b> del triángulo 3D. Arrastralo para moverlo.'],
	['Pesos baricéntricos', 'Se calculan α, β, γ: la fracción de área de cada subtriángulo respecto del total (α+β+γ = 1).'],
	['Interpolar UV', 'Se interpolan los UV de los tres vértices con esos mismos pesos.'],
	['Localizar P′', 'El resultado (u,v) ubica el punto P′ dentro del espacio de textura.'],
	['Consultar el sampler', 'El sampler elige el/los texels a leer según el filtro (Nearest: 1 texel, Linear: 4 texels ponderados).'],
	['Color devuelto', 'El color obtenido se devuelve al fragmento como color del píxel.'],
];

const hexToRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export class UVInterpolationLab extends TriangleBase {
	static help = [
		'Modo "Mover P": arrastrá P sobre el triángulo 3D (o P′ dentro del triángulo UV).',
		'Modo "Recorrido": P recorre el triángulo automáticamente.',
		'Modo "Paso a paso": avanzá con Anterior / Siguiente para ver cada etapa del muestreo.',
		'Podés arrastrar A′, B′, C′ en el espacio UV: la interpolación se recalcula.',
	];

	constructor(layout) {
		super(layout, {
			defaultUV: DEFAULT_UV,
			uvExtent: 1.35,
			texSize: 16,
			vertexDrag3D: false,
			tag3d: 'Arrastrar P sobre el triángulo · fondo: orbitar',
			idea: 'Dentro del triángulo, las coordenadas UV se obtienen interpolando los UV de sus tres vértices. El sampler utiliza ese resultado para consultar la textura.',
			grid: false,
			extraState: { mode: 'move', speed: 1, showBary: true, showTexels: true, showLines: true, step: 0, filter: 'nearest', resolution: '1' },
		});
		this.bary = [0.3, 0.3, 0.4];
		this.t = 0;
		this.P = new THREE.Vector3();
		this.Puv = [0, 0];
		this.samp = null;

		const sc = this.view3d.scene;
		this.pMarker = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffd84d, depthTest: false }));
		this.pMarker.renderOrder = 12;
		sc.add(this.pMarker);

		const lg = new THREE.BufferGeometry();
		lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18), 3));
		const lc = new Float32Array(18);
		[0, 1, 2].forEach((i) => {
			const c = new THREE.Color(VCOL[i]);
			lc.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6);
		});
		lg.setAttribute('color', new THREE.BufferAttribute(lc, 3));
		this.lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false }));
		this.lines.renderOrder = 8;
		sc.add(this.lines);

		const sg = new THREE.BufferGeometry();
		sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(27), 3));
		const sc2 = new Float32Array(27);
		[0, 1, 2].forEach((i) => {
			const c = new THREE.Color(VCOL[i]);
			for (let k = 0; k < 3; k++) sc2.set([c.r, c.g, c.b], i * 9 + k * 3);
		});
		sg.setAttribute('color', new THREE.BufferAttribute(sc2, 3));
		this.subTris = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, depthTest: false, side: THREE.DoubleSide }));
		this.subTris.renderOrder = 5;
		sc.add(this.subTris);

		this.start();
	}

	// ---------- interacción ----------
	clampBary(b) {
		const c = b.map((x) => Math.max(0, x));
		const s = c[0] + c[1] + c[2] || 1;
		return c.map((x) => x / s);
	}

	setPFromRay(ray) {
		const [A, B, C] = this.pos;
		const n = B.clone().sub(A).cross(C.clone().sub(A)).normalize();
		const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, A);
		const q = new THREE.Vector3();
		if (!ray.intersectPlane(plane, q)) return;
		const w = new THREE.Vector3();
		if (!THREE.Triangle.getBarycoord(q, A, B, C, w)) return;
		this.bary = this.clampBary([w.x, w.y, w.z]);
		this.invalidate();
	}

	// Resolución elegida en el selector: la base (cfg.texSize) ×1, ×2 o ×4.
	texSize() {
		return this.cfg.texSize * Number(this.store.state.resolution);
	}

	pick3D(e) {
		if (this.view3d.raycast(e, [this.pMarker, this.mesh]).length === 0) return null;
		return { move: (ray) => this.setPFromRay(ray) };
	}

	hover3D(e) {
		return this.view3d.raycast(e, [this.pMarker, this.mesh]).length > 0;
	}

	uvDown(uv, e, p) {
		if (super.uvDown(uv, e, p)) return true;
		const w = new THREE.Vector3();
		const tri = this.uv.map((q) => new THREE.Vector3(q[0], q[1], 0));
		const q = new THREE.Vector3(uv[0], uv[1], 0);
		if (THREE.Triangle.getBarycoord(q, tri[0], tri[1], tri[2], w) && w.x >= -0.05 && w.y >= -0.05 && w.z >= -0.05) {
			const move = (u) => {
				const qq = new THREE.Vector3(u[0], u[1], 0);
				if (THREE.Triangle.getBarycoord(qq, tri[0], tri[1], tri[2], w)) this.bary = this.clampBary([w.x, w.y, w.z]);
				this.invalidate();
			};
			move(uv);
			this.dragUV = { move };
			return true;
		}
		return false;
	}

	update(dt) {
		this.t += dt * this.store.state.speed;
		const t = this.t;
		this.bary = [0, 1, 2].map((i) => {
			const ph = (i * 2 * Math.PI) / 3;
			return 1 / 3 + 0.22 * Math.cos(t + ph) + 0.1 * Math.cos(2.3 * t + 2 * ph);
		});
	}

	onState(patch) {
		const s = this.store.state;
		this.animating = s.mode === 'auto';
		if (this.prevBtn) {
			this.prevBtn.disabled = s.mode !== 'step' || s.step <= 0;
			this.nextBtn.disabled = s.mode !== 'step' || s.step >= STEPS.length - 1;
		}
		if ('filter' in patch) this.invalidate();
	}

	vis() {
		const s = this.store.state;
		if (s.mode !== 'step') return { bary: s.showBary, texels: s.showTexels, lines: s.showLines, pp: true, interp: true, color: true };
		const k = s.step;
		return { bary: k >= 1, texels: k >= 4, lines: k >= 1, pp: k >= 3, interp: k >= 2, color: k >= 5 };
	}

	buildControlsBody(p) {
		p.segmented('mode', 'Modo', [
			{ value: 'move', label: 'Mover P' },
			{ value: 'auto', label: 'Recorrido' },
			{ value: 'step', label: 'Paso a paso' },
		]);
		p.select('texture', 'Textura', [
			{ value: 'grid', label: 'Cuadrícula UV' },
			{ value: 'checker', label: 'Checkerboard' },
			{ value: 'image', label: 'Imagen (paisaje)' },
		]);
		p.select('filter', 'Filtro', [
			{ value: 'nearest', label: 'Nearest' },
			{ value: 'linear', label: 'Linear' },
		]);
		const [n, m] = [this.cfg.texSize, this.cfg.texSize];
		p.select('resolution', 'Resolución de textura', [
			{ value: '1', label: `${n}×${m} (base)` },
			{ value: '2', label: `${n * 2}×${m * 2} (×2)` },
			{ value: '4', label: `${n * 4}×${m * 4} (×4)` },
		]);
		p.slider('speed', 'Velocidad de animación', { min: 0.2, max: 3, step: 0.1, digits: 1 });
		p.title('Visualización');
		p.checkbox('showBary', 'Mostrar pesos baricéntricos');
		p.checkbox('showTexels', 'Mostrar texels utilizados');
		p.checkbox('showLines', 'Mostrar líneas auxiliares');
		p.title('Paso a paso');
		[this.prevBtn, this.nextBtn] = p.buttons(
			{ label: '← Anterior', onClick: () => this.store.set({ step: Math.max(0, this.store.state.step - 1) }) },
			{ label: 'Siguiente →', onClick: () => this.store.set({ step: Math.min(STEPS.length - 1, this.store.state.step + 1) }) }
		);
		this.read = p.readout();
		p.html(`<details class="formula"><summary>Ver fórmulas</summary>
			P = α·A + β·B + γ·C, con α+β+γ = 1<br>
			α = área(PBC) / área(ABC), β = área(APC) / área(ABC), γ = área(ABP) / área(ABC)<br>
			(u,v) = α·(uA,vA) + β·(uB,vB) + γ·(uC,vC)<br>
			color = sampler(textura, (u,v))</details>`);
	}

	// ---------- render ----------
	renderExtra() {
		const s = this.store.state;
		const vis = this.vis();
		const [A, B, C] = this.pos;
		const b = this.bary;
		this.P.set(0, 0, 0).addScaledVector(A, b[0]).addScaledVector(B, b[1]).addScaledVector(C, b[2]);
		this.Puv = [b[0] * this.uv[0][0] + b[1] * this.uv[1][0] + b[2] * this.uv[2][0], b[0] * this.uv[0][1] + b[1] * this.uv[1][1] + b[2] * this.uv[2][1]];
		this.samp = this.texData().sample(this.Puv[0], this.Puv[1], 'clamp', s.filter);

		this.pMarker.position.copy(this.P);
		const lp = this.lines.geometry.attributes.position;
		[A, B, C].forEach((V, i) => {
			lp.setXYZ(i * 2, this.P.x, this.P.y, this.P.z);
			lp.setXYZ(i * 2 + 1, V.x, V.y, V.z);
		});
		lp.needsUpdate = true;
		this.lines.visible = vis.lines;
		const sp = this.subTris.geometry.attributes.position;
		const tris = [
			[this.P, B, C],
			[A, this.P, C],
			[A, B, this.P],
		];
		tris.forEach((t, i) => t.forEach((V, k) => sp.setXYZ(i * 3 + k, V.x, V.y, V.z)));
		sp.needsUpdate = true;
		this.subTris.visible = vis.bary;

		let html = 'P';
		if (vis.bary) html += `<small>α ${fmt(b[0])} · β ${fmt(b[1])} · γ ${fmt(b[2])}</small>`;
		if (vis.interp) html += `<small>uv (${fmt(this.Puv[0])}, ${fmt(this.Puv[1])})</small>`;
		if (vis.color) html += `<small><span class="sw" style="background:${rgbCss(this.samp.rgb)}"></span>color devuelto</small>`;
		this.view3d.labels.set('P', { html, color: '#ffd84d', position: this.P, offset: [14, 6] });
		this.updateReadout(vis);
	}

	updateReadout(vis) {
		const s = this.store.state;
		const b = this.bary;
		let html = '';
		if (s.mode === 'step') {
			const [t, d] = STEPS[s.step];
			html += `<b>${s.step + 1}/${STEPS.length} · ${t}</b><br>${d}<br>`;
		}
		if (vis.bary || vis.interp) html += `<span class="k">α β γ</span> ${fmt(b[0], 3)} · ${fmt(b[1], 3)} · ${fmt(b[2], 3)}<br>`;
		if (vis.interp) {
			html += `<span class="k">u</span> = ${fmt(b[0], 2)}·${fmt(this.uv[0][0])} + ${fmt(b[1], 2)}·${fmt(this.uv[1][0])} + ${fmt(b[2], 2)}·${fmt(this.uv[2][0])} = <b>${fmt(this.Puv[0], 3)}</b><br>`;
			html += `<span class="k">v</span> = ${fmt(b[0], 2)}·${fmt(this.uv[0][1])} + ${fmt(b[1], 2)}·${fmt(this.uv[1][1])} + ${fmt(b[2], 2)}·${fmt(this.uv[2][1])} = <b>${fmt(this.Puv[1], 3)}</b><br>`;
		}
		if (vis.texels) {
			html += `<span class="k">Sampler ${s.filter === 'nearest' ? 'Nearest' : 'Linear'}:</span> ${this.samp.texels.length} texel${this.samp.texels.length > 1 ? 's' : ''}<br>`;
			if (s.filter === 'linear') html += this.samp.texels.map((t) => `(${t.i},${t.j}) ${fmt(t.w, 2)}`).join(' · ') + '<br>';
			else html += `texel (${this.samp.texels[0].i}, ${this.samp.texels[0].j})<br>`;
		}
		if (vis.color) html += `<span class="sw" style="background:${rgbCss(this.samp.rgb)}"></span>rgb(${this.samp.rgb.join(', ')})`;
		if (html !== this._html) {
			this.read.innerHTML = html;
			this._html = html;
		}
	}

	drawUVExtra(ctx, v) {
		const s = this.store.state;
		const vis = this.vis();
		const n = this.texSize();
		drawTexelGrid(ctx, v, n, 'rgba(255,255,255,0.22)');
		if (vis.texels && this.samp) {
			for (const t of this.samp.texels) {
				fillTexel(ctx, v, n, t.i, t.j, `rgba(255,216,77,${s.filter === 'linear' ? 0.15 + 0.5 * t.w : 0.5})`, '#ffd84d');
			}
		}
		if (vis.bary) {
			const P = this.Puv;
			const tris = [
				[P, this.uv[1], this.uv[2]],
				[this.uv[0], P, this.uv[2]],
				[this.uv[0], this.uv[1], P],
			];
			tris.forEach((t, i) => {
				pathTriangle(ctx, v, t);
				const c = hexToRgb(VCOL[i]);
				ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.4)`;
				ctx.fill();
			});
		}
	}

	drawUVOverlay(ctx, v) {
		const vis = this.vis();
		if (!vis.pp) return;
		const [px, py] = v.toPx(this.Puv[0], this.Puv[1]);
		if (vis.lines)
			this.uv.forEach((q, i) => drawLine(ctx, [px, py], v.toPx(q[0], q[1]), VCOL[i], 1.5, [5, 4]));
		drawHandle(ctx, px, py, '#ffd84d', 'P′', { r: 10, textColor: '#000' });
		drawTag(ctx, `P′ (${fmt(this.Puv[0], 3)}, ${fmt(this.Puv[1], 3)})`, Math.min(v.w - 170, px + 14), Math.max(2, py - 30), { color: '#ffd84d' });
	}
}
