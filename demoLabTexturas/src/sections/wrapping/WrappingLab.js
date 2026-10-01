import * as THREE from 'three';
import { Lab, onClick } from '../../shared/Lab.js';
import { Scene3DView } from '../../shared/Scene3DView.js';
import { TextureSpaceView } from '../../shared/TextureSpaceView.js';
import { ControlPanel } from '../../layout/ControlPanel.js';
import { createStore } from '../../app/AppState.js';
import { drawRuler, drawTag, drawLine, drawHandle, fmt } from '../../shared/uvDraw.js';
import { WRAP_TEXTURES, readLevel } from './textures.js';
import { WRAP_GEOMETRIES, UV_DOMAIN, CAMERA, buildWrapGeometry, surfacePointsAt } from './geometry.js';

const WRAP_MODES = [
	{ value: 'clamp', label: 'Clamp' },
	{ value: 'repeat', label: 'Repeat' },
	{ value: 'mirror', label: 'Mirrored' },
];
const THREE_WRAP = {
	clamp: THREE.ClampToEdgeWrapping,
	repeat: THREE.RepeatWrapping,
	mirror: THREE.MirroredRepeatWrapping,
};
const WRAP_NAME = { clamp: 'ClampToEdge', repeat: 'Repeat', mirror: 'MirroredRepeat' };
const LEVELS = [64, 128, 256, 512];

const DEFAULTS = {
	geometry: 'plane',
	texture: 'numbered',
	wrapS: 'repeat',
	wrapT: 'repeat',
	offX: 0,
	offY: 0,
	repX: 1,
	repY: 1,
	rot: 0,
	cenX: 0.5,
	cenY: 0.5,
	wire: false,
	base: true,
	probe: null,
};

const TABS = {
	modos: {
		idea: 'El wrapping define qué ocurre cuando las coordenadas UV salen de [0,1] × [0,1]: se fijan al borde, se repiten o se repiten reflejadas. La malla tiene UV fuera de ese cuadrado.',
		stage: 'wrap',
		defaults: {},
	},
	offsetrepeat: {
		idea: 'offset y repeat transforman las coordenadas antes de consultar la textura: el cuadro naranja muestra dónde cae la textura completa dentro del espacio UV de la malla.',
		stage: 'transform',
		defaults: {},
	},
	rotacion: {
		idea: 'rotation gira la textura alrededor de center, un punto configurable del espacio UV. Con center = (0.5, 0.5) la textura gira sobre su propio centro.',
		stage: 'transform',
		pivot: true,
		defaults: { texture: 'arrows', rot: 30 },
	},
	libre: {
		idea: 'Combiná todas las propiedades: primero se transforma el UV (offset, repeat, rotation, center) y después se aplica wrapS / wrapT.',
		stage: null,
		pivot: true,
		defaults: {},
	},
};

const wrapCoord = (x, mode) => {
	if (mode === 'clamp') return x < 0 ? 0 : x > 1 ? 1 : x;
	if (mode === 'repeat') return x - Math.floor(x);
	const t = ((x % 2) + 2) % 2;
	return t > 1 ? 2 - t : t;
};

const wrapNote = (x, mode) => {
	const cell = Math.floor(x);
	if (mode === 'clamp') return x < 0 || x > 1 ? 'fijada al borde' : 'dentro de [0,1]';
	if (mode === 'repeat') return `celda ${cell}`;
	return `celda ${cell}${((cell % 2) + 2) % 2 ? ' (reflejada)' : ''}`;
};

const isIdentity = (m) => [1, 0, 0, 0, 1, 0, 0, 0, 1].every((v, i) => Math.abs(m[i] - v) < 1e-9);

class WrappingLab extends Lab {
	static leftTitle = 'Escena 3D · wrapping real de Three.js';
	static centerTitle = 'Espacio UV extendido';
	static help = [
		'Arrastrá en la escena 3D para orbitar; rueda: zoom.',
		'Clic en el objeto 3D, o clic/arrastre con el botón izquierdo en el espacio UV: coloca el punto de prueba y muestra sus coordenadas paso a paso.',
		'Espacio UV: rueda para zoom y botón derecho para paneo. Celeste = dominio UV de la malla, amarillo = cuadrado [0,1] × [0,1].',
	];

	constructor(layout) {
		super();
		this.cfg = TABS[this.constructor.tabId];
		this.store = createStore({ ...DEFAULTS, ...this.cfg.defaults });
		this.M = new THREE.Matrix3();
		this.Minv = new THREE.Matrix3();
		this.levels = new Map();
		this.buf = document.createElement('canvas');
		this.wrapKey = '';

		this.view3d = new Scene3DView(layout.left, {
			position: CAMERA.plane,
			minDistance: 3,
			maxDistance: 25,
			onInvalidate: this.invalidate,
			tag: 'Arrastrar: orbitar · Rueda: zoom',
		});
		const scene = this.view3d.scene;
		this.textures = {};
		for (const t of WRAP_TEXTURES) {
			const tex = new THREE.CanvasTexture(t.make());
			tex.colorSpace = THREE.SRGBColorSpace;
			tex.anisotropy = 8;
			this.textures[t.value] = tex;
		}
		this.material = new THREE.MeshBasicMaterial({ map: this.textures.numbered, side: THREE.DoubleSide });
		const geometry = buildWrapGeometry('plane');
		this.mesh = new THREE.Mesh(geometry, this.material);
		this.wireMesh = new THREE.Mesh(
			geometry,
			new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.4 })
		);
		scene.add(this.mesh, this.wireMesh);
		this.geoKind = 'plane';
		this.markers = [];
		for (let i = 0; i < 6; i++) {
			const m = new THREE.Mesh(
				new THREE.SphereGeometry(0.08, 16, 12),
				new THREE.MeshBasicMaterial({ color: 0xffd84d, depthTest: false })
			);
			m.renderOrder = 10;
			m.visible = false;
			scene.add(m);
			this.markers.push(m);
		}
		this.vertexMarkers = [0, 1, 2, 3].map(() => {
			const m = new THREE.Mesh(
				new THREE.SphereGeometry(0.075, 16, 12),
				new THREE.MeshBasicMaterial({ color: 0x56c8ff, depthTest: false })
			);
			m.renderOrder = 10;
			m.visible = false;
			scene.add(m);
			return m;
		});

		this.uvView = new TextureSpaceView(layout.center, {
			center: [0.5, 0.5],
			extent: 6.4,
			onInvalidate: this.invalidate,
			tag: 'Clic: punto de prueba · Rueda: zoom · Botón derecho: paneo',
		});
		this.uvView.drawFn = (ctx, v) => this.drawUV(ctx, v);
		this.uvView.cursor = 'crosshair';
		const h = this.uvView.handlers;
		h.down = (uv) => {
			this.store.set({ probe: [uv[0], uv[1]] });
			return true;
		};
		h.drag = (uv) => this.store.set({ probe: [uv[0], uv[1]] });
		onClick(this, this.view3d.dom, (e) => {
			const hit = this.view3d.raycast(e, [this.mesh])[0];
			if (hit?.uv) this.store.set({ probe: [hit.uv.x, hit.uv.y] });
		});

		this.buildControls(layout.controls);
		this.applyState({ geometry: true });
		this.store.subscribe((s, patch) => this.applyState(patch));
	}

	// ---------- controles ----------
	buildControls(el) {
		const p = (this.panel = new ControlPanel(el, this.store));
		const c = this.cfg;
		const tab = this.constructor.tabId;
		p.idea(c.idea);

		if (tab === 'modos' || tab === 'libre') {
			p.title('Objeto y textura');
			p.select('geometry', 'Geometría', WRAP_GEOMETRIES);
			p.select('texture', 'Textura', WRAP_TEXTURES.map(({ value, label }) => ({ value, label })));
		}
		if (tab === 'offsetrepeat') {
			p.title('Textura');
			p.select('texture', 'Textura', WRAP_TEXTURES.map(({ value, label }) => ({ value, label })));
		}
		if (tab === 'modos') {
			p.buttons(
				{ label: 'Preset Repeat', onClick: () => this.store.set({ geometry: 'plane', texture: 'numbered', wrapS: 'repeat', wrapT: 'repeat' }) },
				{ label: 'Preset Clamp', onClick: () => this.store.set({ geometry: 'plane', texture: 'motif', wrapS: 'clamp', wrapT: 'clamp' }) },
				{ label: 'Preset Mirrored', onClick: () => this.store.set({ geometry: 'plane', texture: 'arrows', wrapS: 'mirror', wrapT: 'mirror' }) }
			);
		}
		if (tab === 'modos' || tab === 'libre') {
			p.title('Wrapping');
			p.segmented('wrapS', 'wrapS · eje U', WRAP_MODES);
			p.segmented('wrapT', 'wrapT · eje V', WRAP_MODES);
		}
		if (tab === 'offsetrepeat' || tab === 'libre') {
			p.title('Offset y repeat');
			p.slider('offX', 'offset.x', { min: -2, max: 2, step: 0.05 });
			p.slider('offY', 'offset.y', { min: -2, max: 2, step: 0.05 });
			p.slider('repX', 'repeat.x', { min: 0.25, max: 6, step: 0.25 });
			p.slider('repY', 'repeat.y', { min: 0.25, max: 6, step: 0.25 });
			if (tab === 'offsetrepeat') {
				const rep = (n) => () => this.store.set({ repX: n, repY: n });
				p.buttons({ label: '1 × 1', onClick: rep(1) }, { label: '2 × 2', onClick: rep(2) }, { label: '4 × 4', onClick: rep(4) });
				p.buttons({ label: 'Restablecer offset / repeat', onClick: () => this.store.set({ offX: 0, offY: 0, repX: 1, repY: 1 }) });
			}
		}
		if (tab === 'rotacion' || tab === 'libre') {
			p.title('Rotación y centro');
			p.slider('rot', 'rotation (°)', { min: -180, max: 180, step: 1, digits: 0 });
			p.slider('cenX', 'center.x', { min: 0, max: 1, step: 0.05 });
			p.slider('cenY', 'center.y', { min: 0, max: 1, step: 0.05 });
			const cen = (x, y) => () => this.store.set({ cenX: x, cenY: y });
			p.buttons({ label: '(0,0)', onClick: cen(0, 0) }, { label: '(0.5,0.5)', onClick: cen(0.5, 0.5) }, { label: '(1,1)', onClick: cen(1, 1) });
		}
		p.title('Visualización');
		p.checkbox('wire', 'Mostrar wireframe');
		p.checkbox('base', 'Mostrar cuadrado UV base [0,1]');
		p.buttons({ label: 'Restablecer cámara', onClick: () => this.view3d.resetCamera() });

		const hi = (name, txt) => (c.stage === name ? `<b>${txt}</b>` : txt);
		p.readout().innerHTML = `<span class="k">Orden de la transformación</span><br>
			UV de la malla<br><span class="k">↓</span> ${hi('transform', 'offset · repeat · rotation · center')}<br>
			UV transformado<br><span class="k">↓</span> ${hi('wrap', 'wrapS / wrapT')}<br>
			coordenada final <span class="k">→</span> sampler`;
		this.probeOut = p.readout();
	}

	// ---------- estado ----------
	applyState(patch = {}) {
		const s = this.store.state;
		if (patch.geometry) this.buildGeometry();
		const wrapKey = s.wrapS + s.wrapT;
		for (const tex of Object.values(this.textures)) {
			tex.offset.set(s.offX, s.offY);
			tex.repeat.set(s.repX, s.repY);
			tex.rotation = THREE.MathUtils.degToRad(s.rot);
			tex.center.set(s.cenX, s.cenY);
			if (this.wrapKey !== wrapKey) {
				tex.wrapS = THREE_WRAP[s.wrapS];
				tex.wrapT = THREE_WRAP[s.wrapT];
				tex.needsUpdate = true;
			}
		}
		this.wrapKey = wrapKey;
		const tex = this.textures[s.texture];
		this.material.map = tex;
		tex.updateMatrix();
		this.M.copy(tex.matrix);
		this.Minv.copy(tex.matrix).invert();
		this.wireMesh.visible = s.wire;
		this.updateProbe();
		this.invalidate();
	}

	buildGeometry() {
		const kind = this.store.state.geometry;
		const old = this.mesh.geometry;
		this.mesh.geometry = this.wireMesh.geometry = buildWrapGeometry(kind);
		old.dispose();
		this.geoKind = kind;
		this.view3d.home.position.set(...CAMERA[kind]);
		this.view3d.resetCamera();
		this.updateVertexMarkers();
	}

	// Marca los 4 vértices de la esquina del plano y muestra sus coordenadas UV.
	updateVertexMarkers() {
		const show = this.geoKind === 'plane';
		if (!show) {
			this.vertexMarkers.forEach((m, i) => {
				m.visible = false;
				this.view3d.labels.hide('vtx' + i);
			});
			return;
		}
		const pos = this.mesh.geometry.attributes.position;
		const uv = this.mesh.geometry.attributes.uv;
		let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
		for (let i = 0; i < pos.count; i++) {
			minX = Math.min(minX, pos.getX(i));
			maxX = Math.max(maxX, pos.getX(i));
			minY = Math.min(minY, pos.getY(i));
			maxY = Math.max(maxY, pos.getY(i));
		}
		const wanted = [
			[minX, maxY],
			[maxX, maxY],
			[maxX, minY],
			[minX, minY],
		];
		this.vertexInfo = wanted.map(([x, y]) => {
			for (let i = 0; i < pos.count; i++) {
				if (Math.abs(pos.getX(i) - x) < 1e-6 && Math.abs(pos.getY(i) - y) < 1e-6) {
					return { position: new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)), uv: [uv.getX(i), uv.getY(i)] };
				}
			}
			return null;
		});
		this.vertexInfo.forEach((info, i) => {
			const m = this.vertexMarkers[i];
			m.visible = !!info;
			if (info) m.position.copy(info.position);
		});
	}

	renderVertexLabels() {
		if (!this.vertexInfo) return;
		const offsets = [
			[-16, -14],
			[8, -14],
			[8, 8],
			[-16, 8],
		];
		this.vertexInfo.forEach((info, i) => {
			if (!info) return;
			const [u, v] = info.uv;
			this.view3d.labels.set('vtx' + i, {
				html: `<small>uv (${fmt(u)}, ${fmt(v)})</small>`,
				color: '#56c8ff',
				position: info.position,
				offset: offsets[i],
			});
		});
	}

	updateProbe() {
		const p = this.store.state.probe;
		const pts = p ? surfacePointsAt(this.mesh.geometry, p[0], p[1], this.markers.length) : [];
		this.markers.forEach((m, i) => {
			m.visible = i < pts.length;
			if (m.visible) m.position.copy(pts[i]);
		});
		if (!p) {
			this.probeOut.innerHTML = '<span class="k">Clic en el objeto 3D o en el espacio UV para seguir un punto por toda la transformación.</span>';
			return;
		}
		const s = this.store.state;
		const [u, v] = p;
		const [tu, tv] = this.transform(u, v);
		const fu = wrapCoord(tu, s.wrapS);
		const fv = wrapCoord(tv, s.wrapT);
		const dom = UV_DOMAIN[this.geoKind];
		const inside = u >= dom.u[0] && u <= dom.u[1] && v >= dom.v[0] && v <= dom.v[1];
		this.probeOut.innerHTML = `<span class="k">Punto de prueba</span><br>
			<span class="k">UV de la malla</span> <code>(${fmt(u)}, ${fmt(v)})</code><br>
			<span class="k">UV transformado</span> <code>(${fmt(tu)}, ${fmt(tv)})</code><br>
			<span class="k">Tras wrapping</span> <code>(${fmt(fu)}, ${fmt(fv)})</code><br>
			<span class="k">U:</span> ${WRAP_NAME[s.wrapS]}, ${wrapNote(tu, s.wrapS)}<br>
			<span class="k">V:</span> ${WRAP_NAME[s.wrapT]}, ${wrapNote(tv, s.wrapT)}
			${inside ? '' : '<br><span class="k">Fuera del dominio de la malla: no hay punto en el objeto 3D.</span>'}`;
	}

	transform(u, v) {
		const e = this.M.elements;
		return [e[0] * u + e[3] * v + e[6], e[1] * u + e[4] * v + e[7]];
	}

	// ---------- vista UV ----------
	level(N) {
		const kind = this.store.state.texture;
		const key = `${kind}:${N}`;
		let l = this.levels.get(key);
		if (!l) {
			l = new Uint32Array(readLevel(this.textures[kind].image, N).buffer);
			this.levels.set(key, l);
		}
		return l;
	}

	// Muestrea (por CPU) la textura con la misma cadena que usa la GPU: transformación y luego wrapping.
	paintImage(ctx, view) {
		const s = this.store.state;
		const block = view.w * view.h > 600000 ? 2 : 1;
		const W = Math.ceil(view.w / block);
		const H = Math.ceil(view.h / block);
		if (this.buf.width !== W || this.buf.height !== H) {
			this.buf.width = W;
			this.buf.height = H;
			this.img = new ImageData(W, H);
			this.dst = new Uint32Array(this.img.data.buffer);
		}
		const need = view.scale / block / Math.max(s.repX, s.repY);
		const N = LEVELS.find((n) => n >= need) || LEVELS[LEVELS.length - 1];
		const src = this.level(N);
		const e = this.M.elements;
		const [a, b, c, d, f, g] = [e[0], e[3], e[6], e[1], e[4], e[7]];
		const dst = this.dst;
		const wS = s.wrapS;
		const wT = s.wrapT;
		let o = 0;
		for (let y = 0; y < H; y++) {
			const v = view.cy + (view.h / 2 - (y + 0.5) * block) / view.scale;
			for (let x = 0; x < W; x++, o++) {
				const u = view.cx + ((x + 0.5) * block - view.w / 2) / view.scale;
				const tu = wrapCoord(a * u + b * v + c, wS);
				const tv = wrapCoord(d * u + f * v + g, wT);
				const i = Math.min(N - 1, (tu * N) | 0);
				const j = Math.min(N - 1, ((1 - tv) * N) | 0);
				dst[o] = src[j * N + i];
			}
		}
		this.buf.getContext('2d').putImageData(this.img, 0, 0);
		ctx.imageSmoothingEnabled = block > 1;
		ctx.drawImage(this.buf, 0, 0, W * block, H * block);
	}

	drawUV(ctx, view) {
		const s = this.store.state;
		this.paintImage(ctx, view);
		const dom = UV_DOMAIN[this.geoKind];
		const { u0, u1, v0, v1 } = view.visibleRange();
		const px = (u, v) => view.toPx(u, v);

		// Fuera del dominio de la malla se atenúa, pero se sigue viendo el resultado del wrapping.
		const [dx0, dy0] = px(dom.u[0], dom.v[1]);
		const [dx1, dy1] = px(dom.u[1], dom.v[0]);
		ctx.fillStyle = 'rgba(8,10,14,0.5)';
		ctx.beginPath();
		ctx.rect(0, 0, view.w, view.h);
		ctx.rect(dx0, dy0, dx1 - dx0, dy1 - dy0);
		ctx.fill('evenodd');

		ctx.save();
		ctx.strokeStyle = 'rgba(255,255,255,0.32)';
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (let i = Math.ceil(u0); i <= u1; i++) {
			const x = px(i, 0)[0];
			ctx.moveTo(x, 0);
			ctx.lineTo(x, view.h);
		}
		for (let j = Math.ceil(v0); j <= v1; j++) {
			const y = px(0, j)[1];
			ctx.moveTo(0, y);
			ctx.lineTo(view.w, y);
		}
		ctx.stroke();
		ctx.strokeStyle = '#56c8ff';
		ctx.lineWidth = 2;
		ctx.strokeRect(dx0, dy0, dx1 - dx0, dy1 - dy0);
		ctx.restore();
		drawTag(ctx, `Dominio UV de la malla: u ∈ [${dom.u}] · v ∈ [${dom.v}]`, Math.max(dx0, 30) + 6, Math.max(dy0, 4) + 6, { color: '#56c8ff' });

		if (s.base) {
			const [bx, by] = px(0, 1);
			ctx.save();
			ctx.strokeStyle = '#ffd84d';
			ctx.lineWidth = 3;
			ctx.strokeRect(bx, by, view.scale, view.scale);
			ctx.restore();
			drawTag(ctx, '[0,1] × [0,1]', bx + 4, by + 4, { color: '#ffd84d' });
		}

		if (!isIdentity(this.M.elements)) this.drawFootprint(ctx, view);
		if (this.cfg.pivot) this.drawPivot(ctx, view);
		this.drawProbe(ctx, view);
		drawRuler(ctx, view);
	}

	// Cuadrado [0,1]² de la textura llevado al espacio UV de la malla con la inversa de la transformación.
	drawFootprint(ctx, view) {
		const e = this.Minv.elements;
		const map = (u, v) => view.toPx(e[0] * u + e[3] * v + e[6], e[1] * u + e[4] * v + e[7]);
		const pts = [map(0, 0), map(1, 0), map(1, 1), map(0, 1)];
		ctx.save();
		ctx.strokeStyle = '#ff9f43';
		ctx.lineWidth = 2.5;
		ctx.setLineDash([8, 5]);
		ctx.beginPath();
		pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
		ctx.closePath();
		ctx.stroke();
		ctx.restore();
		drawHandle(ctx, pts[0][0], pts[0][1], '#ff9f43', '', { r: 5, ring: false });
		drawTag(ctx, 'Textura transformada (origen ●)', pts[0][0] + 8, pts[0][1] - 22, { color: '#ff9f43' });
	}

	drawPivot(ctx, view) {
		const s = this.store.state;
		const [x, y] = view.toPx(s.cenX, s.cenY);
		const r = view.scale * 0.4;
		const rad = THREE.MathUtils.degToRad(s.rot);
		if (s.rot !== 0) {
			ctx.save();
			ctx.strokeStyle = '#ff5cf0';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.arc(x, y, r, 0, -rad, rad > 0);
			ctx.stroke();
			ctx.restore();
			drawLine(ctx, [x, y], [x + r * 1.15, y], 'rgba(255,92,240,0.6)', 1.5, [4, 4]);
			drawLine(ctx, [x, y], [x + Math.cos(-rad) * r * 1.15, y + Math.sin(-rad) * r * 1.15], '#ff5cf0', 2);
			drawTag(ctx, `${s.rot}°`, x + Math.cos(-rad / 2) * (r + 14), y + Math.sin(-rad / 2) * (r + 14) - 8, { color: '#ff5cf0' });
		}
		drawHandle(ctx, x, y, '#ff5cf0', '', { r: 6 });
		drawTag(ctx, `center (${fmt(s.cenX)}, ${fmt(s.cenY)})`, x + 10, y + 8, { color: '#ff5cf0' });
	}

	drawProbe(ctx, view) {
		const p = this.store.state.probe;
		if (!p) return;
		const [x, y] = view.toPx(p[0], p[1]);
		drawHandle(ctx, x, y, '#ffd84d', 'P', { r: 9, textColor: '#111' });
		const [tu, tv] = this.transform(p[0], p[1]);
		drawTag(ctx, [`malla (${fmt(p[0])}, ${fmt(p[1])})`, `transf. (${fmt(tu)}, ${fmt(tv)})`], x + 13, y + 10, { color: '#ffd84d' });
	}

	render() {
		this.renderVertexLabels();
		this.view3d.render();
		this.uvView.render();
	}

	dispose() {
		super.dispose();
		this.view3d.dispose();
		this.uvView.dispose();
		this.panel.dispose();
		Object.values(this.textures).forEach((t) => t.dispose());
	}
}

export class WrappingModesLab extends WrappingLab {
	static tabId = 'modos';
}
export class OffsetRepeatLab extends WrappingLab {
	static tabId = 'offsetrepeat';
	static help = [...WrappingLab.help, 'Modificá offset y repeat: el cuadro naranja es la textura completa dentro del espacio UV de la malla.'];
}
export class RotationCenterLab extends WrappingLab {
	static tabId = 'rotacion';
	static help = [...WrappingLab.help, 'El punto magenta es center: el pivote de la rotación en el espacio UV.'];
}
export class FreeComparisonLab extends WrappingLab {
	static tabId = 'libre';
}
