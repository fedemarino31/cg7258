import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { Lab, onClick } from '../../shared/Lab.js';
import { Scene3DView } from '../../shared/Scene3DView.js';
import { TextureSpaceView } from '../../shared/TextureSpaceView.js';
import { ControlPanel } from '../../layout/ControlPanel.js';
import { createStore } from '../../app/AppState.js';
import { VOLUME_KINDS, VOLUME_VS, VOLUME_FS, createVolumeTexture, drawSliceToCanvas, volumeColor } from '../../shared/volumes.js';
import { rgbCss } from '../../shared/textures.js';
import { makeTeapot } from '../../shared/geometries.js';
import { drawRuler, drawUnitSquare, drawTag, fmt } from '../../shared/uvDraw.js';

const AXIS = { U: '#ff8a5c', V: '#59d38c', W: '#5ea8ff' };

const OBJECT_KINDS = [
	{ value: 'rock', label: 'Piedra irregular' },
	{ value: 'teapot', label: 'Tetera' },
];

function makeDeformedSphere() {
	const g = new THREE.IcosahedronGeometry(0.62, 5);
	const p = g.attributes.position;
	const v = new THREE.Vector3();
	for (let i = 0; i < p.count; i++) {
		v.fromBufferAttribute(p, i);
		const n = 1 + 0.18 * Math.sin(v.x * 5 + 1) * Math.sin(v.y * 4) + 0.12 * Math.sin(v.z * 6 + v.x * 3);
		v.multiplyScalar(n);
		p.setXYZ(i, v.x, v.y, v.z);
	}
	g.computeVertexNormals();
	return g;
}

export class Texture3DLab extends Lab {
	static leftTitle = 'Escena 3D · objeto dentro del volumen';
	static centerTitle = 'Espacio de textura · UVW';
	static centerStack = true;
	static help = [
		'Arrastrá los ejes del gizmo para mover, rotar o escalar el objeto dentro del cubo: la textura queda fija en el espacio UVW.',
		'Las franjas magenta indican partes del objeto que salen del volumen (UVW fuera de [0,1]).',
		'Pasá el puntero sobre el objeto (clic para fijar) para ver su coordenada (u,v,w).',
		'El slider Corte W desplaza el plano en ambas vistas; abajo se ve de frente.',
	];

	constructor(layout) {
		super();
		this.store = createStore({
			volume: 'bands',
			object: 'rock',
			cutW: 0.5,
			transform: 'translate',
			showCube: true,
			showPlane: true,
			showPoint: true,
			voxels: false,
			uvw: null,
			locked: false,
		});
		this.localPoint = null;
		this.volTex = null;
		this.matsToUpdate = [];
		this.geos = { rock: makeDeformedSphere(), teapot: makeTeapot(1.05, 10) };

		this.left = new Scene3DView(layout.left, {
			position: [3.4, 2.4, 4.4],
			minDistance: 2.5,
			maxDistance: 12,
			onInvalidate: this.invalidate,
			tag: 'Arrastrar: orbitar · gizmo: transformar objeto',
		});
		this.buildLeft();

		const cv = layout.addCenterView(3);
		this.right = new Scene3DView(cv, {
			position: [3.4, 2.4, 4.4],
			minDistance: 2.5,
			maxDistance: 12,
			onInvalidate: this.invalidate,
			tag: 'Cubo UVW (u→x, v→y, w→z)',
		});
		this.buildRight();

		const sv = layout.addCenterView(2);
		this.slice = new TextureSpaceView(sv, { center: [0.5, 0.5], extent: 1.3, onInvalidate: this.invalidate, tag: 'Corte a w constante (vista frontal)' });
		this.sliceCanvas = document.createElement('canvas');
		this.sliceCanvas.width = this.sliceCanvas.height = 128;
		this.slice.drawFn = (ctx, v) => this.drawSlice(ctx, v);

		this.bindEvents();
		this.buildControls(layout.controls);
		this.applyState({ volume: true });
		this.store.subscribe((s, patch) => this.applyState(patch));
	}

	volumeMaterial({ alpha = 1, shade = 1, hatch = 1, side = THREE.FrontSide, depthWrite = true, depthTest = true }) {
		const m = new THREE.ShaderMaterial({
			vertexShader: VOLUME_VS,
			fragmentShader: VOLUME_FS,
			uniforms: {
				uVol: { value: null },
				uAlpha: { value: alpha },
				uShade: { value: shade },
				uHatch: { value: hatch },
			},
			transparent: alpha < 1,
			side,
			depthWrite,
			depthTest,
		});
		this.matsToUpdate.push(m);
		return m;
	}

	buildLeft() {
		const sc = this.left.scene;
		this.obj = new THREE.Mesh(this.geos[this.store.state.object], this.volumeMaterial({}));
		this.obj.material.side = THREE.DoubleSide;
		sc.add(this.obj);

		this.cubeL = new THREE.Group();
		this.cubeL.add(
			new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2, 2, 2)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })),
			new THREE.Mesh(
				new THREE.BoxGeometry(2, 2, 2),
				new THREE.MeshBasicMaterial({ color: 0x88aaff, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide })
			)
		);
		sc.add(this.cubeL);
		this.addAxes(this.left);

		this.planeL = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.volumeMaterial({ alpha: 0.85, shade: 0, hatch: 0, side: THREE.DoubleSide, depthWrite: false }));
		sc.add(this.planeL);
		this.planeFrameL = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(2, 2)), new THREE.LineBasicMaterial({ color: 0xffd84d }));
		sc.add(this.planeFrameL);

		this.markerL = this.makeMarker();
		sc.add(this.markerL);

		this.tc = new TransformControls(this.left.camera, this.left.dom);
		this.tc.setSize(0.75);
		this.tc.attach(this.obj);
		this.tc.addEventListener('dragging-changed', (e) => (this.left.controls.enabled = !e.value));
		this.tc.addEventListener('change', () => {
			this.updatePointFromLocal();
			this.invalidate();
		});
		sc.add(this.tc);
		this.own(this.tc);
	}

	makeMarker() {
		const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd84d, depthTest: false }));
		m.renderOrder = 10;
		return m;
	}

	addAxes(view) {
		const o = new THREE.Vector3(-1, -1, -1);
		const dirs = [
			['U', new THREE.Vector3(1, 0, 0)],
			['V', new THREE.Vector3(0, 1, 0)],
			['W', new THREE.Vector3(0, 0, 1)],
		];
		for (const [name, d] of dirs) {
			const a = new THREE.ArrowHelper(d, o, 2.4, new THREE.Color(AXIS[name]), 0.14, 0.07);
			a.line.material.depthTest = false;
			a.cone.material.depthTest = false;
			view.scene.add(a);
			view.labels.set('ax' + name, { html: name, color: AXIS[name], position: o.clone().addScaledVector(d, 2.55), offset: [4, -8] });
		}
	}

	buildRight() {
		const sc = this.right.scene;
		this.cubeR = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), this.volumeMaterial({ alpha: 0.3, shade: 0.4, hatch: 0, side: THREE.DoubleSide, depthWrite: false }));
		sc.add(this.cubeR);
		sc.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2, 2, 2)), new THREE.LineBasicMaterial({ color: 0xffffff })));
		this.addAxes(this.right);
		const corners = [
			['(0,0,0)', [-1, -1, -1]],
			['(1,1,1)', [1, 1, 1]],
		];
		corners.forEach(([t, p], i) =>
			this.right.labels.set('c' + i, { html: t, color: '#cfd5e0', position: new THREE.Vector3(...p), offset: [6, i ? -14 : 6] })
		);
		this.planeR = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.volumeMaterial({ alpha: 1, shade: 0, hatch: 0, side: THREE.DoubleSide, depthTest: false }));
		this.planeR.renderOrder = 5;
		sc.add(this.planeR);
		this.planeFrameR = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(2, 2)), new THREE.LineBasicMaterial({ color: 0xffd84d, depthTest: false }));
		this.planeFrameR.renderOrder = 6;
		sc.add(this.planeFrameR);
		this.markerR = this.makeMarker();
		this.markerR.scale.setScalar(1.3);
		sc.add(this.markerR);

		const N = 8;
		this.voxels = new THREE.InstancedMesh(
			new THREE.BoxGeometry((2 / N) * 0.8, (2 / N) * 0.8, (2 / N) * 0.8),
			new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6, depthWrite: false }),
			N * N * N
		);
		this.voxelN = N;
		sc.add(this.voxels);
	}

	bindEvents() {
		const dom = this.left.dom;
		const pick = (e) => {
			if (this.tc.dragging || this.tc.axis) return null;
			const hit = this.left.raycast(e, [this.obj])[0];
			return hit ? this.obj.worldToLocal(hit.point.clone()) : null;
		};
		this.listen(dom, 'pointermove', (e) => {
			if (this.store.state.locked) return;
			const p = pick(e);
			if (p) {
				this.localPoint = p;
				this.updatePointFromLocal();
			}
		});
		onClick(this, dom, (e) => {
			const s = this.store.state;
			if (s.locked) return this.store.set({ locked: false });
			const p = pick(e);
			if (p) {
				this.localPoint = p;
				this.updatePointFromLocal();
				this.store.set({ locked: true });
			}
		});
	}

	updatePointFromLocal() {
		if (!this.localPoint) return;
		this.obj.updateMatrixWorld();
		const w = this.obj.localToWorld(this.localPoint.clone());
		this.store.set({ uvw: [w.x * 0.5 + 0.5, w.y * 0.5 + 0.5, w.z * 0.5 + 0.5] });
	}

	buildControls(el) {
		const p = (this.panel = new ControlPanel(el, this.store));
		p.idea('Una textura 3D contiene datos en un volumen. Cada punto de la superficie consulta el volumen usando tres coordenadas: U, V y W.');
		p.select('volume', 'Volumen', VOLUME_KINDS);
		p.select('object', 'Objeto', OBJECT_KINDS);
		p.slider('cutW', 'Corte W', { min: 0, max: 1, step: 0.01 });
		p.segmented('transform', 'Transformación del objeto', [
			{ value: 'translate', label: 'Mover' },
			{ value: 'rotate', label: 'Rotar' },
			{ value: 'scale', label: 'Escalar' },
		]);
		p.title('Visualización');
		p.checkbox('showCube', 'Mostrar cubo UVW');
		p.checkbox('showPlane', 'Mostrar plano de corte');
		p.checkbox('showPoint', 'Mostrar punto de consulta');
		p.checkbox('voxels', 'Mostrar voxels');
		p.buttons({
			label: 'Centrar objeto',
			onClick: () => {
				this.obj.position.set(0, 0, 0);
				this.obj.rotation.set(0, 0, 0);
				this.obj.scale.set(1, 1, 1);
				this.updatePointFromLocal();
				this.invalidate();
			},
		});
		this.read = p.readout();
	}

	applyState(patch = {}) {
		const s = this.store.state;
		if (patch.volume) {
			this.volTex?.dispose();
			this.volTex = createVolumeTexture(s.volume);
			this.matsToUpdate.forEach((m) => (m.uniforms.uVol.value = this.volTex));
			this.updateVoxelColors();
			this.sliceDirty = true;
		}
		if ('voxels' in patch || patch.volume) {
			const f = s.voxels ? THREE.NearestFilter : THREE.LinearFilter;
			this.volTex.minFilter = this.volTex.magFilter = f;
			this.volTex.needsUpdate = true;
		}
		if ('cutW' in patch) this.sliceDirty = true;
		if (patch.object) {
			this.obj.geometry = this.geos[s.object];
			this.obj.position.set(0, 0, 0);
			this.obj.rotation.set(0, 0, 0);
			this.obj.scale.set(1, 1, 1);
			this.localPoint = null;
			this.store.state.uvw = null;
		}
		this.tc.setMode(s.transform);
		const z = s.cutW * 2 - 1;
		for (const m of [this.planeL, this.planeFrameL, this.planeR, this.planeFrameR]) {
			m.position.z = z;
		}
		this.planeL.visible = this.planeFrameL.visible = s.showPlane;
		this.planeR.visible = this.planeFrameR.visible = s.showPlane;
		this.cubeL.visible = s.showCube;
		this.cubeR.visible = s.showCube;
		this.voxels.visible = s.voxels;
		const showP = s.showPoint && !!s.uvw;
		this.markerL.visible = showP;
		this.markerR.visible = showP;
		if (s.uvw) {
			this.markerR.position.set(s.uvw[0] * 2 - 1, s.uvw[1] * 2 - 1, s.uvw[2] * 2 - 1);
			this.markerL.position.copy(this.markerR.position);
		}
		this.invalidate();
	}

	updateVoxelColors() {
		const N = this.voxelN;
		const m = new THREE.Matrix4();
		const c = new THREE.Color();
		let i = 0;
		for (let z = 0; z < N; z++)
			for (let y = 0; y < N; y++)
				for (let x = 0; x < N; x++) {
					m.setPosition(((x + 0.5) / N) * 2 - 1, ((y + 0.5) / N) * 2 - 1, ((z + 0.5) / N) * 2 - 1);
					this.voxels.setMatrixAt(i, m);
					const col = volumeColor(this.store.state.volume, (x + 0.5) / N, (y + 0.5) / N, (z + 0.5) / N);
					c.setRGB(col[0] / 255, col[1] / 255, col[2] / 255, THREE.SRGBColorSpace);
					this.voxels.setColorAt(i, c);
					i++;
				}
		this.voxels.instanceMatrix.needsUpdate = true;
		this.voxels.instanceColor.needsUpdate = true;
	}

	drawSlice(ctx, v) {
		const s = this.store.state;
		if (this.sliceDirty) {
			drawSliceToCanvas(this.sliceCanvas, s.volume, s.cutW);
			this.sliceDirty = false;
		}
		const [x, y] = v.toPx(0, 1);
		ctx.imageSmoothingEnabled = s.voxels ? false : true;
		ctx.drawImage(this.sliceCanvas, x, y, v.scale, v.scale);
		drawUnitSquare(ctx, v);
		if (s.uvw && s.showPoint) {
			const [px, py] = v.toPx(s.uvw[0], s.uvw[1]);
			const near = Math.abs(s.uvw[2] - s.cutW) < 0.03;
			ctx.beginPath();
			ctx.arc(px, py, 7, 0, Math.PI * 2);
			ctx.lineWidth = 2;
			ctx.strokeStyle = '#000';
			if (near) {
				ctx.fillStyle = '#ffd84d';
				ctx.fill();
			}
			ctx.stroke();
			ctx.strokeStyle = '#ffd84d';
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.arc(px, py, 9, 0, Math.PI * 2);
			ctx.stroke();
			drawTag(ctx, `(${fmt(s.uvw[0])}, ${fmt(s.uvw[1])}) · w=${fmt(s.uvw[2])}${near ? '' : ' (fuera del corte)'}`, Math.min(v.w - 210, px + 12), Math.max(4, py - 26), { color: '#ffd84d' });
		}
		drawTag(ctx, `Corte w = ${fmt(s.cutW)}`, v.w - 8, 34, { color: '#ffd84d', align: 'right' });
		drawRuler(ctx, v);
	}

	render() {
		const s = this.store.state;
		const pos = this.markerL.position;
		this.left.labels.set('pt', {
			html: s.uvw ? `(u,v,w) = (${fmt(s.uvw[0])}, ${fmt(s.uvw[1])}, ${fmt(s.uvw[2])})` : '',
			color: '#ffd84d',
			position: pos,
			visible: s.showPoint && !!s.uvw,
		});
		this.right.labels.set('pt', {
			html: s.uvw ? `(${fmt(s.uvw[0])}, ${fmt(s.uvw[1])}, ${fmt(s.uvw[2])})` : '',
			color: '#ffd84d',
			position: this.markerR.position,
			visible: s.showPoint && !!s.uvw,
		});
		this.left.render();
		this.right.render();
		this.slice.render();
		this.updateReadout();
	}

	updateReadout() {
		const s = this.store.state;
		let html;
		if (!s.uvw) html = '<span class="k">Pasá el puntero sobre el objeto para consultar el volumen.</span>';
		else {
			const inside = s.uvw.every((c) => c >= 0 && c <= 1);
			const c = volumeColor(s.volume, ...s.uvw.map((x) => Math.min(1, Math.max(0, x))));
			html = `<span class="k">u</span> ${fmt(s.uvw[0], 3)} &nbsp;<span class="k">v</span> ${fmt(s.uvw[1], 3)} &nbsp;<span class="k">w</span> ${fmt(s.uvw[2], 3)}<br>
				<span class="sw" style="background:${rgbCss(c)}"></span>rgb(${c.map((x) => Math.round(x)).join(', ')})<br>
				<span class="k">${inside ? '' : 'Fuera del volumen: se usa el borde (clamp). '}${s.locked ? 'Punto fijado (clic para liberar)' : 'Clic para fijar el punto'}</span>`;
		}
		if (html !== this._html) {
			this.read.innerHTML = html;
			this._html = html;
		}
	}

	dispose() {
		super.dispose();
		this.left.dispose();
		this.right.dispose();
		this.slice.dispose();
		this.panel.dispose();
		this.volTex?.dispose();
		Object.values(this.geos).forEach((g) => g.dispose());
	}
}
