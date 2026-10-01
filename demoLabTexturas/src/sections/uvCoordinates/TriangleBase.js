import * as THREE from 'three';
import { Lab } from '../../shared/Lab.js';
import { Scene3DView } from '../../shared/Scene3DView.js';
import { TextureSpaceView } from '../../shared/TextureSpaceView.js';
import { ControlPanel } from '../../layout/ControlPanel.js';
import { createStore } from '../../app/AppState.js';
import { TEXTURE_KINDS, getTextureData, applyTextureParams } from '../../shared/textures.js';
import { drawRuler, drawUnitSquare, drawTextureWrapped, pathTriangle, drawHandle, drawTag, fmt } from '../../shared/uvDraw.js';

export const VCOL = ['#ff4d4f', '#3ddc84', '#4d8dff'];
export const VNAME = ['A', 'B', 'C'];
export const DEFAULT_POS = [
	[-1.7, -1.2, 0],
	[1.7, -1.2, 0],
	[0.2, 1.8, 0],
];

// Base común de las pestañas "Un triángulo" e "Interpolación UV".
// Las subclases llaman a super(), crean sus extras y finalmente a start().
export class TriangleBase extends Lab {
	static leftTitle = 'Escena 3D · triángulo';
	static centerTitle = 'Espacio de textura · UV';

	constructor(layout, cfg) {
		super();
		this.cfg = cfg;
		this.layout = layout;
		this.store = createStore({
			texture: 'grid',
			wrap: 'clamp',
			filter: 'linear',
			showXYZ: false,
			showUV: true,
			wire: true,
			...cfg.extraState,
		});
		this.pos = DEFAULT_POS.map((p) => new THREE.Vector3(...p));
		this.uv = cfg.defaultUV.map((u) => [...u]);

		this.view3d = new Scene3DView(layout.left, {
			position: [1.2, 1.2, 6.6],
			target: [0, 0.2, 0],
			minDistance: 3,
			maxDistance: 16,
			onInvalidate: this.invalidate,
			tag: cfg.tag3d,
		});
		this.uvView = new TextureSpaceView(layout.center, {
			center: [0.5, 0.5],
			extent: cfg.uvExtent,
			onInvalidate: this.invalidate,
			tag: 'Rueda: zoom · Botón derecho: paneo',
		});
		this.uvView.drawFn = (ctx, v) => this.drawUV(ctx, v);
		this.buildTriangle3D();
		this.bind3D();
		this.bindUV();
	}

	start() {
		this.buildControls(this.layout.controls);
		this.applyState({ texture: true });
		this.store.subscribe((s, patch) => this.applyState(patch));
		this.updateGeometry();
	}

	// ---------- escena 3D ----------
	buildTriangle3D() {
		const sc = this.view3d.scene;
		if (this.cfg.grid !== false) sc.add(new THREE.GridHelper(10, 20, 0x2f3542, 0x22262f));
		this.geo = new THREE.BufferGeometry();
		this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
		this.geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(6), 2));
		this.geo.setIndex([0, 1, 2]);
		this.mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
		this.mesh = new THREE.Mesh(this.geo, this.mat);
		sc.add(this.mesh);
		const eg = new THREE.BufferGeometry();
		eg.setAttribute('position', this.geo.attributes.position);
		this.edges = new THREE.LineLoop(eg, new THREE.LineBasicMaterial({ color: 0xffffff }));
		sc.add(this.edges);
		this.markers = [0, 1, 2].map((i) => {
			const m = new THREE.Mesh(
				new THREE.SphereGeometry(0.11, 20, 14),
				new THREE.MeshBasicMaterial({ color: VCOL[i], depthTest: false })
			);
			m.renderOrder = 10;
			sc.add(m);
			return m;
		});
	}

	updateGeometry() {
		const p = this.geo.attributes.position;
		const t = this.geo.attributes.uv;
		for (let i = 0; i < 3; i++) {
			p.setXYZ(i, this.pos[i].x, this.pos[i].y, this.pos[i].z);
			t.setXY(i, this.uv[i][0], this.uv[i][1]);
			this.markers[i].position.copy(this.pos[i]);
		}
		p.needsUpdate = t.needsUpdate = true;
		this.geo.computeBoundingSphere();
		this.geo.computeBoundingBox();
		this.invalidate();
	}

	// Puntos de interés arrastrables en 3D. Devuelve { move(ray) } o null.
	pick3D(e) {
		if (!this.cfg.vertexDrag3D) return null;
		const hit = this.view3d.raycast(e, this.markers)[0];
		if (!hit) return null;
		const i = this.markers.indexOf(hit.object);
		const cam = this.view3d.camera;
		const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(cam.getWorldDirection(new THREE.Vector3()).negate(), this.pos[i]);
		const target = new THREE.Vector3();
		return {
			move: (ray) => {
				if (ray.intersectPlane(plane, target)) {
					this.pos[i].copy(target);
					this.updateGeometry();
					this.onGeometryChanged?.();
				}
			},
		};
	}

	hover3D(e) {
		return !!this.cfg.vertexDrag3D && this.view3d.raycast(e, this.markers).length > 0;
	}

	bind3D() {
		const dom = this.view3d.dom;
		let drag = null;
		this.listen(
			dom,
			'pointerdown',
			(e) => {
				if (e.button !== 0) return;
				drag = this.pick3D(e);
				if (drag) {
					e.stopImmediatePropagation();
					this.view3d.controls.enabled = false;
					dom.setPointerCapture(e.pointerId);
					drag.move(this.view3d.rayFromEvent(e));
				}
			},
			{ capture: true }
		);
		this.listen(dom, 'pointermove', (e) => {
			if (drag) drag.move(this.view3d.rayFromEvent(e));
			else dom.style.cursor = this.hover3D(e) ? 'grab' : '';
		});
		const end = () => {
			drag = null;
			this.view3d.controls.enabled = true;
		};
		this.listen(dom, 'pointerup', end);
		this.listen(dom, 'pointercancel', end);
	}

	// ---------- espacio UV ----------
	nearestHandle(p) {
		let best = -1,
			bd = 16;
		for (let i = 0; i < 3; i++) {
			const [x, y] = this.uvView.toPx(this.uv[i][0], this.uv[i][1]);
			const d = Math.hypot(x - p.x, y - p.y);
			if (d < bd) {
				bd = d;
				best = i;
			}
		}
		return best;
	}

	uvDown(uv, e, p) {
		const i = this.nearestHandle(p);
		if (i < 0) return false;
		this.dragUV = { move: (q) => ((this.uv[i] = [q[0], q[1]]), this.updateGeometry(), this.onGeometryChanged?.()) };
		return true;
	}

	bindUV() {
		const h = this.uvView.handlers;
		h.down = (uv, e, p) => this.uvDown(uv, e, p);
		h.drag = (uv, e, p) => this.dragUV?.move(uv, p);
		h.up = () => (this.dragUV = null);
		h.cursorAt = (uv, p) => (this.nearestHandle(p) >= 0 ? 'grab' : '');
	}

	// Resolución de textura en uso (N×N). Por defecto la fija cfg.texSize; una subclase puede
	// sobreescribir este método para permitir elegirla (ver UVInterpolationLab).
	texSize() {
		return this.cfg.texSize;
	}

	texData() {
		return getTextureData(this.store.state.texture, this.texSize());
	}

	drawUVBase(ctx, v) {
		const s = this.store.state;
		const tex = this.texData();
		const smooth = s.filter === 'linear' ? true : false;
		drawTextureWrapped(ctx, v, tex, s.wrap, { dimOutside: true, smooth: this.texSize() > 64 ? undefined : smooth });
		// solo la región cubierta por el triángulo se ve "encendida"
		ctx.save();
		ctx.fillStyle = 'rgba(8,10,14,0.5)';
		ctx.fillRect(0, 0, v.w, v.h);
		pathTriangle(ctx, v, this.uv);
		ctx.clip();
		drawTextureWrapped(ctx, v, tex, s.wrap, { dimOutside: false, smooth: this.texSize() > 64 ? undefined : smooth });
		ctx.restore();
		drawUnitSquare(ctx, v, 'rgba(255,255,255,0.55)');
	}

	drawUVTriangle(ctx, v) {
		const s = this.store.state;
		pathTriangle(ctx, v, this.uv);
		ctx.lineWidth = 2;
		ctx.strokeStyle = '#fff';
		ctx.stroke();
		for (let i = 0; i < 3; i++) {
			const [x, y] = v.toPx(this.uv[i][0], this.uv[i][1]);
			drawHandle(ctx, x, y, VCOL[i], VNAME[i] + '′');
			if (s.showUV) drawTag(ctx, `${VNAME[i]}′ (${fmt(this.uv[i][0])}, ${fmt(this.uv[i][1])})`, Math.min(v.w - 130, x + 13), Math.max(2, y - 28), { color: VCOL[i] });
		}
	}

	drawUV(ctx, v) {
		this.drawUVBase(ctx, v);
		this.drawUVExtra?.(ctx, v);
		this.drawUVTriangle(ctx, v);
		this.drawUVOverlay?.(ctx, v);
		drawRuler(ctx, v);
	}

	// ---------- controles ----------
	buildControls(el) {
		const p = (this.panel = new ControlPanel(el, this.store));
		p.idea(this.cfg.idea);
		this.buildControlsBody(p);
	}

	commonSelectors(p, { wrap = true, filter = false } = {}) {
		p.select('texture', 'Textura', TEXTURE_KINDS);
		if (wrap)
			p.select('wrap', 'Wrapping', [
				{ value: 'clamp', label: 'Clamp' },
				{ value: 'repeat', label: 'Repeat' },
				{ value: 'mirror', label: 'Mirrored Repeat' },
			]);
		if (filter)
			p.select('filter', 'Filtro', [
				{ value: 'nearest', label: 'Nearest' },
				{ value: 'linear', label: 'Linear' },
			]);
	}

	applyState(patch = {}) {
		const s = this.store.state;
		if (patch.texture || patch.resolution) {
			this.tex3?.dispose();
			this.tex3 = getTextureData(s.texture, this.texSize()).toThree(s.wrap, s.filter);
			this.mat.map = this.tex3;
			this.mat.needsUpdate = true;
		} else if ('wrap' in patch || 'filter' in patch) {
			applyTextureParams(this.tex3, s.wrap, s.filter);
		}
		this.edges.visible = s.wire;
		this.onState?.(patch);
		this.invalidate();
	}

	labels3D() {
		const s = this.store.state;
		for (let i = 0; i < 3; i++) {
			let html = VNAME[i];
			if (s.showXYZ) html += `<small>xyz (${fmt(this.pos[i].x)}, ${fmt(this.pos[i].y)}, ${fmt(this.pos[i].z)})</small>`;
			if (s.showUV) html += `<small>uv (${fmt(this.uv[i][0])}, ${fmt(this.uv[i][1])})</small>`;
			this.view3d.labels.set('v' + i, { html, color: VCOL[i], position: this.pos[i], offset: [12, -14] });
		}
	}

	render() {
		this.labels3D();
		this.renderExtra?.();
		this.view3d.render();
		this.uvView.render();
	}

	dispose() {
		super.dispose();
		this.view3d.dispose();
		this.uvView.dispose();
		this.panel.dispose();
		this.tex3?.dispose();
	}
}
