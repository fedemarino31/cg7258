import * as THREE from 'three';
import { Lab, onClick } from '../../shared/Lab.js';
import { Scene3DView } from '../../shared/Scene3DView.js';
import { TextureSpaceView } from '../../shared/TextureSpaceView.js';
import { ControlPanel } from '../../layout/ControlPanel.js';
import { createStore } from '../../app/AppState.js';
import { FACES, ENV_KINDS, ENV_VS, ENV_FS, createEnvFaces, createCubeTexture, cubeLookup, faceColor } from '../../shared/cubemaps.js';
import { makeTeapot, hitNormalWorld } from '../../shared/geometries.js';
import { rgbCss } from '../../shared/textures.js';
import { drawTag, fmt } from '../../shared/uvDraw.js';

const ENV_HALF = 9;
const CROSS = [
	[2, 1], // +X
	[0, 1], // -X
	[1, 0], // +Y
	[1, 2], // -Y
	[1, 1], // +Z
	[3, 1], // -Z
];

export class CubemapLab extends Lab {
	static leftTitle = 'Escena 3D · objeto reflectante';
	static centerTitle = 'Espacio de textura · cubemap desplegado';
	static help = [
		'Pasá el puntero sobre el objeto: se calcula el vector de reflexión r = reflect(vista, normal).',
		'La dirección r elige una de las 6 caras y una posición (s,t) dentro de ella: se marca en la cruz.',
		'Orbitá la cámara: el vector de reflexión cambia aunque el punto sea el mismo.',
		'Clic fija/libera el punto sobre el objeto.',
	];

	constructor(layout) {
		super();
		this.store = createStore({
			object: 'sphere',
			env: 'faces',
			roughness: 0.05,
			metalness: 1,
			showDir: true,
			showEnv: true,
			showNames: true,
			locked: false,
		});
		this.geos = {
			sphere: new THREE.SphereGeometry(1.4, 64, 32),
			knot: new THREE.TorusKnotGeometry(1, 0.38, 200, 32),
			teapot: makeTeapot(3, 14),
		};
		this.pick = null;
		this.query = null;

		this.view3d = new Scene3DView(layout.left, {
			position: [3.5, 1.8, 5],
			minDistance: 3,
			maxDistance: 8,
			panLimit: 1,
			onInvalidate: this.invalidate,
			tag: 'Arrastrar: orbitar · Rueda: zoom',
		});
		const sc = this.view3d.scene;
		this.mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 1 });
		this.mesh = new THREE.Mesh(this.geos.sphere, this.mat);
		sc.add(this.mesh);

		this.envMat = new THREE.ShaderMaterial({
			vertexShader: ENV_VS,
			fragmentShader: ENV_FS,
			uniforms: { uEnv: { value: null }, uAlpha: { value: 0.6 } },
			side: THREE.BackSide,
			transparent: true,
			depthWrite: false,
		});
		this.envBox = new THREE.Mesh(new THREE.BoxGeometry(ENV_HALF * 2, ENV_HALF * 2, ENV_HALF * 2), this.envMat);
		this.envBox.renderOrder = -1;
		sc.add(this.envBox);

		this.arrowIn = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 1.4, 0xffffff, 0.2, 0.1);
		this.arrowOut = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 2.2, 0xffd84d, 0.25, 0.12);
		for (const a of [this.arrowIn, this.arrowOut]) {
			a.line.material.depthTest = a.cone.material.depthTest = false;
			a.renderOrder = 10;
			sc.add(a);
		}
		const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
		this.ray = new THREE.Line(lineGeo, new THREE.LineDashedMaterial({ color: 0xffd84d, dashSize: 0.3, gapSize: 0.2, transparent: true, opacity: 0.7 }));
		sc.add(this.ray);
		this.dot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd84d, depthTest: false }));
		this.dot.renderOrder = 11;
		sc.add(this.dot);
		this.envDot = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd84d }));
		sc.add(this.envDot);

		FACES.forEach((f, i) => {
			const p = new THREE.Vector3();
			p.setComponent(i >> 1, i % 2 ? -ENV_HALF * 0.9 : ENV_HALF * 0.9);
			this.view3d.labels.set('f' + i, { html: f, color: '#cfd5e0', position: p });
		});

		this.crossView = new TextureSpaceView(layout.center, { onInvalidate: this.invalidate });
		this.crossView.resetBtn.style.display = 'none';
		this.crossView.drawFn = (ctx, v) => this.drawCross(ctx, v);

		this.bindEvents();
		this.buildControls(layout.controls);
		this.applyState({ env: true, object: true });
		this.store.subscribe((s, patch) => this.applyState(patch));
		this.pickDefault();
	}

	bindEvents() {
		const dom = this.view3d.dom;
		const doPick = (e) => {
			const hit = this.view3d.raycast(e, [this.mesh])[0];
			if (hit) this.pick = { p: hit.point.clone(), n: hitNormalWorld(hit) };
			return !!hit;
		};
		this.listen(dom, 'pointermove', (e) => {
			if (!this.store.state.locked && doPick(e)) this.invalidate();
		});
		onClick(this, dom, (e) => {
			if (this.store.state.locked) this.store.set({ locked: false });
			else if (doPick(e)) this.store.set({ locked: true });
		});
	}

	pickDefault() {
		this.mesh.updateMatrixWorld();
		const cam = this.view3d.camera.position;
		this.view3d.raycaster.set(cam, cam.clone().negate().normalize());
		const hit = this.view3d.raycaster.intersectObject(this.mesh)[0];
		if (hit) this.pick = { p: hit.point.clone(), n: hitNormalWorld(hit) };
		this.invalidate();
	}

	buildControls(el) {
		const p = (this.panel = new ControlPanel(el, this.store));
		p.idea('Un cubemap se consulta con una dirección 3D. Esa dirección determina cuál de las seis caras se utiliza y en qué punto se obtiene el color.');
		p.select('object', 'Objeto', [
			{ value: 'sphere', label: 'Esfera' },
			{ value: 'knot', label: 'Nudo toroidal' },
			{ value: 'teapot', label: 'Tetera' },
		]);
		p.select('env', 'Entorno', ENV_KINDS);
		p.slider('roughness', 'Roughness', { min: 0, max: 1, step: 0.01 });
		p.slider('metalness', 'Metalness', { min: 0, max: 1, step: 0.01 });
		p.title('Visualización');
		p.checkbox('showDir', 'Mostrar dirección de consulta');
		p.checkbox('showEnv', 'Mostrar cubo de entorno');
		p.checkbox('showNames', 'Mostrar nombre de las caras');
		this.read = p.readout();
	}

	applyState(patch = {}) {
		const s = this.store.state;
		if (patch.env) {
			this.faces = createEnvFaces(s.env);
			this.cube?.dispose();
			this.cube = createCubeTexture(this.faces);
			this.mat.envMap = this.cube;
			this.mat.needsUpdate = true;
			this.envMat.uniforms.uEnv.value = this.cube;
		}
		if (patch.object && this.mesh.geometry !== this.geos[s.object]) {
			this.mesh.geometry = this.geos[s.object];
			this.pickDefault();
		}
		this.mat.roughness = s.roughness;
		this.mat.metalness = s.metalness;
		this.envBox.visible = s.showEnv;
		this.invalidate();
	}

	crossRects(v) {
		const f = Math.min(v.w / 4.3, v.h / 3.3);
		const ox = (v.w - f * 4) / 2;
		const oy = (v.h - f * 3) / 2;
		return { f, rect: (i) => [ox + CROSS[i][0] * f, oy + CROSS[i][1] * f] };
	}

	drawCross(ctx, v) {
		const s = this.store.state;
		const { f, rect } = this.crossRects(v);
		const q = this.query;
		ctx.imageSmoothingEnabled = true;
		FACES.forEach((_, i) => {
			const [x, y] = rect(i);
			ctx.drawImage(this.faces[i], x, y, f, f);
			if (q && q.face !== i) {
				ctx.fillStyle = 'rgba(8,10,14,0.55)';
				ctx.fillRect(x, y, f, f);
			}
			ctx.strokeStyle = q && q.face === i ? '#ffd84d' : 'rgba(255,255,255,0.7)';
			ctx.lineWidth = q && q.face === i ? 3 : 1;
			ctx.strokeRect(x, y, f, f);
			if (s.showNames) {
				ctx.font = 'bold 14px sans-serif';
				ctx.textAlign = 'left';
				ctx.textBaseline = 'top';
				ctx.fillStyle = 'rgba(10,12,16,0.75)';
				ctx.fillRect(x + 4, y + 4, 30, 20);
				ctx.fillStyle = '#fff';
				ctx.fillText(FACES[i], x + 8, y + 7);
			}
		});
		if (q) {
			const [x, y] = rect(q.face);
			const px = x + q.s * f;
			const py = y + q.t * f;
			ctx.strokeStyle = '#ffd84d';
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.moveTo(px - 14, py);
			ctx.lineTo(px + 14, py);
			ctx.moveTo(px, py - 14);
			ctx.lineTo(px, py + 14);
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(px, py, 7, 0, Math.PI * 2);
			ctx.fillStyle = rgbCss(q.color);
			ctx.fill();
			ctx.lineWidth = 2.5;
			ctx.strokeStyle = '#ffd84d';
			ctx.stroke();
			ctx.strokeStyle = '#000';
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.arc(px, py, 9.5, 0, Math.PI * 2);
			ctx.stroke();
			if (s.showDir) drawTag(ctx, `Cara ${FACES[q.face]} · (s,t) = (${fmt(q.s)}, ${fmt(q.t)})`, Math.min(v.w - 210, px + 14), Math.max(2, py - 30), { color: '#ffd84d' });
		}
	}

	computeQuery() {
		if (!this.pick) return;
		const cam = this.view3d.camera.position;
		const view = this.pick.p.clone().sub(cam).normalize();
		const n = this.pick.n.clone();
		if (n.dot(view) > 0) n.negate();
		const r = view.clone().addScaledVector(n, -2 * view.dot(n)).normalize();
		const lk = cubeLookup(r);
		const color = faceColor(this.faces, lk.face, lk.s, lk.t);
		this.query = { ...lk, color, r, view };
	}

	render() {
		const s = this.store.state;
		this.computeQuery();
		const q = this.query;
		const show = s.showDir && !!q;
		this.arrowIn.visible = this.arrowOut.visible = this.ray.visible = this.dot.visible = this.envDot.visible = show;
		if (q) {
			const p = this.pick.p;
			this.dot.position.copy(p);
			this.arrowIn.position.copy(p).addScaledVector(q.view, -1.4);
			this.arrowIn.setDirection(q.view);
			this.arrowOut.position.copy(p);
			this.arrowOut.setDirection(q.r);
			const far = q.r.clone().multiplyScalar(ENV_HALF / Math.max(Math.abs(q.r.x), Math.abs(q.r.y), Math.abs(q.r.z)));
			this.envDot.position.copy(far);
			const pos = this.ray.geometry.attributes.position;
			pos.setXYZ(0, p.x, p.y, p.z);
			pos.setXYZ(1, far.x, far.y, far.z);
			pos.needsUpdate = true;
			this.ray.computeLineDistances();
			this.envDot.material.color.setRGB(q.color[0] / 255, q.color[1] / 255, q.color[2] / 255, THREE.SRGBColorSpace);
		}
		FACES.forEach((_, i) => {
			const it = this.view3d.labels.items.get('f' + i);
			if (it) it.visible = s.showNames && s.showEnv;
		});
		this.view3d.render();
		this.crossView.render();
		this.updateReadout();
	}

	updateReadout() {
		const q = this.query;
		let html = '';
		if (q) {
			html = `<span class="k">Dirección r</span> <code>(${fmt(q.r.x)}, ${fmt(q.r.y)}, ${fmt(q.r.z)})</code><br>
				<span class="k">Cara</span> ${FACES[q.face]}<br>
				<span class="k">s,t</span> ${fmt(q.s, 3)}, ${fmt(q.t, 3)}<br>
				<span class="sw" style="background:${rgbCss(q.color)}"></span>rgb(${q.color.join(', ')})<br>
				<span class="k">${this.store.state.locked ? 'Punto fijado (clic para liberar)' : 'Clic para fijar el punto'}</span>`;
		}
		if (html !== this._html) {
			this.read.innerHTML = html;
			this._html = html;
		}
	}

	dispose() {
		super.dispose();
		this.view3d.dispose();
		this.crossView.dispose();
		this.panel.dispose();
		this.cube?.dispose();
		this.mat.dispose();
		this.envMat.dispose();
		Object.values(this.geos).forEach((g) => g.dispose());
	}
}
