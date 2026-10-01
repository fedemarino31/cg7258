import * as THREE from 'three';
import { Lab, onClick } from '../../shared/Lab.js';
import { Scene3DView } from '../../shared/Scene3DView.js';
import { TextureSpaceView } from '../../shared/TextureSpaceView.js';
import { ControlPanel } from '../../layout/ControlPanel.js';
import { createStore } from '../../app/AppState.js';
import { drawRuler, drawTag, drawHandle } from '../../shared/uvDraw.js';
import { CanvasView } from '../sampling/CanvasView.js';
import { FloorModel, FLOOR, FLOOR_TEXTURES, TILE, TEX_SIZE, MAX_LEVEL, buildMips, levelBytes, shade } from './floor.js';
import { createFrustumMesh, createMovieCamera, placeMovieCamera, createLabelSprite, disposeLabelSprite, fitLabelToScreen } from '../../shared/cameraRig.js';

const YELLOW = '#ffd84d';
const RES = [
	{ value: '24x18', label: '24 × 18', cols: 24, rows: 18 },
	{ value: '48x36', label: '48 × 36', cols: 48, rows: 36 },
	{ value: '96x72', label: '96 × 72', cols: 96, rows: 72 },
	{ value: '160x120', label: '160 × 120', cols: 160, rows: 120 },
	{ value: '240x180', label: '240 × 180', cols: 240, rows: 180 },
];
const PANES = [
	{ value: 'viewport', label: 'Viewport' },
	{ value: 'scene', label: 'Escena 3D' },
	{ value: 'uv', label: 'Espacio UV' },
];
const IMG_KEYS = ['res', 'height', 'pitch', 'advance', 'texture', 'filter', 'mip', 'aniso', 'lodMode', 'lod'];
const DEFAULTS = {
	res: '160x120',
	height: 1.6,
	pitch: 12,
	advance: 0,
	texture: 'checker',
	filter: 'nearest',
	mip: false,
	aniso: '1',
	lodMode: 'auto',
	lod: 0,
	sel: [0.5, 0.36],
	footprint: true,
	showMip: true,
	camera: true,
	animate: false,
	view: 'viewport',
};

const hsl = (h, s, l) => {
	const k = (n) => (n + h / 30) % 12;
	const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
	const f = (n) => l / 100 - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
	return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
};
const levelColor = (l) => hsl(((l * 47) % 360) + 200, 85, 55);
const num = (x) => (x < 10 ? x.toFixed(1) : Math.round(x).toString());

class AliasingLab extends Lab {
	// `tab` 1 = Aliasing (sin mipmaps), 2 = Mipmaps y anisotropía.
	constructor(layout, tab, defaults) {
		super();
		this.tab = tab;
		this.defaults = { ...DEFAULTS, ...defaults };
		this.store = createStore({ ...this.defaults });
		this.model = new FloorModel();
		this.phase = 0;
		this.vpBuf = document.createElement('canvas');
		this.tintBuf = document.createElement('canvas');
		this.textures = {};
		for (const t of FLOOR_TEXTURES) {
			const canvas = t.make();
			this.textures[t.value] = { canvas, levels: buildMips(canvas), thumbs: new Map(), gpu: null, gpuLevels: new Map() };
		}

		const stack = layout.views[0];
		const nav = document.createElement('div');
		nav.className = 'subnav';
		this.navBtns = PANES.map((pn) => {
			const b = document.createElement('button');
			b.className = 'btn';
			b.textContent = pn.label;
			b.addEventListener('click', () => this.store.set({ view: pn.value }));
			nav.appendChild(b);
			return [pn.value, b];
		});
		stack.appendChild(nav);
		this.panes = {};
		for (const pn of PANES) {
			const d = document.createElement('div');
			d.className = 'view';
			stack.appendChild(d);
			this.panes[pn.value] = d;
		}
		this.initViewport(this.panes.viewport);
		this.initScene(this.panes.scene);
		this.initUV(this.panes.uv);
		this.maxAniso = Math.min(16, this.view3d.renderer.capabilities.getMaxAnisotropy() || 1);

		this.buildControls(layout.controls);
		this.applyState();
		this.store.subscribe((s, patch) => this.applyState(patch));
	}

	get res() {
		return RES.find((r) => r.value === this.store.state.res) || RES[1];
	}

	get selPixel() {
		const { cols, rows } = this.res;
		const [fx, fy] = this.store.state.sel;
		return [Math.min(cols - 1, Math.floor(fx * cols)), Math.min(rows - 1, Math.floor(fy * rows))];
	}

	get anisoValue() {
		const a = this.store.state.aniso;
		return a === 'max' ? this.maxAniso : Math.min(+a, this.maxAniso);
	}

	get params() {
		const s = this.store.state;
		return {
			mip: s.mip,
			linear: s.filter === 'linear',
			aniso: s.mip ? this.anisoValue : 1,
			forced: s.mip && s.lodMode === 'forced' ? s.lod : null,
		};
	}

	// ---------- vistas ----------
	initViewport(container) {
		this.vpView = new CanvasView(container, { onInvalidate: this.invalidate, tag: 'Clic o arrastre: elegir píxel' });
		this.vpView.drawFn = (ctx, v) => this.drawViewport(ctx, v);
		const c = this.vpView.canvas;
		c.style.cursor = 'crosshair';
		const pick = (e) => {
			const g = this.gridRect();
			const [x, y] = this.vpView.pos(e);
			const i = Math.floor((x - g.x0) / g.scale);
			const j = Math.floor((y - g.y0) / g.scale);
			if (i < 0 || j < 0 || i >= g.cols || j >= g.rows) return;
			this.store.set({ sel: [(i + 0.5) / g.cols, (j + 0.5) / g.rows] });
		};
		let drag = false;
		this.listen(c, 'pointerdown', (e) => {
			if (e.button !== 0) return;
			drag = true;
			c.setPointerCapture(e.pointerId);
			pick(e);
		});
		this.listen(c, 'pointermove', (e) => drag && pick(e));
		this.listen(c, 'pointerup', () => (drag = false));
	}

	initScene(container) {
		const view = (this.view3d = new Scene3DView(container, {
			background: 0x8fcbef,
			position: [8, 5, 10],
			target: [0, 0, -10],
			minDistance: 3,
			maxDistance: 160,
			panLimit: 60,
			onInvalidate: this.invalidate,
			tag: 'Arrastrar: orbitar · Rueda: zoom · Clic: elegir píxel',
		}));
		const scene = view.scene;
		const zLen = FLOOR.zNear - FLOOR.zFar;
		this.repeat = [(2 * FLOOR.halfW) / TILE, zLen / TILE];
		const geo = new THREE.PlaneGeometry(2 * FLOOR.halfW, zLen);
		geo.rotateX(-Math.PI / 2);
		geo.translate(0, 0, (FLOOR.zNear + FLOOR.zFar) / 2);
		for (const t of Object.values(this.textures)) {
			const tex = new THREE.CanvasTexture(t.canvas);
			tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
			tex.repeat.set(...this.repeat);
			tex.colorSpace = THREE.SRGBColorSpace;
			t.gpu = tex;
		}
		this.floorMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: this.textures.checker.gpu }));
		scene.add(this.floorMesh);

		const quad = () => {
			const g = new THREE.BufferGeometry();
			g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
			return g;
		};
		const overlay = { depthTest: false, transparent: true };
		const fillGeo = quad();
		fillGeo.setIndex([0, 1, 2, 0, 2, 3]);
		this.fpFill = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({ ...overlay, color: YELLOW, opacity: 0.7, side: THREE.DoubleSide }));
		this.fpLine = new THREE.LineLoop(quad(), new THREE.LineBasicMaterial({ ...overlay, color: YELLOW }));
		this.fpDot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial({ ...overlay, color: YELLOW }));
		const eg = new THREE.BufferGeometry();
		eg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(24), 3));
		this.eyeLines = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ ...overlay, color: YELLOW, opacity: 0.5 }));
		for (const o of [this.fpFill, this.fpLine, this.fpDot, this.eyeLines]) {
			o.renderOrder = 5;
			o.frustumCulled = false;
			scene.add(o);
		}
		scene.add(new THREE.AmbientLight(0xffffff, 0.55));
		const dl = new THREE.DirectionalLight(0xffffff, 1.4);
		dl.position.set(6, 10, 6);
		scene.add(dl);

		this.frustum = createFrustumMesh(0.017, 0xffffff);
		this.camBody = createMovieCamera();
		scene.add(this.frustum.group, this.camBody);

		this.camLabel = createLabelSprite('Cámara', '#56c8ff');
		this.fpLabel = createLabelSprite('Huella del píxel', YELLOW);
		scene.add(this.camLabel, this.fpLabel);

		onClick(this, view.dom, (e) => {
			const hit = view.raycast(e, [this.floorMesh])[0];
			if (!hit) return;
			const [fx, fy] = this.model.pixelOfWorld(hit.point);
			if (fx < 0 || fx >= 1 || fy < 0 || fy >= 1) return;
			this.store.set({ sel: [fx, fy] });
		});
	}

	initUV(container) {
		this.uvView = new TextureSpaceView(container, {
			center: [0.5, 0.5],
			extent: 1.3,
			onInvalidate: this.invalidate,
			tag: 'Rueda: zoom · Botón derecho: paneo · unidades = repeticiones de la textura',
		});
		this.uvView.drawFn = (ctx, v) => this.drawUV(ctx, v);
	}

	// ---------- controles ----------
	buildControls(el) {
		const p = (this.panel = new ControlPanel(el, this.store));
		const tex = FLOOR_TEXTURES.map(({ value, label }) => ({ value, label }));
		const near = () => this.store.set({ sel: [0.5, this.model.pickRow('near')] });
		const far = () => this.store.set({ sel: [0.5, this.model.pickRow('far')] });
		const camera = () => {
			p.title('Cámara');
			p.slider('height', 'Altura de la cámara', { min: 0.6, max: 6, step: 0.1, digits: 1 });
			p.slider('pitch', 'Inclinación de la vista (°)', { min: 0, max: 35, step: 1, digits: 0 });
			p.slider('advance', 'Avance de la cámara', { min: 0, max: 30, step: 0.25, digits: 2 });
			p.checkbox('animate', 'Animar avance');
		};
		const filter = () =>
			p.segmented('filter', 'Filtro', [
				{ value: 'nearest', label: 'Nearest' },
				{ value: 'linear', label: 'Linear' },
			]);
		const scene = () => {
			p.select('texture', 'Textura', tex);
			p.select('res', 'Resolución del viewport', RES.map(({ value, label }) => ({ value, label })));
			p.buttons({ label: 'Píxel cercano', onClick: near }, { label: 'Píxel lejano', onClick: far });
		};
		if (this.tab === 1) {
			p.idea('El aliasing aparece cuando un píxel representa más detalle de la textura del que el muestreo puede representar correctamente. Comparé un píxel cercano con uno lejano y movés la cámara.');
			p.title('Muestreo');
			filter();
			scene();
			camera();
			p.title('Visualización');
		} else {
			p.idea('Los mipmaps reducen el aliasing usando versiones de menor resolución cuando la huella del píxel es grande. La anisotropía mejora el muestreo cuando esa huella del píxel es muy alargada.');
			p.title('Mipmaps y anisotropía');
			p.segmented('mip', 'Mipmaps', [
				{ value: false, label: 'Sin mipmaps' },
				{ value: true, label: 'Con mipmaps' },
			]);
			p.select('aniso', 'Anisotropía (requiere mipmaps)', [
				{ value: '1', label: '1×' },
				{ value: '2', label: '2×' },
				{ value: '4', label: '4×' },
				{ value: '8', label: '8×' },
				{ value: 'max', label: `Máximo disponible (${this.maxAniso}×)` },
			]);
			filter();
			p.segmented('lodMode', 'Nivel MIP', [
				{ value: 'auto', label: 'Automático' },
				{ value: 'forced', label: 'Forzado' },
			]);
			p.slider('lod', 'Nivel forzado', { min: 0, max: MAX_LEVEL, step: 1, digits: 0 });
			scene();
			camera();
			p.title('Visualización');
			p.checkbox('showMip', 'Mostrar nivel MIP');
		}
		p.checkbox('footprint', 'Mostrar huella del píxel');
		p.checkbox('camera', 'Mostrar cámara (escena 3D)');
		p.buttons({ label: 'Restablecer vista', onClick: () => this.resetAll() });
		this.readout = p.readout();
	}

	resetAll() {
		this.phase = 0;
		this.store.set({ ...this.defaults });
		this.view3d.resetCamera();
		this.focusUV();
	}

	// ---------- estado ----------
	applyState(patch) {
		const imageChanged = !patch || IMG_KEYS.some((k) => k in patch);
		if (imageChanged) this.recomputeImage();
		if (imageChanged || 'sel' in patch) this.recomputeSel(patch);
		this.update3D();
		const s = this.store.state;
		this.animating = s.animate;
		for (const [k, el] of Object.entries(this.panes)) el.classList.toggle('hidden', k !== s.view);
		this.navBtns.forEach(([k, b]) => b.classList.toggle('on', k === s.view));
		this.invalidate();
	}

	update(dt) {
		this.phase += dt;
		this.store.set({ advance: 12 * (1 - Math.cos(this.phase * 0.9)) });
	}

	recomputeImage() {
		const s = this.store.state;
		const { cols, rows } = this.res;
		this.model.setup({ height: s.height, pitch: s.pitch, advance: s.advance, cols, rows });
		const { rgba, lod } = this.model.render(this.textures[s.texture].levels, this.params);
		this.lodMap = lod;
		for (const b of [this.vpBuf, this.tintBuf]) (b.width = cols), (b.height = rows);
		this.vpBuf.getContext('2d').putImageData(new ImageData(rgba, cols, rows), 0, 0);
		if (this.tab === 2 && s.mip) {
			const tint = new Uint8ClampedArray(cols * rows * 4);
			lod.forEach((l, k) => {
				if (Number.isNaN(l)) return;
				tint.set([...levelColor(Math.round(l)), 90], k * 4);
			});
			this.tintBuf.getContext('2d').putImageData(new ImageData(tint, cols, rows), 0, 0);
		}
	}

	recomputeSel(patch) {
		const s = this.store.state;
		const [i, j] = this.selPixel;
		const fp = (this.fp = this.model.footprint(i, j));
		this.info = null;
		if (fp.valid) {
			const { u, v } = fp.center;
			const d = fp.d;
			this.info = shade(this.textures[s.texture].levels, this.params, u, v, d.dudx, d.dvdx, d.dudy, d.dvdy);
		}
		this.updateReadout();
		if (!patch || 'sel' in patch || IMG_KEYS.some((k) => k in patch)) this.focusUV();
	}

	focusUV() {
		const fp = this.fp;
		if (!fp?.valid) {
			this.uvView.home = { center: [0.5, 0.5], extent: 1.3 };
		} else {
			const us = fp.corners.map((c) => c.u);
			const vs = fp.corners.map((c) => c.v);
			const size = Math.max(Math.max(...us) - Math.min(...us), Math.max(...vs) - Math.min(...vs));
			this.uvView.home = { center: [fp.center.u, fp.center.v], extent: Math.min(30, Math.max(16 / TEX_SIZE, 4 * size)) };
		}
		this.uvView.resetView();
	}

	updateReadout() {
		const [i, j] = this.selPixel;
		const fp = this.fp;
		if (!fp.valid) {
			this.readout.innerHTML = `<span class="k">Píxel</span> <code>(${i}, ${j})</code><br><span class="k">No ve el piso completo: elegí otro.</span>`;
			return;
		}
		const r = this.info;
		let html = `<span class="k">Píxel</span> <code>(${i}, ${j})</code> <span class="k">a</span> <code>${num(fp.center.t)} u</code><br>
			<span class="k">Huella del píxel en la textura</span><br><code>${num(r.major)} × ${num(r.minor)} texels</code><br>
			<span class="k">Alargamiento</span> <code>${num(r.major / r.minor)} : 1</code>`;
		if (this.tab === 2) {
			const p = this.params;
			html += `<br><span class="k">Nivel MIP</span> <code>${p.mip ? r.lod.toFixed(2) : '0 (sin mipmaps)'}</code>`;
			html += `<br><span class="k">Muestras anisotrópicas</span> <code>${p.mip ? r.samples : 1}</code>`;
		}
		this.readout.innerHTML = html;
	}

	// ---------- GPU (vista 3D) ----------
	levelTexture(key, l, linear) {
		const t = this.textures[key];
		const id = `${l}:${linear}`;
		let tex = t.gpuLevels.get(id);
		if (!tex) {
			const lv = t.levels[l];
			tex = new THREE.DataTexture(levelBytes(lv), lv.size, lv.size, THREE.RGBAFormat);
			tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
			tex.repeat.set(...this.repeat);
			tex.colorSpace = THREE.SRGBColorSpace;
			tex.generateMipmaps = false;
			tex.magFilter = tex.minFilter = linear ? THREE.LinearFilter : THREE.NearestFilter;
			tex.needsUpdate = true;
			t.gpuLevels.set(id, tex);
		}
		return tex;
	}

	// La vista "Escena 3D" no es donde se enseña el aliasing (para eso están el viewport y el
	// espacio UV, que sí respetan mip/aniso/filtro elegidos); acá el piso solo sirve de referencia
	// para ubicar cámara, huella del píxel y frustum, así que siempre usa el mejor filtrado disponible.
	updateGPUTexture() {
		const s = this.store.state;
		const linear = s.filter === 'linear';
		if (s.mip && s.lodMode === 'forced') {
			this.floorMesh.material.map = this.levelTexture(s.texture, s.lod, linear);
			return;
		}
		const tex = this.textures[s.texture].gpu;
		const min = linear ? THREE.LinearMipmapLinearFilter : THREE.NearestMipmapLinearFilter;
		const mag = linear ? THREE.LinearFilter : THREE.NearestFilter;
		const aniso = this.maxAniso;
		if (tex.minFilter !== min || tex.magFilter !== mag || tex.anisotropy !== aniso) {
			tex.minFilter = min;
			tex.magFilter = mag;
			tex.anisotropy = aniso;
			tex.needsUpdate = true;
		}
		this.floorMesh.material.map = tex;
	}

	update3D() {
		const s = this.store.state;
		const m = this.model;
		this.updateGPUTexture();
		m.camera.updateMatrixWorld(true);
		this.frustum.update(m.camera);
		placeMovieCamera(this.camBody, m.camera);
		this.camLabel.position.copy(m.camera.position);
		this.frustum.group.visible = this.camBody.visible = this.camLabel.visible = s.camera;
		const fp = this.fp;
		const show = s.footprint && !!fp?.valid;
		this.fpFill.visible = this.fpLine.visible = this.fpDot.visible = this.eyeLines.visible = show;
		if (show) {
			for (const g of [this.fpFill.geometry, this.fpLine.geometry]) {
				fp.corners.forEach((c, k) => g.attributes.position.setXYZ(k, c.x, 0.03, c.z));
				g.attributes.position.needsUpdate = true;
			}
			const ep = this.eyeLines.geometry.attributes.position;
			fp.corners.forEach((c, k) => {
				ep.setXYZ(2 * k, m.camera.position.x, m.camera.position.y, m.camera.position.z);
				ep.setXYZ(2 * k + 1, c.x, 0.03, c.z);
			});
			ep.needsUpdate = true;
			this.fpDot.position.set(fp.center.x, 0.06, fp.center.z);
			this.centerWorld = this.fpDot.position;
			this.fpLabel.position.set(fp.center.x, 0.06, fp.center.z);
		}
		this.fpLabel.visible = show;
	}

	// ---------- dibujo: viewport ----------
	gridRect() {
		const { cols, rows } = this.res;
		const { w, h } = this.vpView;
		const scale = Math.max(1, Math.min((w - 16) / cols, (h - 40) / rows));
		return { x0: (w - scale * cols) / 2, y0: 30 + (h - 30 - scale * rows) / 2, scale, cols, rows };
	}

	drawViewport(ctx) {
		const s = this.store.state;
		const { x0, y0, scale, cols, rows } = this.gridRect();
		ctx.imageSmoothingEnabled = false;
		ctx.drawImage(this.vpBuf, x0, y0, cols * scale, rows * scale);
		const tinted = this.tab === 2 && s.mip && s.showMip;
		if (tinted) ctx.drawImage(this.tintBuf, x0, y0, cols * scale, rows * scale);
		ctx.strokeStyle = '#56c8ff';
		ctx.lineWidth = 1.5;
		ctx.strokeRect(x0, y0, cols * scale, rows * scale);
		const [pi, pj] = this.selPixel;
		const r = Math.max(scale, 8);
		const cx = x0 + (pi + 0.5) * scale;
		const cy = y0 + (pj + 0.5) * scale;
		ctx.strokeStyle = '#000';
		ctx.lineWidth = 4;
		ctx.strokeRect(cx - r / 2, cy - r / 2, r, r);
		ctx.strokeStyle = YELLOW;
		ctx.lineWidth = 2;
		ctx.strokeRect(cx - r / 2, cy - r / 2, r, r);
		drawTag(ctx, `${cols} × ${rows} píxeles · elegido (${pi}, ${pj})`, x0 + 4, y0 + 4, { color: YELLOW });
		if (tinted) {
			const lv = new Set();
			this.lodMap.forEach((l) => !Number.isNaN(l) && lv.add(Math.round(l)));
			let x = x0 + cols * scale - 6;
			for (const l of [...lv].sort((a, b) => b - a)) {
				x -= 54;
				ctx.fillStyle = `rgb(${levelColor(l).join(',')})`;
				ctx.fillRect(x, y0 + rows * scale - 22, 14, 14);
				ctx.fillStyle = '#fff';
				ctx.font = '11px sans-serif';
				ctx.textBaseline = 'middle';
				ctx.fillText(`MIP ${l}`, x + 17, y0 + rows * scale - 15);
			}
		}
	}

	// ---------- dibujo: espacio UV ----------
	drawUV(ctx, view) {
		const s = this.store.state;
		const tex = this.textures[s.texture];
		const { u0, u1, v0, v1 } = view.visibleRange();
		const i0 = Math.floor(u0);
		const i1 = Math.floor(u1);
		const j0 = Math.floor(v0);
		const j1 = Math.floor(v1);
		if ((i1 - i0 + 1) * (j1 - j0 + 1) <= 3000) {
			ctx.imageSmoothingEnabled = view.scale / TEX_SIZE < 1;
			for (let i = i0; i <= i1; i++)
				for (let j = j0; j <= j1; j++) {
					const [x, y] = view.toPx(i, j + 1);
					ctx.drawImage(tex.canvas, x, y, view.scale + 0.5, view.scale + 0.5);
				}
		} else {
			ctx.fillStyle = '#39404d';
			ctx.fillRect(0, 0, view.w, view.h);
		}
		const texel = view.scale / TEX_SIZE;
		ctx.strokeStyle = texel >= 6 ? 'rgba(255,90,90,0.35)' : 'rgba(255,255,255,0.3)';
		ctx.lineWidth = 1;
		ctx.beginPath();
		if (texel >= 6) {
			for (let i = Math.floor(u0 * TEX_SIZE); i <= u1 * TEX_SIZE; i++) {
				const x = view.toPx(i / TEX_SIZE, 0)[0];
				ctx.moveTo(x, 0);
				ctx.lineTo(x, view.h);
			}
			for (let j = Math.floor(v0 * TEX_SIZE); j <= v1 * TEX_SIZE; j++) {
				const y = view.toPx(0, j / TEX_SIZE)[1];
				ctx.moveTo(0, y);
				ctx.lineTo(view.w, y);
			}
		} else if (i1 - i0 + 1 <= 80) {
			for (let i = i0; i <= i1 + 1; i++) {
				const x = view.toPx(i, 0)[0];
				ctx.moveTo(x, 0);
				ctx.lineTo(x, view.h);
			}
			for (let j = j0; j <= j1 + 1; j++) {
				const y = view.toPx(0, j)[1];
				ctx.moveTo(0, y);
				ctx.lineTo(view.w, y);
			}
		}
		ctx.stroke();
		this.drawFootprintUV(ctx, view);
		if (this.tab === 2) this.drawPyramid(ctx, view);
		drawRuler(ctx, view);
	}

	drawFootprintUV(ctx, view) {
		const fp = this.fp;
		if (!fp?.valid) {
			drawTag(ctx, 'Este píxel no ve el piso completo', 34, 34, { color: '#ffbd70' });
			return;
		}
		const [cx, cy] = view.toPx(fp.center.u, fp.center.v);
		if (this.store.state.footprint) {
			const pts = fp.corners.map((c) => view.toPx(c.u, c.v));
			ctx.beginPath();
			pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
			ctx.closePath();
			ctx.fillStyle = 'rgba(255,216,77,0.3)';
			ctx.fill();
			ctx.strokeStyle = '#000';
			ctx.lineWidth = 4.5;
			ctx.stroke();
			ctx.strokeStyle = YELLOW;
			ctx.lineWidth = 2.5;
			ctx.stroke();
			drawHandle(ctx, cx, cy, YELLOW, '', { r: 3.5, ring: false });
			const top = pts.reduce((a, p) => (p[1] < a[1] ? p : a));
			const r = this.info;
			drawTag(ctx, [`huella del píxel ≈ ${num(r.major)} × ${num(r.minor)} texels`, `alargamiento ${num(r.major / r.minor)} : 1`], top[0] + 8, top[1] - 38, { color: YELLOW });
		}
	}

	// Columna lateral con los niveles MIP; el nivel en uso queda resaltado.
	drawPyramid(ctx, view) {
		const s = this.store.state;
		if (!s.showMip) return;
		const levels = this.textures[s.texture].levels;
		const r = this.info;
		const used = new Set([0]);
		let label = 'Sin mipmaps: siempre MIP 0';
		if (s.mip && r) {
			const l0 = Math.floor(r.lod);
			const f = r.lod - l0;
			if (s.filter === 'linear' && f > 0.02 && l0 < MAX_LEVEL) {
				used.clear();
				used.add(l0).add(l0 + 1);
				label = `Nivel seleccionado: MIP ${r.lod.toFixed(1)}`;
			} else {
				used.clear();
				used.add(Math.min(MAX_LEVEL, Math.round(r.lod)));
				label = `Nivel seleccionado: MIP ${[...used][0]}`;
			}
			if (s.lodMode === 'forced') label += ' (forzado)';
		}
		const th = Math.max(16, Math.min(34, (view.h - 120) / levels.length - 14));
		const x = view.w - th - 14;
		let y = 66;
		ctx.fillStyle = 'rgba(10,12,16,0.78)';
		ctx.fillRect(x - 100, 62, th + 114, y + levels.length * (th + 14) - 62 - 4);
		drawTag(ctx, label, view.w - 8, 38, { align: 'right', color: YELLOW });
		ctx.save();
		ctx.imageSmoothingEnabled = false;
		levels.forEach((lv, l) => {
			ctx.drawImage(this.levelThumb(s.texture, l), x, y, th, th);
			const on = used.has(l);
			ctx.strokeStyle = on ? YELLOW : 'rgba(255,255,255,0.35)';
			ctx.lineWidth = on ? 3 : 1;
			ctx.strokeRect(x, y, th, th);
			ctx.font = '11px sans-serif';
			ctx.textAlign = 'right';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = on ? YELLOW : '#cfd5e0';
			ctx.fillText(`MIP ${l} · ${lv.size}²`, x - 6, y + th / 2);
			y += th + 14;
		});
		ctx.restore();
	}

	levelThumb(key, l) {
		const t = this.textures[key];
		let c = t.thumbs.get(l);
		if (!c) {
			const lv = t.levels[l];
			c = document.createElement('canvas');
			c.width = c.height = lv.size;
			c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(levelBytes(lv)), lv.size, lv.size), 0, 0);
			t.thumbs.set(l, c);
		}
		return c;
	}

	render() {
		const v = this.store.state.view;
		if (v === 'viewport') this.vpView.render();
		if (v === 'scene') {
			fitLabelToScreen(this.camLabel, this.view3d.camera, this.view3d.h);
			fitLabelToScreen(this.fpLabel, this.view3d.camera, this.view3d.h);
			this.view3d.render();
		}
		if (v === 'uv') this.uvView.render();
	}

	dispose() {
		super.dispose();
		// Sprite.geometry es un singleton compartido por todos los Sprites de la app: se saca de
		// la escena antes del dispose() genérico para no liberar ese geometry compartido.
		this.view3d.scene.remove(this.camLabel, this.fpLabel);
		disposeLabelSprite(this.camLabel);
		disposeLabelSprite(this.fpLabel);
		this.view3d.dispose();
		this.uvView.dispose();
		this.vpView.dispose();
		this.panel.dispose();
		for (const t of Object.values(this.textures)) t.gpuLevels.forEach((x) => x.dispose());
	}
}

export class AliasingTabLab extends AliasingLab {
	static views = [{ title: 'Piso en perspectiva', stack: true }];
	static help = [
		'La barra superior elige la vista grande: Viewport (emulación por píxel), Escena 3D (GPU real) o Espacio UV.',
		'Elegí un píxel con clic en el viewport o en el piso 3D. “Píxel cercano” y “Píxel lejano” comparan huellas del píxel pequeñas y grandes.',
		'Movés la cámara con los sliders o con “Animar avance”: en la zona lejana el patrón parpadea y aparece moiré.',
	];
	constructor(layout) {
		super(layout, 1, { filter: 'nearest' });
	}
}

export class MipmapsTabLab extends AliasingLab {
	static views = [{ title: 'Piso en perspectiva', stack: true }];
	static help = [
		'Alterná “Sin mipmaps / Con mipmaps” y la anisotropía: la comparación es inmediata en el viewport y en la escena 3D.',
		'Con “Mostrar nivel MIP” el viewport se tiñe por nivel y el espacio UV muestra la pirámide con el nivel usado resaltado.',
		'Bajá la altura o la inclinación de la cámara para obtener huellas del píxel muy alargadas: ahí la anisotropía marca la diferencia.',
	];
	constructor(layout) {
		super(layout, 2, { filter: 'linear', mip: true, pitch: 8, height: 1.2, sel: [0.5, 0.55] });
	}
}
