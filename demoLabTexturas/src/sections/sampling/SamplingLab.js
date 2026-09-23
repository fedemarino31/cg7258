import * as THREE from 'three';
import { Lab, onClick } from '../../shared/Lab.js';
import { Scene3DView } from '../../shared/Scene3DView.js';
import { TextureSpaceView } from '../../shared/TextureSpaceView.js';
import { ControlPanel } from '../../layout/ControlPanel.js';
import { createStore } from '../../app/AppState.js';
import { drawRuler, drawTag, drawLine, drawHandle, drawTexelGrid, fmt } from '../../shared/uvDraw.js';
import { CanvasView } from './CanvasView.js';
import { SamplerModel, CAMERA_PRESETS, VIEWPORT_RES, PLANE_SIZE, areaInTexels } from './model.js';
import { createFrustumMesh, createMovieCamera, placeMovieCamera, createLabelSprite, disposeLabelSprite, fitLabelToScreen } from '../../shared/cameraRig.js';
import { TEX_N, SAMPLING_TEXTURES, textureByValue, texelAt, sampleNearest, sampleLinear, css, hex } from './textures.js';

const NEIGHBOR_COLORS = { A: '#ff6b6b', B: '#3ddc84', C: '#4d8dff', D: '#ffa94d' };
const NO_SURFACE = '#0c0e12';
const YELLOW = '#ffd84d';
const USED_TEXEL_COLOR = '#ff5cf0';
const MAX_TEXEL_MARKERS = 500;
const GEO_KEYS = ['res', 'tilt', 'tilt2', 'texture', 'sel', 'filter'];

const DEFAULTS = {
	res: '16x12',
	tilt: 50,
	tilt2: 0,
	texture: 'numbered',
	filter: 'nearest',
	sel: [0.53, 0.47],
	footprint: true,
	camera: true,
	texels: true,
	wire: false,
	labels: true,
	calc: true,
	view: 'uv',
};

const pointInPoly = (x, y, poly) => {
	let inside = false;
	for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
		const [xi, yi] = poly[i];
		const [xj, yj] = poly[j];
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside;
};

const pct = (w) => `${Math.round(w * 100)}%`;

// De A-B-C-D, el texel cuyo centro está más cerca del punto (es el que elige Nearest).
const nearestKey = (lin) => (lin.fy >= 0.5 ? (lin.fx < 0.5 ? 'A' : 'B') : lin.fx < 0.5 ? 'C' : 'D');

class SamplingLab extends Lab {
	// Mitad común de los dos tabs: modelo de la escena, selección de píxel, escena 3D y espacio UV.
	constructor(defaults) {
		super();
		this.defaults = { ...DEFAULTS, ...defaults };
		this.store = createStore({ ...this.defaults });
		this.model = new SamplerModel();
		this.buf = document.createElement('canvas');
		this.hover = null;
		this.focusOnSelect = false;
	}

	get res() {
		return VIEWPORT_RES.find((r) => r.value === this.store.state.res) || VIEWPORT_RES[1];
	}

	get selPixel() {
		const { cols, rows } = this.res;
		const [fx, fy] = this.store.state.sel;
		return [Math.min(cols - 1, Math.floor(fx * cols)), Math.min(rows - 1, Math.floor(fy * rows))];
	}

	// ---------- vistas ----------
	initViewport(container, tag) {
		this.vpView = new CanvasView(container, { onInvalidate: this.invalidate, tag });
		this.vpView.drawFn = (ctx, v) => this.drawViewport(ctx, v);
		const c = this.vpView.canvas;
		c.style.cursor = 'pointer';
		const pick = (e) => {
			const cell = this.cellAt(...this.vpView.pos(e));
			if (cell) this.store.set({ sel: [(cell[0] + 0.5) / this.res.cols, (cell[1] + 0.5) / this.res.rows] });
		};
		let drag = false;
		this.listen(c, 'pointerdown', (e) => {
			if (e.button !== 0) return;
			drag = true;
			c.setPointerCapture(e.pointerId);
			pick(e);
		});
		this.listen(c, 'pointermove', (e) => {
			const cell = this.cellAt(...this.vpView.pos(e));
			const key = cell ? cell.join() : null;
			if (key !== this.hover?.join()) {
				this.hover = cell;
				this.invalidate();
			}
			if (drag) pick(e);
		});
		this.listen(c, 'pointerup', () => (drag = false));
		this.listen(c, 'pointerleave', () => {
			this.hover = null;
			this.invalidate();
		});
	}

	initScene(container) {
		const view = (this.view3d = new Scene3DView(container, {
			position: [7.5, 4.2, 12.5],
			target: [0, 0, 3],
			minDistance: 0.15,
			maxDistance: 40,
			panLimit: 8,
			onInvalidate: this.invalidate,
			tag: 'Arrastrar: orbitar · Rueda: zoom · Clic: elegir píxel',
		}));
		const scene = view.scene;
		this.group = new THREE.Group();
		this.group.matrixAutoUpdate = false;
		scene.add(this.group);

		this.gpuTex = {};
		for (const t of SAMPLING_TEXTURES) {
			const d = new THREE.DataTexture(t.data.slice(), TEX_N, TEX_N, THREE.RGBAFormat);
			d.colorSpace = THREE.SRGBColorSpace;
			d.generateMipmaps = false;
			d.magFilter = d.minFilter = THREE.NearestFilter;
			d.needsUpdate = true;
			this.gpuTex[t.value] = d;
		}
		const half = PLANE_SIZE / 2;
		const geo = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE);
		this.planeMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: this.gpuTex.numbered, side: THREE.DoubleSide }));
		this.wireMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.6 }));
		this.wireMesh.position.z = 0.004;
		const grid = [];
		for (let k = 0; k <= TEX_N; k++) {
			const t = -half + (PLANE_SIZE * k) / TEX_N;
			grid.push(t, -half, 0.003, t, half, 0.003, -half, t, 0.003, half, t, 0.003);
		}
		const gg = new THREE.BufferGeometry();
		gg.setAttribute('position', new THREE.Float32BufferAttribute(grid, 3));
		this.texelGrid = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 }));
		const frame = new THREE.BufferGeometry().setFromPoints([
			new THREE.Vector3(-half, -half, 0.005),
			new THREE.Vector3(half, -half, 0.005),
			new THREE.Vector3(half, half, 0.005),
			new THREE.Vector3(-half, half, 0.005),
		]);
		this.group.add(this.planeMesh, this.wireMesh, this.texelGrid, new THREE.LineLoop(frame, new THREE.LineBasicMaterial({ color: 0x56c8ff })));

		const quad = () => {
			const g = new THREE.BufferGeometry();
			g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
			return g;
		};
		const overlay = { depthTest: false, transparent: true };
		const fillGeo = quad();
		fillGeo.setIndex([0, 1, 2, 0, 2, 3]);
		this.fpFill = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({ ...overlay, color: YELLOW, opacity: 0.5, side: THREE.DoubleSide }));
		this.fpLine = new THREE.LineLoop(quad(), new THREE.LineBasicMaterial({ ...overlay, color: YELLOW }));
		this.fpDot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshBasicMaterial({ ...overlay, color: 0xffffff }));
		for (const o of [this.fpFill, this.fpLine, this.fpDot]) {
			o.renderOrder = 5;
			o.frustumCulled = false;
			this.group.add(o);
		}
		// Centros de texel dentro de la huella del píxel: mismo estilo (punto blanco, borde negro) que el
		// tab "Huella de píxel" usa en el espacio UV, pero llevado a la superficie 3D. Los que
		// realmente intervienen en el cálculo del sampler se resaltan en otro color.
		this.texelMarkers = [];
		for (let k = 0; k < MAX_TEXEL_MARKERS; k++) {
			const outer = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), new THREE.MeshBasicMaterial({ ...overlay, color: 0x000000 }));
			const inner = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), new THREE.MeshBasicMaterial({ ...overlay, color: 0xffffff }));
			outer.renderOrder = inner.renderOrder = 6;
			outer.frustumCulled = inner.frustumCulled = false;
			outer.visible = inner.visible = false;
			this.group.add(outer, inner);
			this.texelMarkers.push({ outer, inner });
		}

		const eg = new THREE.BufferGeometry();
		eg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(24), 3));
		this.eyeLines = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ ...overlay, color: YELLOW, opacity: 0.55 }));
		this.eyeLines.frustumCulled = false;
		scene.add(this.eyeLines);

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

		this.model.moveToPreset('angle');

		onClick(this, view.dom, (e) => {
			const hit = view.raycast(e, [this.planeMesh])[0];
			if (!hit) return;
			const [fx, fy] = this.model.pixelOfWorld(hit.point);
			if (fx < 0 || fx >= 1 || fy < 0 || fy >= 1) return;
			this.store.set({ sel: [fx, fy] });
		});
	}

	initUV(container, tag, focus) {
		this.focusOnSelect = focus;
		this.uvView = new TextureSpaceView(container, { center: [0.5, 0.5], extent: 1.3, onInvalidate: this.invalidate, tag });
		this.uvView.drawFn = (ctx, v) => this.drawUV(ctx, v);
		this.uvView.cursor = 'crosshair';
		const pick = (uv) => {
			let best = null;
			let bd = Infinity;
			this.centers.forEach((c, k) => {
				if (!c) return;
				const d = (c[0] - uv[0]) ** 2 + (c[1] - uv[1]) ** 2;
				if (d < bd) [bd, best] = [d, k];
			});
			if (best === null) return;
			const { cols, rows } = this.res;
			this.store.set({ sel: [((best % cols) + 0.5) / cols, (Math.floor(best / cols) + 0.5) / rows] });
		};
		this.uvView.handlers.down = (uv) => (pick(uv), true);
		this.uvView.handlers.drag = (uv) => pick(uv);
	}

	// ---------- estado ----------
	applyState(patch) {
		if (!patch || GEO_KEYS.some((k) => k in patch)) this.recompute(patch);
		else this.update3D();
		this.onState?.(patch);
		this.invalidate();
	}

	// Llevá la cámara simulada a una posición preestablecida: una acción puntual, no un valor ligado al store.
	moveCameraToPreset(value) {
		this.model.moveToPreset(value);
		this.applyState();
	}

	recompute(patch) {
		const s = this.store.state;
		const { cols, rows } = this.res;
		this.tex = textureByValue(s.texture);
		this.model.setup({ tilt: s.tilt, tilt2: s.tilt2, cols, rows });
		const sampler = s.filter === 'linear' ? sampleLinear : sampleNearest;
		this.centers = [];
		this.pix = [];
		for (let j = 0; j < rows; j++)
			for (let i = 0; i < cols; i++) {
				const uv = this.model.uvAt(i + 0.5, j + 0.5);
				const ok = uv && uv[0] >= 0 && uv[0] <= 1 && uv[1] >= 0 && uv[1] <= 1;
				this.centers.push(ok ? uv : null);
				this.pix.push(ok ? sampler(this.tex, uv[0], uv[1]).color : null);
			}
		const [pi, pj] = this.selPixel;
		this.fp = this.model.footprint(pi, pj);
		const c = this.fp.center;
		this.sample = this.fp.hit ? { u: c[0], v: c[1], nearest: sampleNearest(this.tex, c[0], c[1]), linear: sampleLinear(this.tex, c[0], c[1]) } : null;
		this.covered = [];
		if (this.fp.valid)
			for (let j = 0; j < TEX_N; j++)
				for (let i = 0; i < TEX_N; i++)
					if (pointInPoly((i + 0.5) / TEX_N, (j + 0.5) / TEX_N, this.fp.corners)) this.covered.push([i, j]);
		this.update3D();
		this.updateIdeal?.();
		this.updateReadout?.();
		if (this.uvView && this.focusOnSelect && (!patch || ['sel', 'res', 'tilt', 'tilt2'].some((k) => k in patch))) this.focusUV();
	}

	focusUV() {
		const smp = this.sample;
		let extent = 8 / TEX_N;
		if (this.fp.valid) {
			const xs = this.fp.corners.map((p) => p[0]);
			const ys = this.fp.corners.map((p) => p[1]);
			extent = Math.max(extent, 3 * Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)));
		}
		this.uvView.home = { center: smp ? [smp.u, smp.v] : [0.5, 0.5], extent: smp ? Math.min(1.3, extent) : 1.3 };
		this.uvView.resetView();
	}

	update3D() {
		if (!this.view3d) return;
		const s = this.store.state;
		const m = this.model;
		const fp = this.fp;
		this.group.matrix.copy(m.planeMatrix);
		this.group.updateMatrixWorld(true);
		const tex = this.gpuTex[s.texture];
		// La superficie 3D siempre muestra la textura tal cual (sin filtrado): el filtro elegido
		// solo afecta al viewport simulado y al espacio UV, que sí calculan el sampler por CPU.
		const filter = this.mode === 'filter' ? THREE.NearestFilter : s.filter === 'linear' ? THREE.LinearFilter : THREE.NearestFilter;
		if (tex.magFilter !== filter) {
			for (const t of Object.values(this.gpuTex)) {
				t.magFilter = t.minFilter = filter;
				t.needsUpdate = true;
			}
		}
		this.planeMesh.material.map = tex;
		this.wireMesh.visible = s.wire;
		this.texelGrid.visible = s.texels;

		m.camera.updateMatrixWorld(true);
		this.frustum.update(m.camera);
		placeMovieCamera(this.camBody, m.camera);
		this.camLabel.position.copy(m.camera.position);
		this.frustum.group.visible = this.camBody.visible = this.camLabel.visible = s.camera;

		const show = s.footprint && fp.valid;
		this.fpFill.visible = this.fpLine.visible = this.eyeLines.visible = show;
		this.fpDot.visible = s.footprint && !!fp.center;
		if (show) {
			for (const g of [this.fpFill.geometry, this.fpLine.geometry]) {
				fp.local.forEach((p, k) => g.attributes.position.setXYZ(k, p.x, p.y, 0.01));
				g.attributes.position.needsUpdate = true;
			}
			const ep = this.eyeLines.geometry.attributes.position;
			fp.local.forEach((p, k) => {
				const w = p.clone().applyMatrix4(m.planeMatrix);
				ep.setXYZ(2 * k, m.camera.position.x, m.camera.position.y, m.camera.position.z);
				ep.setXYZ(2 * k + 1, w.x, w.y, w.z);
			});
			ep.needsUpdate = true;
		}
		if (fp.center) {
			this.fpDot.position.set((fp.center[0] - 0.5) * PLANE_SIZE, (fp.center[1] - 0.5) * PLANE_SIZE, 0.02);
			this.centerWorld = this.fpDot.position.clone().applyMatrix4(m.planeMatrix);
			this.fpLabel.position.copy(this.centerWorld);
		}
		this.fpLabel.visible = show && !!this.centerWorld;
		this.updateTexelMarkers(show);
	}

	// Marca, sobre la superficie 3D, los centros de texel que caen dentro de la huella del píxel (blanco) y,
	// entre esos, los que realmente participan del cálculo del sampler (resaltados en otro color):
	// un solo texel en Nearest, o los cuatro vecinos A-B-C-D en Linear.
	updateTexelMarkers(show) {
		if (!this.texelMarkers || this.mode !== 'filter') return;
		const s = this.store.state;
		const covered = show ? this.covered : [];
		const used = new Set();
		if (show && this.sample) {
			if (s.filter === 'nearest') used.add(`${this.sample.nearest.i},${this.sample.nearest.j}`);
			else for (const c of this.sample.linear.cells) used.add(`${c.i},${c.j}`);
		}
		covered.forEach(([i, j], k) => {
			if (k >= MAX_TEXEL_MARKERS) return;
			const { outer, inner } = this.texelMarkers[k];
			const x = ((i + 0.5) / TEX_N - 0.5) * PLANE_SIZE;
			const y = ((j + 0.5) / TEX_N - 0.5) * PLANE_SIZE;
			outer.position.set(x, y, 0.014);
			inner.position.set(x, y, 0.016);
			outer.visible = inner.visible = true;
			inner.material.color.set(used.has(`${i},${j}`) ? USED_TEXEL_COLOR : 0xffffff);
		});
		for (let k = covered.length; k < MAX_TEXEL_MARKERS; k++) {
			this.texelMarkers[k].outer.visible = this.texelMarkers[k].inner.visible = false;
		}
	}

	// ---------- dibujo: viewport ----------
	gridRect() {
		const { cols, rows } = this.res;
		const { w, h } = this.vpView;
		const cell = Math.max(2, Math.min((w - 20) / cols, (h - 20) / rows));
		return { x0: (w - cell * cols) / 2, y0: (h - cell * rows) / 2, cell, cols, rows };
	}

	cellAt(x, y) {
		const g = this.gridRect();
		const i = Math.floor((x - g.x0) / g.cell);
		const j = Math.floor((y - g.y0) / g.cell);
		return i >= 0 && j >= 0 && i < g.cols && j < g.rows ? [i, j] : null;
	}

	drawViewport(ctx) {
		const g = this.gridRect();
		const { x0, y0, cell, cols, rows } = g;
		for (let j = 0; j < rows; j++)
			for (let i = 0; i < cols; i++) {
				const c = this.pix[j * cols + i];
				ctx.fillStyle = c ? css(c) : NO_SURFACE;
				ctx.fillRect(x0 + i * cell, y0 + j * cell, cell + 0.5, cell + 0.5);
			}
		if (cell >= 7) {
			ctx.strokeStyle = 'rgba(255,255,255,0.14)';
			ctx.lineWidth = 1;
			ctx.beginPath();
			for (let i = 0; i <= cols; i++) (ctx.moveTo(x0 + i * cell, y0), ctx.lineTo(x0 + i * cell, y0 + rows * cell));
			for (let j = 0; j <= rows; j++) (ctx.moveTo(x0, y0 + j * cell), ctx.lineTo(x0 + cols * cell, y0 + j * cell));
			ctx.stroke();
		}
		ctx.strokeStyle = '#56c8ff';
		ctx.lineWidth = 1.5;
		ctx.strokeRect(x0, y0, cols * cell, rows * cell);
		if (this.hover) {
			ctx.strokeStyle = 'rgba(255,255,255,0.8)';
			ctx.lineWidth = 1.5;
			ctx.strokeRect(x0 + this.hover[0] * cell + 1, y0 + this.hover[1] * cell + 1, cell - 2, cell - 2);
		}
		const [pi, pj] = this.selPixel;
		ctx.strokeStyle = '#000';
		ctx.lineWidth = 5;
		ctx.strokeRect(x0 + pi * cell, y0 + pj * cell, cell, cell);
		ctx.strokeStyle = YELLOW;
		ctx.lineWidth = 3;
		ctx.strokeRect(x0 + pi * cell, y0 + pj * cell, cell, cell);
		drawTag(ctx, `${cols} × ${rows} píxeles · elegido (${pi}, ${pj})`, x0, Math.max(2, y0 - 22), { color: YELLOW });
	}

	// ---------- dibujo: espacio UV ----------
	drawUV(ctx, view) {
		const s = this.store.state;
		const tex = this.tex;
		const cellPx = view.scale / TEX_N;
		for (let j = 0; j < TEX_N; j++)
			for (let i = 0; i < TEX_N; i++) {
				const [x, y] = view.toPx(i / TEX_N, (j + 1) / TEX_N);
				if (x > view.w || y > view.h || x + cellPx < 0 || y + cellPx < 0) continue;
				ctx.fillStyle = css(texelAt(tex, i, j));
				ctx.fillRect(x, y, cellPx + 0.6, cellPx + 0.6);
			}
		if (s.texels) drawTexelGrid(ctx, view, TEX_N, 'rgba(255,255,255,0.35)');
		if (tex.numbered && cellPx >= 30) {
			ctx.save();
			ctx.font = '10px sans-serif';
			ctx.textBaseline = 'bottom';
			ctx.textAlign = 'left';
			ctx.fillStyle = 'rgba(255,255,255,0.85)';
			for (let j = 0; j < TEX_N; j++)
				for (let i = 0; i < TEX_N; i++) {
					const [x, y] = view.toPx(i / TEX_N, j / TEX_N);
					if (x > view.w || y < 0 || x + cellPx < 0 || y - cellPx > view.h) continue;
					ctx.fillText(`${i},${j}`, x + 3, y - 2);
				}
			ctx.restore();
		}
		const [ux, uy] = view.toPx(0, 1);
		ctx.fillStyle = 'rgba(8,10,14,0.5)';
		ctx.beginPath();
		ctx.rect(0, 0, view.w, view.h);
		ctx.rect(ux, uy, view.scale, view.scale);
		ctx.fill('evenodd');
		ctx.strokeStyle = '#56c8ff';
		ctx.lineWidth = 2;
		ctx.strokeRect(ux, uy, view.scale, view.scale);

		this.mode === 'filter' ? this.drawSamplerUV(ctx, view) : this.drawFootprintUV(ctx, view);
		drawRuler(ctx, view);
	}

	polygonPath(ctx, view, uvs) {
		ctx.beginPath();
		uvs.forEach((p, i) => {
			const [x, y] = view.toPx(p[0], p[1]);
			i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
		});
		ctx.closePath();
	}

	drawFootprintPolygon(ctx, view) {
		if (!this.store.state.footprint || !this.fp.valid) return;
		this.polygonPath(ctx, view, this.fp.corners);
		ctx.fillStyle = 'rgba(255,216,77,0.3)';
		ctx.fill();
		ctx.strokeStyle = YELLOW;
		ctx.lineWidth = 2.5;
		ctx.stroke();
	}

	// Centros de texel dentro de la huella del píxel: punto blanco con borde negro, igual estética que en la
	// escena 3D. `skip` deja afuera los que ya se resaltan con otro estilo (p. ej. los que usa el sampler).
	drawCoveredTexelDots(ctx, view, skip = null) {
		const cellPx = view.scale / TEX_N;
		if (cellPx < 14) return;
		ctx.save();
		ctx.fillStyle = '#fff';
		ctx.strokeStyle = '#000';
		ctx.lineWidth = 1.5;
		for (const [i, j] of this.covered) {
			if (skip && skip.has(`${i},${j}`)) continue;
			const [x, y] = view.toPx((i + 0.5) / TEX_N, (j + 0.5) / TEX_N);
			ctx.beginPath();
			ctx.arc(x, y, 3, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
		}
		ctx.restore();
	}

	drawFootprintUV(ctx, view) {
		const fp = this.fp;
		if (!fp.valid) {
			drawTag(ctx, 'Este píxel no ve la superficie', 34, 34, { color: '#ffbd70' });
			return;
		}
		this.drawFootprintPolygon(ctx, view);
		this.drawCoveredTexelDots(ctx, view);
		if (fp.center) {
			const [x, y] = view.toPx(fp.center[0], fp.center[1]);
			drawHandle(ctx, x, y, YELLOW, '', { r: 4, ring: false });
		}
		const poly = fp.corners.map((p) => view.toPx(p[0], p[1]));
		const top = poly.reduce((a, p) => (p[1] < a[1] ? p : a));
		const area = areaInTexels(fp.corners, TEX_N);
		drawTag(ctx, `huella del píxel ≈ ${area < 10 ? area.toFixed(1) : Math.round(area)} texels²`, top[0] + 8, top[1] - 24, { color: YELLOW });
	}

	// Etiqueta en la esquina exterior del texel (A arriba-izq, B arriba-der, C abajo-izq, D abajo-der): no tapa al punto P.
	tagOuter(ctx, text, key, cx, cy, sz, color) {
		const right = key === 'B' || key === 'D';
		const bottom = key === 'C' || key === 'D';
		drawTag(ctx, text, cx + (right ? sz / 2 - 3 : -sz / 2 + 3), cy + (bottom ? sz / 2 - 21 : -sz / 2 + 3), { color, align: right ? 'right' : 'left' });
	}

	cellRect(view, i, j) {
		const [x, y] = view.toPx(i / TEX_N, (j + 1) / TEX_N);
		return [x, y, view.scale / TEX_N];
	}

	drawSamplerUV(ctx, view) {
		const s = this.store.state;
		const smp = this.sample;
		this.drawFootprintPolygon(ctx, view);
		if (!smp) {
			drawTag(ctx, 'Este píxel no ve la superficie: no hay punto de muestreo', 34, 34, { color: '#ffbd70' });
			return;
		}
		const used = new Set(s.filter === 'nearest' ? [`${smp.nearest.i},${smp.nearest.j}`] : smp.linear.cells.map((c) => `${c.i},${c.j}`));
		this.drawCoveredTexelDots(ctx, view, used);
		const [px, py] = view.toPx(smp.u, smp.v);
		const box = (i, j, color, width) => {
			const [x, y, sz] = this.cellRect(view, i, j);
			ctx.save();
			ctx.strokeStyle = '#000';
			ctx.lineWidth = width + 2;
			ctx.strokeRect(x, y, sz, sz);
			ctx.strokeStyle = color;
			ctx.lineWidth = width;
			ctx.strokeRect(x, y, sz, sz);
			ctx.restore();
			return [x + sz / 2, y + sz / 2, sz];
		};
		if (s.filter === 'nearest') {
			const n = smp.nearest;
			const [cx, cy, sz] = box(n.i, n.j, '#fff', 4);
			drawLine(ctx, [px, py], [cx, cy], '#fff', 1.5, [4, 4]);
			drawHandle(ctx, cx, cy, css(n.color), '', { r: 5, ring: false });
			if (s.labels && sz >= 22) drawTag(ctx, `texel (${n.i}, ${n.j})`, cx - sz / 2 + 3, cy - sz / 2 + 3, { color: '#fff' });
		} else {
			const cs = smp.linear.cells;
			const centers = [];
			for (const c of cs) {
				const [cx, cy, sz] = box(c.i, c.j, NEIGHBOR_COLORS[c.key], 3);
				centers.push([cx, cy]);
				drawLine(ctx, [px, py], [cx, cy], NEIGHBOR_COLORS[c.key], 1 + 5 * c.w, [5, 4]);
				const text = [s.labels && c.key, s.calc && pct(c.w)].filter(Boolean).join(' ');
				if (text && sz >= 26) this.tagOuter(ctx, text, c.key, cx, cy, sz, NEIGHBOR_COLORS[c.key]);
			}
			ctx.save();
			ctx.strokeStyle = 'rgba(255,255,255,0.7)';
			ctx.lineWidth = 1.5;
			ctx.setLineDash([3, 4]);
			ctx.beginPath();
			[0, 1, 3, 2, 0].forEach((k, n) => (n ? ctx.lineTo(...centers[k]) : ctx.moveTo(...centers[k])));
			ctx.stroke();
			ctx.restore();
		}
		drawHandle(ctx, px, py, YELLOW, 'P', { r: 9, textColor: '#111' });
		drawTag(ctx, [`centro del píxel`, `UV (${fmt(smp.u, 3)}, ${fmt(smp.v, 3)})`], px + 13, py + 10, { color: YELLOW });
	}

	// Tamaño fijo en píxeles para las etiquetas, sin importar el zoom del orbit control: hay que
	// recalcularlo en cada frame porque la distancia cámara-objeto cambia con solo orbitar/hacer zoom.
	syncLabels() {
		fitLabelToScreen(this.camLabel, this.view3d.camera, this.view3d.h);
		fitLabelToScreen(this.fpLabel, this.view3d.camera, this.view3d.h);
	}

	render() {
		this.renderViews?.();
	}

	dispose() {
		super.dispose();
		// Sprite.geometry es un singleton compartido por todos los Sprites de la app: se saca de
		// la escena antes del dispose() genérico para no liberar ese geometry compartido.
		if (this.view3d) {
			this.view3d.scene.remove(this.camLabel, this.fpLabel);
			disposeLabelSprite(this.camLabel);
			disposeLabelSprite(this.fpLabel);
		}
		this.view3d?.dispose();
		this.uvView?.dispose();
		this.vpView?.dispose();
		this.extraViews?.forEach((v) => v.dispose());
		this.panel?.dispose();
	}
}

const resOptions = VIEWPORT_RES.map(({ value, label }) => ({ value, label }));
const texOptions = SAMPLING_TEXTURES.map(({ value, label }) => ({ value, label }));

// ---------------------------------------------------------------------------------------------
// Tab 1 — Huella de píxel
// ---------------------------------------------------------------------------------------------
export class PixelFootprintLab extends SamplingLab {
	static views = [
		{ title: 'Viewport simulado', stack: true },
		{ title: 'Escena 3D', stack: false },
		{ title: 'Textura / espacio UV', stack: false },
	];
	static help = [
		'Clic (o arrastre) en el viewport simulado: elige el píxel. También se puede elegir con clic en el plano 3D o en la textura.',
		'La escena 3D se orbita arrastrando; rueda: zoom. En la textura: rueda para zoom y botón derecho para paneo.',
		'Cambiá la posición de cámara y la inclinación del plano: la huella del píxel cambia de tamaño y forma tanto en la superficie como en UV.',
	];

	constructor(layout) {
		super({ filter: 'nearest' });
		this.mode = 'footprint';
		const [left, mid, right] = layout.views;
		const vp = document.createElement('div');
		vp.className = 'view';
		vp.style.flex = '1.15';
		const vpCaption = document.createElement('div');
		vpCaption.className = 'view-caption';
		vpCaption.textContent = 'Clic: elegir píxel';
		const ideal = document.createElement('div');
		ideal.className = 'view';
		left.append(vp, vpCaption, ideal);

		this.initViewport(vp);
		this.idealView = new CanvasView(ideal, { onInvalidate: this.invalidate });
		this.idealView.drawFn = (ctx, v) => this.drawIdeal(ctx, v);
		this.ideal = document.createElement('canvas');
		this.ideal.width = this.ideal.height = 64;
		this.initScene(mid);
		this.initUV(right, 'Clic: elegir píxel · Rueda: zoom · Botón derecho: paneo', false);
		this.extraViews = [this.idealView];

		this.buildControls(layout.controls);
		this.applyState();
		this.store.subscribe((s, patch) => this.applyState(patch));
	}

	buildControls(el) {
		const p = (this.panel = new ControlPanel(el, this.store));
		p.idea('Un píxel de pantalla no equivale siempre a un texel. Cada píxel corresponde a una región sobre la superficie (su huella del píxel) y a una región en el espacio UV, que puede cubrir uno o varios texels.');
		p.title('Escena');
		p.select('res', 'Resolución del viewport', resOptions);
		p.slider('tilt', 'Inclinación del plano (°)', { min: 0, max: 160, step: 1, digits: 0 });
		p.slider('tilt2', 'Inclinación lateral del plano (°)', { min: 0, max: 160, step: 1, digits: 0 });
		p.select('texture', 'Textura diagnóstica', texOptions);
		p.title('Posición de cámara');
		p.buttons(...CAMERA_PRESETS.map((preset) => ({ label: preset.label, onClick: () => this.moveCameraToPreset(preset.value) })));
		p.title('Visualización');
		p.checkbox('footprint', 'Mostrar huella del píxel');
		p.checkbox('camera', 'Mostrar cámara');
		p.checkbox('texels', 'Mostrar texels');
		p.checkbox('wire', 'Mostrar wireframe');
		p.buttons({ label: 'Restablecer vista', onClick: () => this.resetAll() });
		this.readout = p.readout();
	}

	resetAll() {
		this.model.moveToPreset('angle');
		this.store.set({ ...this.defaults });
		this.view3d.resetCamera();
		this.uvView.resetView();
	}

	updateReadout() {
		const [pi, pj] = this.selPixel;
		const fp = this.fp;
		let html = `<span class="k">Píxel</span> <code>(${pi}, ${pj})</code>`;
		if (!fp.valid) html += '<br><span class="k">No ve la superficie completa: sin huella del píxel.</span>';
		else {
			const a = areaInTexels(fp.corners, TEX_N);
			html += `<br><span class="k">Huella del píxel en UV</span> <code>≈ ${a.toFixed(2)} texels²</code>`;
			html += `<br><span class="k">Centros de texel dentro</span> <code>${this.covered.length}</code>`;
		}
		if (fp.center) html += `<br><span class="k">Centro</span> <code>(${fmt(fp.center[0], 3)}, ${fmt(fp.center[1], 3)})</code>`;
		this.readout.innerHTML = html;
	}

	// Imagen "ideal": lo que habría dentro del píxel con resolución muy alta, reconstruida de forma continua.
	updateIdeal() {
		const [pi, pj] = this.selPixel;
		const N = this.ideal.width;
		const ctx = this.ideal.getContext('2d');
		const img = ctx.createImageData(N, N);
		for (let y = 0; y < N; y++)
			for (let x = 0; x < N; x++) {
				const uv = this.model.uvAt(pi + (x + 0.5) / N, pj + (y + 0.5) / N);
				const ok = uv && uv[0] >= 0 && uv[0] <= 1 && uv[1] >= 0 && uv[1] <= 1;
				const c = ok ? sampleNearest(this.tex, uv[0], uv[1]).color : [12, 14, 18];
				const o = (y * N + x) * 4;
				img.data[o] = c[0];
				img.data[o + 1] = c[1];
				img.data[o + 2] = c[2];
				img.data[o + 3] = 255;
			}
		ctx.putImageData(img, 0, 0);
	}

	drawIdeal(ctx, v) {
		const sq = Math.max(10, Math.min(v.w - 16, v.h - 16));
		const x0 = (v.w - sq) / 2;
		const y0 = (v.h - sq) / 2;
		ctx.imageSmoothingEnabled = false;
		ctx.drawImage(this.ideal, x0, y0, sq, sq);
		ctx.strokeStyle = YELLOW;
		ctx.lineWidth = 2;
		ctx.strokeRect(x0, y0, sq, sq);
		drawTag(ctx, 'Lo que se ve dentro del píxel', x0 + 6, y0 + 6, { color: '#fff' });
		const cx = x0 + sq / 2;
		const cy = y0 + sq / 2;
		drawLine(ctx, [cx - 7, cy], [cx + 7, cy], '#fff', 1.5);
		drawLine(ctx, [cx, cy - 7], [cx, cy + 7], '#fff', 1.5);
		const final = this.pix[this.selPixel[1] * this.res.cols + this.selPixel[0]];
		if (final) {
			const sw = Math.min(30, sq * 0.2);
			ctx.fillStyle = css(final);
			ctx.fillRect(x0 + sq - sw - 6, y0 + sq - sw - 6, sw, sw);
			ctx.strokeStyle = '#fff';
			ctx.lineWidth = 2;
			ctx.strokeRect(x0 + sq - sw - 6, y0 + sq - sw - 6, sw, sw);
			drawTag(ctx, 'color final', x0 + sq - sw - 78, y0 + sq - sw - 2, { color: '#fff' });
		}
	}

	renderViews() {
		this.vpView.render();
		this.idealView.render();
		this.syncLabels();
		this.view3d.render();
		this.uvView.render();
	}
}

// ---------------------------------------------------------------------------------------------
// Tab 2 — Filtro del sampler
// ---------------------------------------------------------------------------------------------
const PANES = [
	{ value: 'viewport', label: 'Viewport' },
	{ value: 'scene', label: 'Escena 3D' },
	{ value: 'uv', label: 'Espacio UV' },
];

export class SamplerFilterLab extends SamplingLab {
	static views = [{ title: 'De la huella del píxel al color', stack: true }];
	static help = [
		'La barra superior elige qué vista se muestra grande: Viewport, Escena 3D o Espacio UV.',
		'Cambiá de píxel con clic en el viewport, en el plano 3D o en el espacio UV (elige el píxel cuyo centro está más cerca).',
		'El bloque inferior “Cómo decide el sampler” es permanente: compara Nearest y Linear con los mismos cuatro texels vecinos.',
	];

	constructor(layout) {
		super({ filter: 'nearest', texture: 'texels', tilt: 50 });
		this.mode = 'filter';
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
		const mk = (cls, parent) => {
			const d = document.createElement('div');
			d.className = cls;
			parent.appendChild(d);
			return d;
		};
		stack.appendChild(nav);
		this.panes = { viewport: mk('view', stack), scene: mk('view', stack), uv: mk('view', stack) };
		this.initViewport(this.panes.viewport, 'Clic: elegir píxel');
		this.initScene(this.panes.scene);
		this.initUV(this.panes.uv, 'Clic: elegir píxel · Rueda: zoom · Botón derecho: paneo', true);
		this.buildBlock(stack);

		this.buildControls(layout.controls);
		this.applyState();
		this.store.subscribe((s, patch) => this.applyState(patch));
	}

	buildBlock(stack) {
		const block = document.createElement('section');
		block.className = 'sampler-block';
		block.innerHTML = `
			<div class="sb-title">Cómo decide el sampler</div>
			<div class="sb-grid">
				<div class="sb-cell" data-k="nearest"><h4>Nearest</h4><div class="sb-canvas"></div><p class="sb-note"></p></div>
				<div class="sb-cell" data-k="linear"><h4>Linear</h4><div class="sb-canvas"></div><p class="sb-note"></p></div>
				<div class="sb-cell sb-result"><h4>Resultado del sampler</h4>
					<div class="res-row" data-k="nearest"><span class="sw"></span><span class="lbl-t">Color con Nearest</span><code></code></div>
					<div class="res-row" data-k="linear"><span class="sw"></span><span class="lbl-t">Color con Linear</span><code></code></div>
				</div>
			</div>`;
		stack.appendChild(block);
		this.block = block;
		const cells = (k) => block.querySelector(`.sb-cell[data-k="${k}"]`);
		this.sbNote = { nearest: cells('nearest').querySelector('.sb-note'), linear: cells('linear').querySelector('.sb-note') };
		this.sbCells = { nearest: cells('nearest'), linear: cells('linear') };
		this.resRows = {};
		for (const k of ['nearest', 'linear']) {
			const row = block.querySelector(`.res-row[data-k="${k}"]`);
			this.resRows[k] = { row, sw: row.querySelector('.sw'), code: row.querySelector('code') };
		}
		this.schemas = ['nearest', 'linear'].map((k) => {
			const v = new CanvasView(cells(k).querySelector('.sb-canvas'), { onInvalidate: this.invalidate });
			v.drawFn = (ctx, cv) => this.drawSchema(ctx, cv, k);
			return v;
		});
		this.extraViews = this.schemas;
	}

	buildControls(el) {
		const p = (this.panel = new ControlPanel(el, this.store));
		p.idea('El sampler transforma una coordenada UV continua en un color de la textura. Según el filtro, usa un solo texel o combina varios texels vecinos.');
		p.title('Escena');
		p.select('res', 'Resolución del viewport', resOptions);
		p.title('Sampler');
		p.segmented('filter', 'Filtro', [
			{ value: 'nearest', label: 'Nearest' },
			{ value: 'linear', label: 'Linear' },
		]);
		p.select('texture', 'Textura', texOptions);
		p.title('Visualización');
		p.checkbox('texels', 'Mostrar texels');
		p.checkbox('labels', 'Mostrar etiquetas A-B-C-D');
		p.checkbox('calc', 'Mostrar cálculo');
		p.checkbox('footprint', 'Mostrar huella del píxel');
		p.buttons({ label: 'Restablecer vista', onClick: () => this.resetAll() });
		this.readout = p.readout();
	}

	resetAll() {
		this.model.moveToPreset('angle');
		this.store.set({ ...this.defaults });
		this.view3d.resetCamera();
		this.focusUV();
	}

	onState() {
		const v = this.store.state.view;
		for (const [k, el] of Object.entries(this.panes)) el.classList.toggle('hidden', k !== v);
		this.navBtns.forEach(([k, b]) => b.classList.toggle('on', k === v));
	}

	updateReadout() {
		const smp = this.sample;
		if (!smp) {
			this.readout.innerHTML = '<span class="k">Este píxel no ve la superficie: elegí otro.</span>';
			return;
		}
		const lin = smp.linear;
		this.readout.innerHTML = `<span class="k">Punto de muestreo</span><br><code>UV (${fmt(smp.u, 3)}, ${fmt(smp.v, 3)})</code><br>
			<span class="k">En texels</span> <code>(${fmt(smp.u * TEX_N, 2)}, ${fmt(smp.v * TEX_N, 2)})</code><br>
			<span class="k">Posición entre centros</span> <code>(${fmt(lin.fx, 2)}, ${fmt(lin.fy, 2)})</code>`;
		const s = this.store.state;
		for (const k of ['nearest', 'linear']) {
			const c = (k === 'linear' ? lin : smp.nearest).color;
			this.resRows[k].sw.style.background = css(c);
			this.resRows[k].code.textContent = hex(c);
			this.resRows[k].row.classList.toggle('active', s.filter === k);
			this.sbCells[k].classList.toggle('active', s.filter === k);
		}
		this.sbNote.nearest.textContent = `Elige 1 texel: el más cercano al punto (${nearestKey(lin)}).`;
		this.sbNote.linear.textContent = s.calc
			? lin.cells.map((c) => `${fmt(c.w, 2)}·${c.key}`).join(' + ')
			: 'Mezcla A, B, C y D según la posición del punto.';
	}

	updateIdeal() {}

	// Esquema con los cuatro texels vecinos del punto de muestreo (los mismos que usa Linear).
	drawSchema(ctx, v, mode) {
		const smp = this.sample;
		if (!smp) {
			drawTag(ctx, 'Sin punto de muestreo', 10, 10, { color: '#ffbd70' });
			return;
		}
		const lin = smp.linear;
		const q = Math.max(20, Math.min((v.w - 20) / 2, (v.h - 12) / 2, 84));
		const x0 = (v.w - 2 * q) / 2;
		const y0 = (v.h - 2 * q) / 2;
		const pos = { A: [0, 0], B: [1, 0], C: [0, 1], D: [1, 1] };
		const near = nearestKey(lin);
		const P = [x0 + (0.5 + lin.fx) * q, y0 + (1.5 - lin.fy) * q];
		const s = this.store.state;
		const centerOf = (c) => [x0 + pos[c.key][0] * q + q / 2, y0 + pos[c.key][1] * q + q / 2];
		// Primero los cuatro texels, para que las líneas punteadas y el punto queden siempre por encima.
		for (const c of lin.cells) {
			const [cx, cy] = [x0 + pos[c.key][0] * q, y0 + pos[c.key][1] * q];
			ctx.save();
			ctx.globalAlpha = mode === 'nearest' && c.key !== near ? 0.35 : 1;
			ctx.fillStyle = css(c.color);
			ctx.fillRect(cx, cy, q, q);
			ctx.restore();
			ctx.strokeStyle = NEIGHBOR_COLORS[c.key];
			ctx.lineWidth = mode === 'nearest' && c.key === near ? 4 : 2;
			ctx.strokeRect(cx + 1, cy + 1, q - 2, q - 2);
			this.tagOuter(ctx, mode === 'linear' && s.calc ? `${c.key} ${pct(c.w)}` : c.key, c.key, cx + q / 2, cy + q / 2, q, NEIGHBOR_COLORS[c.key]);
		}
		for (const c of lin.cells) {
			if (mode === 'linear') drawLine(ctx, P, centerOf(c), '#fff', 1 + 5 * c.w, [4, 3]);
			else if (c.key === near) drawLine(ctx, P, centerOf(c), '#fff', 1.5, [4, 3]);
		}
		drawHandle(ctx, P[0], P[1], '#fff', '', { r: 6, ring: true });
	}

	renderViews() {
		const view = this.store.state.view;
		if (view === 'viewport') this.vpView.render();
		if (view === 'scene') {
			this.syncLabels();
			this.view3d.render();
		}
		if (view === 'uv') this.uvView.render();
		this.schemas.forEach((v) => v.render());
	}
}
