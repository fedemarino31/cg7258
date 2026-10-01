import * as THREE from 'three';
import { Lab, onClick } from '../../shared/Lab.js';
import { Scene3DView } from '../../shared/Scene3DView.js';
import { TextureSpaceView } from '../../shared/TextureSpaceView.js';
import { ControlPanel } from '../../layout/ControlPanel.js';
import { createStore } from '../../app/AppState.js';
import { TEXTURE_KINDS, getTextureData } from '../../shared/textures.js';
import { drawRuler, drawUnitSquare, drawTexelGrid, drawTag, fmt } from '../../shared/uvDraw.js';
import { buildMesh, MESH_KINDS } from './meshes.js';

const SELECTION_VS_DECL = 'attribute float aSel; varying float vSel;';

function patchSelection(mat, uniforms) {
	mat.onBeforeCompile = (shader) => {
		shader.uniforms.uHasSel = uniforms.uHasSel;
		shader.vertexShader = shader.vertexShader
			.replace('#include <common>', '#include <common>\n' + SELECTION_VS_DECL)
			.replace('#include <begin_vertex>', '#include <begin_vertex>\n vSel = aSel;');
		shader.fragmentShader = shader.fragmentShader
			.replace('#include <common>', '#include <common>\nuniform float uHasSel; varying float vSel;')
			.replace(
				'#include <dithering_fragment>',
				`#include <dithering_fragment>
				if (uHasSel > 0.5) {
					vec3 c = gl_FragColor.rgb;
					vec3 dim = mix(vec3(dot(c, vec3(0.333))), c, 0.5) * 0.55;
					vec3 hi = mix(c, vec3(1.0, 0.85, 0.2), 0.32);
					gl_FragColor.rgb = mix(dim, hi, vSel);
				}`
			);
	};
	return mat;
}

export class FullMeshUVLab extends Lab {
	static leftTitle = 'Escena 3D · malla';
	static centerTitle = 'Espacio de textura · UV map completo';
	static help = [
		'Clic sobre la malla 3D: se selecciona un triángulo (o su isla completa) y se resalta también en el UV map.',
		'Clic sobre un triángulo del UV map: se resalta en la malla 3D.',
		'Las líneas naranjas son costuras: allí la superficie continua se corta en el UV map.',
		'"Colorear islas" y "Mostrar densidad de texels" son visualizaciones alternativas (azul: pocos texels, rojo: muchos).',
	];

	constructor(layout) {
		super();
		this.store = createStore({
			mesh: 'cube',
			texture: 'grid',
			selMode: 'tri',
			wire: false,
			seams: true,
			islands: false,
			density: false,
			sel: null,
		});
		this.hasSel = { uHasSel: { value: 0 } };

		this.view3d = new Scene3DView(layout.left, {
			position: [3.4, 2.6, 4.6],
			minDistance: 2.5,
			maxDistance: 12,
			onInvalidate: this.invalidate,
			tag: 'Clic: seleccionar · Arrastrar: orbitar',
		});
		const sc = this.view3d.scene;
		sc.add(new THREE.AmbientLight(0xffffff, 1.1));
		const dl = new THREE.DirectionalLight(0xffffff, 2);
		dl.position.set(3, 5, 4);
		sc.add(dl);
		const grid = new THREE.GridHelper(8, 16, 0x3a4150, 0x262b35);
		grid.position.y = -1.7;
		sc.add(grid);

		this.uvView = new TextureSpaceView(layout.center, {
			center: [0.5, 0.5],
			extent: 1.25,
			onInvalidate: this.invalidate,
			tag: 'Clic: seleccionar triángulo · Rueda: zoom · Botón derecho: paneo',
		});
		this.uvView.drawFn = (ctx, v) => this.drawUV(ctx, v);
		this.uvView.cursor = 'pointer';

		this.bindEvents();
		this.buildControls(layout.controls);
		this.applyState({ mesh: true, texture: true });
		this.store.subscribe((s, patch) => this.applyState(patch));
	}

	// ---------- geometría ----------
	buildScene() {
		const sc = this.view3d.scene;
		for (const o of [this.mesh, this.wireMesh, this.seamLines, this.selLines]) {
			if (o) {
				sc.remove(o);
				o.geometry.dispose();
				if (o !== this.mesh) o.material.dispose();
			}
		}
		const m = (this.m = buildMesh(this.store.state.mesh));
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
		g.setAttribute('normal', new THREE.BufferAttribute(m.nor, 3));
		g.setAttribute('uv', new THREE.BufferAttribute(m.uv, 2));
		g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(m.colIsland), 3));
		g.setAttribute('aSel', new THREE.BufferAttribute(new Float32Array(m.T * 3), 1));
		this.mesh = new THREE.Mesh(g, this.matTex);
		sc.add(this.mesh);
		this.wireMesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.3 }));
		sc.add(this.wireMesh);

		const seamPts = [];
		const off = (t, k) => {
			const p = m.vp(t, k);
			const n = new THREE.Vector3(m.nor[(t * 3 + k) * 3], m.nor[(t * 3 + k) * 3 + 1], m.nor[(t * 3 + k) * 3 + 2]);
			return p.addScaledVector(n, 0.012);
		};
		for (const { t, e } of m.seams) seamPts.push(off(t, e), off(t, (e + 1) % 3));
		this.seamLines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seamPts), new THREE.LineBasicMaterial({ color: 0xff8a2a }));
		sc.add(this.seamLines);
		this.selLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffd84d }));
		sc.add(this.selLines);
		this.off = off;
	}

	ensureMaterials() {
		if (this.matTex) return;
		const common = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };
		this.matTex = patchSelection(new THREE.MeshLambertMaterial({ ...common }), this.hasSel);
		this.matColor = patchSelection(new THREE.MeshLambertMaterial({ vertexColors: true, ...common }), this.hasSel);
		this.own(this.matTex);
		this.own(this.matColor);
	}

	selTris() {
		const s = this.store.state;
		if (s.sel == null) return [];
		if (s.selMode === 'island') return this.m.trisOfIsland(this.m.island[s.sel]);
		return [s.sel];
	}

	updateSelection() {
		const tris = this.selTris();
		const a = this.mesh.geometry.attributes.aSel;
		a.array.fill(0);
		for (const t of tris) a.array.fill(1, t * 3, t * 3 + 3);
		a.needsUpdate = true;
		this.hasSel.uHasSel.value = tris.length ? 1 : 0;
		const pts = [];
		for (const t of tris)
			for (let e = 0; e < 3; e++) pts.push(this.off(t, e), this.off(t, (e + 1) % 3));
		this.selLines.geometry.setFromPoints(pts);
		this._selSet = new Set(tris);
		this.invalidate();
	}

	// ---------- interacción ----------
	bindEvents() {
		onClick(this, this.view3d.dom, (e) => {
			const hit = this.view3d.raycast(e, [this.mesh])[0];
			this.store.set({ sel: hit ? hit.faceIndex : null });
		});
		const h = this.uvView.handlers;
		h.down = (uv) => {
			const t = this.triAtUV(uv);
			if (t != null) this.store.set({ sel: t });
			return t != null;
		};
		h.cursorAt = (uv) => (this.triAtUV(uv) != null ? 'pointer' : 'default');
	}

	triAtUV(uv) {
		const m = this.m;
		const tri = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
		const q = new THREE.Vector3(uv[0], uv[1], 0);
		const w = new THREE.Vector3();
		for (let t = 0; t < m.T; t++) {
			for (let k = 0; k < 3; k++) tri[k].set(m.uv[(t * 3 + k) * 2], m.uv[(t * 3 + k) * 2 + 1], 0);
			if (THREE.Triangle.getBarycoord(q, tri[0], tri[1], tri[2], w) && w.x >= 0 && w.y >= 0 && w.z >= 0) return t;
		}
		return null;
	}

	buildControls(el) {
		const p = (this.panel = new ControlPanel(el, this.store));
		p.idea('El UV map de una malla está formado por sus triángulos desplegados. Las costuras permiten separar la superficie en islas, pero pueden introducir discontinuidades visibles.');
		p.select('mesh', 'Malla', MESH_KINDS);
		p.select('texture', 'Textura', TEXTURE_KINDS);
		p.segmented('selMode', 'Modo de selección', [
			{ value: 'tri', label: 'Triángulo' },
			{ value: 'island', label: 'Isla' },
		]);
		p.title('Visualización');
		p.checkbox('wire', 'Mostrar wireframe');
		p.checkbox('seams', 'Mostrar costuras');
		p.checkbox('islands', 'Colorear islas');
		p.checkbox('density', 'Mostrar densidad de texels');
		p.buttons({ label: 'Limpiar selección', onClick: () => this.store.set({ sel: null }) });
		this.read = p.readout();
	}

	applyState(patch = {}) {
		const s = this.store.state;
		this.ensureMaterials();
		if (patch.mesh) {
			this.store.state.sel = null;
			this.buildScene();
			this.updateSelection();
		}
		if (patch.texture) {
			this.tex3?.dispose();
			this.tex3 = getTextureData(s.texture, 256).toThree('clamp');
			this.matTex.map = this.tex3;
			this.matTex.needsUpdate = true;
		}
		if ('islands' in patch && s.islands && s.density) return this.store.set({ density: false });
		if ('density' in patch && s.density && s.islands) return this.store.set({ islands: false });
		const colored = s.islands || s.density;
		this.mesh.material = colored ? this.matColor : this.matTex;
		if (colored) {
			const attr = this.mesh.geometry.attributes.color;
			attr.array.set(s.density ? this.m.colDens : this.m.colIsland);
			attr.needsUpdate = true;
		}
		if ('sel' in patch || 'selMode' in patch) this.updateSelection();
		this.wireMesh.visible = s.wire;
		this.seamLines.visible = s.seams;
		this.invalidate();
	}

	// ---------- dibujo UV ----------
	drawUV(ctx, v) {
		const s = this.store.state;
		const m = this.m;
		const tex = getTextureData(s.texture, 256);
		const [x, y] = v.toPx(0, 1);
		ctx.imageSmoothingEnabled = v.scale / 256 < 2.5;
		ctx.globalAlpha = s.islands || s.density ? 0.35 : 0.9;
		ctx.drawImage(tex.canvas, x, y, v.scale, v.scale);
		ctx.globalAlpha = 1;
		drawUnitSquare(ctx, v, 'rgba(255,255,255,0.6)');
		if (s.density) drawTexelGrid(ctx, v, 32, 'rgba(255,255,255,0.35)') || this.drawDensityGrid(ctx, v);

		const sel = this._selSet || new Set();
		const hasSel = sel.size > 0;
		const path = (t) => {
			ctx.beginPath();
			for (let k = 0; k < 3; k++) {
				const [px, py] = v.toPx(m.uv[(t * 3 + k) * 2], m.uv[(t * 3 + k) * 2 + 1]);
				if (k) ctx.lineTo(px, py);
				else ctx.moveTo(px, py);
			}
			ctx.closePath();
		};
		for (let t = 0; t < m.T; t++) {
			path(t);
			if (s.islands || s.density) {
				const c = (s.density ? m.colDens : m.colIsland).subarray(t * 9, t * 9 + 3);
				ctx.fillStyle = `rgba(${(c[0] * 255) | 0},${(c[1] * 255) | 0},${(c[2] * 255) | 0},${hasSel && !sel.has(t) ? 0.35 : 0.7})`;
				ctx.fill();
			} else if (hasSel && !sel.has(t)) {
				ctx.fillStyle = 'rgba(8,10,14,0.45)';
				ctx.fill();
			}
			ctx.strokeStyle = 'rgba(255,255,255,0.35)';
			ctx.lineWidth = 1;
			ctx.stroke();
		}
		for (const t of sel) {
			path(t);
			ctx.fillStyle = 'rgba(255,216,77,0.45)';
			ctx.fill();
			ctx.strokeStyle = '#ffd84d';
			ctx.lineWidth = 2;
			ctx.stroke();
		}
		if (s.seams) {
			ctx.strokeStyle = '#ff8a2a';
			ctx.lineWidth = 2;
			ctx.beginPath();
			for (const { t, e } of m.seams) {
				const a = v.toPx(m.uv[(t * 3 + e) * 2], m.uv[(t * 3 + e) * 2 + 1]);
				const k = (e + 1) % 3;
				const b = v.toPx(m.uv[(t * 3 + k) * 2], m.uv[(t * 3 + k) * 2 + 1]);
				ctx.moveTo(a[0], a[1]);
				ctx.lineTo(b[0], b[1]);
			}
			ctx.stroke();
		}
		if (m.islandNames.length > 1) {
			m.islandCentroids.forEach((c, i) => {
				const [px, py] = v.toPx(c[0], c[1]);
				drawTag(ctx, `${i + 1} · ${m.islandNames[i]}`, px - 24, py - 8, { color: '#fff' });
			});
		}
		drawRuler(ctx, v);
		if (s.density) drawTag(ctx, ['Densidad relativa de texels', 'azul: menos · rojo: más'], v.w - 8, v.h - 56, { align: 'right', color: '#cfd5e0' });
	}

	drawDensityGrid(ctx, v) {
		// a poca escala igualmente mostramos una cuadrícula 16×16 de referencia
		ctx.save();
		ctx.strokeStyle = 'rgba(255,255,255,0.25)';
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (let i = 0; i <= 16; i++) {
			const a = v.toPx(i / 16, 0),
				b = v.toPx(i / 16, 1),
				c = v.toPx(0, i / 16),
				d = v.toPx(1, i / 16);
			ctx.moveTo(a[0], a[1]);
			ctx.lineTo(b[0], b[1]);
			ctx.moveTo(c[0], c[1]);
			ctx.lineTo(d[0], d[1]);
		}
		ctx.stroke();
		ctx.restore();
	}

	render() {
		this.view3d.render();
		this.uvView.render();
		this.updateReadout();
	}

	updateReadout() {
		const s = this.store.state;
		const m = this.m;
		let html;
		if (s.sel == null) html = '<span class="k">Hacé clic en la malla o en el UV map para seleccionar.</span>';
		else {
			const isl = m.island[s.sel];
			const n = s.selMode === 'island' ? m.trisOfIsland(isl).length : 1;
			html = `<span class="k">Triángulo</span> #${s.sel}<br>
				<span class="k">Isla</span> ${isl + 1} · ${m.islandNames[isl]}${s.selMode === 'island' ? ` (${n} tri.)` : ''}<br>
				<span class="k">Área 3D</span> ${fmt(m.area3[s.sel], 3)}<br>
				<span class="k">Área UV</span> ${fmt(m.areaUV[s.sel], 4)}<br>
				<span class="k">Densidad relativa</span> ${fmt(m.rel[s.sel], 2)}×`;
		}
		html += `<br><span class="k">${m.T} triángulos · ${m.islandNames.length} isla${m.islandNames.length > 1 ? 's' : ''}</span>`;
		if (html !== this._html) {
			this.read.innerHTML = html;
			this._html = html;
		}
	}

	dispose() {
		super.dispose();
		this.view3d.dispose();
		this.uvView.dispose();
		this.panel.dispose();
		this.tex3?.dispose();
	}
}
