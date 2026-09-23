import * as THREE from 'three';
import { Lab } from '../../shared/Lab.js';
import { Scene3DView } from '../../shared/Scene3DView.js';
import { TextureSpaceView } from '../../shared/TextureSpaceView.js';
import { ControlPanel } from '../../layout/ControlPanel.js';
import { createStore } from '../../app/AppState.js';
import { drawRuler, drawUnitSquare, drawTag, fmt } from '../../shared/uvDraw.js';

const BASE = import.meta.env.BASE_URL;

// Dimensiones de la escena (en unidades de mundo).
const GROUND_SIZE = 16;
const PLATFORM_SIZE = 6;
const PLATFORM_H = 0.08;
const BODY_W = 4;
const BODY_H = 3;
const BODY_D = 4;
const ROOF_RISE = 1.3;
const ROOF_OVERHANG = 0.3;
const DOOR_W = 1;
const DOOR_H = 1.8;

// Cada material define su textura, el estado inicial (deliberadamente incorrecto),
// el estado objetivo (elegido visualmente) y una tolerancia amplia para la comprobación opcional.
const MATERIALS = {
	grass: { label: 'Pasto', file: 'pasto.jpg', initial: { repU: 0.25, repV: 0.25 }, target: { repU: 2, repV: 2 } },
	stone: { label: 'Piedra', file: 'piedras.jpg', initial: { repU: 0.25, repV: 0.25 }, target: { repU: 2, repV: 2 } },
	brick: { label: 'Ladrillos', file: 'ladrillos.jpg', initial: { repU: 0.25, repV: 0.25 }, target: { repU: 2.5, repV: 2 } },
	roof: { label: 'Tejas', file: 'tejas.jpg', initial: { repU: 0.25, repV: 0.25 }, target: { repU: 1.5, repV: 1.5 } },
	door: {
		label: 'Puerta',
		file: 'puerta.jpg',
		offset: true,
		initial: { repU: 2.5, repV: 1.6, offU: 0.35, offV: -0.25 },
		target: { repU: 0.66, repV: 1.01, offU: 0.17, offV: 0 },
		stepRep: 0.01,
		stepOff: 0.01,
	},
};
const ORDER = ['grass', 'stone', 'brick', 'roof', 'door'];

function defaultState() {
	const d = { material: 'grass', wire: false, reference: false };
	for (const k of ORDER) {
		const m = MATERIALS[k];
		d[`${k}RepU`] = m.initial.repU;
		d[`${k}RepV`] = m.initial.repV;
		if (m.offset) {
			d[`${k}OffU`] = m.initial.offU;
			d[`${k}OffV`] = m.initial.offV;
		}
	}
	return d;
}

function loadTexture(url, onReady) {
	const tex = new THREE.TextureLoader().load(url, () => {
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.anisotropy = 8;
		tex.needsUpdate = true;
		onReady?.();
	});
	// Repeat también en la puerta: es lo que permite ver que, al no ser seamless,
	// repetirla se ve mal y hace falta ajustar repeat/offset para encuadrar una sola vez.
	tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
	return tex;
}

// Quad de una falda del techo a dos aguas, con UV propio en [0,1]².
// El UV está rotado 90° respecto de la proyección directa (ridge→eave = u, profundidad = v)
// para que las líneas de las tejas corran hacia abajo por la pendiente en vez de horizontales.
function buildRoofSlope(sign, halfW, halfD, eaveY, apexY) {
	const geo = new THREE.BufferGeometry();
	const x = sign * halfW;
	const positions = new Float32Array([
		0, apexY, -halfD, // ridge, back
		0, apexY, halfD, // ridge, front
		x, eaveY, halfD, // eave, front
		x, eaveY, -halfD, // eave, back
	]);
	const uvs = new Float32Array([1, 0, 0, 0, 0, 1, 1, 1]);
	const index = sign > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
	geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
	geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
	geo.setIndex(index);
	geo.computeVertexNormals();
	return geo;
}

// Cumbrera triangular del frontón (frente y fondo de la casa), entre el remate de la pared y el
// vértice del techo. Completa el hueco bajo las dos faldas usando la misma textura de ladrillos.
function buildGable(halfW, eaveY, apexY, z) {
	const geo = new THREE.BufferGeometry();
	const positions = new Float32Array([0, apexY, z, -halfW, eaveY, z, halfW, eaveY, z]);
	const v0 = (eaveY - PLATFORM_H) / BODY_H;
	const v1 = (apexY - PLATFORM_H) / BODY_H;
	const uvs = new Float32Array([0.5, v1, 0, v0, 1, v0]);
	geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
	geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
	geo.setIndex([0, 1, 2]);
	geo.computeVertexNormals();
	return geo;
}

// Proyección planar desde arriba: el UV de cada vértice depende solo de su X/Z de mundo,
// sin importar a qué cara pertenece. Por eso los cantos laterales muestran la continuación
// vertical de los píxeles que caen "arriba" de ellos, en vez de repetir la textura como una caja.
function planarTopUV(geo, size) {
	const pos = geo.attributes.position;
	const uv = geo.attributes.uv;
	for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / size + 0.5, pos.getZ(i) / size + 0.5);
	uv.needsUpdate = true;
	return geo;
}

// Construye la casa (suelo, plataforma, cuerpo, techo y puerta) dentro de `scene`,
// usando las cinco texturas de `textures`. Reutilizado por la escena principal y la referencia.
function buildHouse(scene, textures) {
	const meshes = {};
	const groundGeo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE);
	groundGeo.rotateX(-Math.PI / 2);
	meshes.ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ map: textures.grass, roughness: 1 }));

	meshes.platform = new THREE.Mesh(
		planarTopUV(new THREE.BoxGeometry(PLATFORM_SIZE, PLATFORM_H, PLATFORM_SIZE), PLATFORM_SIZE),
		new THREE.MeshStandardMaterial({ map: textures.stone, roughness: 0.95 })
	);
	meshes.platform.position.y = PLATFORM_H / 2;

	meshes.body = new THREE.Mesh(
		new THREE.BoxGeometry(BODY_W, BODY_H, BODY_D),
		new THREE.MeshStandardMaterial({ map: textures.brick, roughness: 0.9 })
	);
	meshes.body.position.y = PLATFORM_H + BODY_H / 2;

	const eaveY = PLATFORM_H + BODY_H;
	const apexY = eaveY + ROOF_RISE;
	const halfW = BODY_W / 2 + ROOF_OVERHANG;
	const halfD = BODY_D / 2 + ROOF_OVERHANG;
	const roofMat = new THREE.MeshStandardMaterial({ map: textures.roof, roughness: 0.85, side: THREE.DoubleSide });
	meshes.roofR = new THREE.Mesh(buildRoofSlope(1, halfW, halfD, eaveY, apexY), roofMat);
	meshes.roofL = new THREE.Mesh(buildRoofSlope(-1, halfW, halfD, eaveY, apexY), roofMat);

	const gableMat = new THREE.MeshStandardMaterial({ map: textures.brick, roughness: 0.9, side: THREE.DoubleSide });
	meshes.gableFront = new THREE.Mesh(buildGable(BODY_W / 2, eaveY, apexY, BODY_D / 2), gableMat);
	meshes.gableBack = new THREE.Mesh(buildGable(BODY_W / 2, eaveY, apexY, -BODY_D / 2), gableMat);

	meshes.door = new THREE.Mesh(
		new THREE.PlaneGeometry(DOOR_W, DOOR_H),
		new THREE.MeshStandardMaterial({ map: textures.door, roughness: 0.8, side: THREE.DoubleSide })
	);
	meshes.door.position.set(0, PLATFORM_H + DOOR_H / 2, BODY_D / 2 + 0.02);

	for (const m of Object.values(meshes)) scene.add(m);
	return meshes;
}

export class HouseAdjustLab extends Lab {
	static leftTitle = 'Escena 3D · casa texturada';
	static centerTitle = 'Textura activa';
	static help = [
		'La escena arranca con las cinco texturas mal ajustadas: pasto, piedra, ladrillos y tejas se ven demasiado grandes, y la puerta aparece repetida y descuadrada.',
		'Elegí un material en "Material activo" y corregí su repeat (y, en la puerta, también el offset) hasta que la escala y el encuadre se vean razonables.',
		'La columna central muestra la textura del material activo tal como se reparte dentro del cuadrado UV [0,1] de esa superficie.',
		'"Ver solución" aplica de una vez los valores correctos; "Mostrar referencia" agrega, sin tocar tu ajuste, una casa en miniatura ya bien texturada.',
	];

	constructor(layout) {
		super();
		this.store = createStore(defaultState());

		this.view3d = new Scene3DView(layout.left, {
			background: 0x8fcbef,
			position: [9, 6.5, 10],
			target: [0, 2, 0],
			minDistance: 4,
			maxDistance: 30,
			onInvalidate: this.invalidate,
			tag: 'Arrastrar: orbitar · Rueda: zoom',
		});
		const scene = this.view3d.scene;
		scene.add(new THREE.AmbientLight(0xffffff, 0.9));
		const dl = new THREE.DirectionalLight(0xffffff, 2.1);
		dl.position.set(6, 9, 5);
		scene.add(dl);

		this.textures = {};
		for (const k of ORDER) this.textures[k] = loadTexture(`${BASE}${MATERIALS[k].file}`, () => this.invalidate());
		this.meshes = buildHouse(scene, this.textures);
		this.wireMeshes = Object.values(this.meshes).map((m) => {
			const w = new THREE.Mesh(
				m.geometry,
				new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.3 })
			);
			w.position.copy(m.position);
			w.visible = false;
			scene.add(w);
			return w;
		});

		this.buildReference(layout.left);

		this.uvView = new TextureSpaceView(layout.center, {
			center: [0.5, 0.5],
			extent: 1.4,
			onInvalidate: this.invalidate,
			tag: 'Rueda: zoom · Botón derecho: paneo',
		});
		this.uvView.drawFn = (ctx, v) => this.drawUV(ctx, v);

		this.buildControls(layout.controls);
		this.applyState();
		this.store.subscribe((s, patch) => this.applyState(patch));
		this.exposeConsoleTool();
	}

	// Herramienta de consola: mové los sliders hasta que la casa se vea bien y
	// llamá a window.dumpAjusteTexturas() para volcar el repeat/offset actual de
	// cada material, listo para copiar como `target` dentro de MATERIALS.
	exposeConsoleTool() {
		window.dumpAjusteTexturas = () => {
			const s = this.store.state;
			const lines = ORDER.map((k) => {
				const m = MATERIALS[k];
				let entry = `repU: ${s[`${k}RepU`].toFixed(2)}, repV: ${s[`${k}RepV`].toFixed(2)}`;
				if (m.offset) entry += `, offU: ${s[`${k}OffU`].toFixed(2)}, offV: ${s[`${k}OffV`].toFixed(2)}`;
				return `  ${k}: { ${entry} },`;
			});
			const text = `target: {\n${lines.join('\n')}\n}`;
			console.log(text);
			return text;
		};
		console.log('Ajuste de texturas: llamá a window.dumpAjusteTexturas() para volcar el repeat/offset actual de cada material.');
	}

	// ---------- referencia (casa en miniatura ya bien ajustada) ----------
	buildReference(container) {
		const wrap = document.createElement('div');
		wrap.className = 'ref-inset hidden';
		const tag = document.createElement('div');
		tag.className = 'view-tag';
		tag.textContent = 'Referencia: valores correctos';
		wrap.appendChild(tag);
		container.appendChild(wrap);

		const renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setClearColor(0x8fcbef);
		wrap.appendChild(renderer.domElement);

		const scene = new THREE.Scene();
		scene.add(new THREE.AmbientLight(0xffffff, 0.9));
		const dl = new THREE.DirectionalLight(0xffffff, 2);
		dl.position.set(6, 9, 5);
		scene.add(dl);
		const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
		camera.position.set(9, 6.5, 10);
		camera.lookAt(0, 2, 0);

		this.refTextures = {};
		for (const k of ORDER) {
			const m = MATERIALS[k];
			const t = loadTexture(`${BASE}${m.file}`, () => this.renderReference());
			t.repeat.set(m.target.repU, m.target.repV);
			if (m.offset) t.offset.set(m.target.offU, m.target.offV);
			this.refTextures[k] = t;
		}
		buildHouse(scene, this.refTextures);

		this.refView = { wrap, renderer, scene, camera };
		this.roRef = new ResizeObserver(() => this.resizeReference());
		this.roRef.observe(wrap);
	}

	resizeReference() {
		const { renderer, camera, wrap } = this.refView;
		const w = Math.max(1, wrap.clientWidth);
		const h = Math.max(1, wrap.clientHeight);
		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		this.renderReference();
	}

	renderReference() {
		if (!this.store.state.reference) return;
		this.refView.renderer.render(this.refView.scene, this.refView.camera);
	}

	// ---------- controles ----------
	buildControls(el) {
		const p = (this.panel = new ControlPanel(el, this.store));
		p.idea('repeat ajusta la escala de una textura seamless; offset ubica una no periódica, como la puerta. Corregí ambos hasta que la casa se vea coherente.');
		p.select(
			'material',
			'Material activo',
			ORDER.map((k) => ({ value: k, label: MATERIALS[k].label }))
		);

		p.title('Ajustes del material activo');
		this.groups = {};
		for (const k of ORDER) {
			const m = MATERIALS[k];
			const wrappers = [];
			const stepRep = m.stepRep ?? 0.05;
			wrappers.push(p.slider(`${k}RepU`, 'repeat U', { min: 0.25, max: 12, step: stepRep, digits: 2 }).closest('.ctl'));
			wrappers.push(p.slider(`${k}RepV`, 'repeat V', { min: 0.25, max: 12, step: stepRep, digits: 2 }).closest('.ctl'));
			if (m.offset) {
				const stepOff = m.stepOff ?? 0.05;
				wrappers.push(p.slider(`${k}OffU`, 'offset U', { min: -1, max: 1, step: stepOff, digits: 2 }).closest('.ctl'));
				wrappers.push(p.slider(`${k}OffV`, 'offset V', { min: -1, max: 1, step: stepOff, digits: 2 }).closest('.ctl'));
			}
			this.groups[k] = wrappers;
		}

		p.title('Visualización');
		p.checkbox('wire', 'Mostrar wireframe');
		p.checkbox('reference', 'Mostrar referencia');
		p.buttons({ label: 'Restablecer cámara', onClick: () => this.view3d.resetCamera() });
		p.buttons({ label: 'Restablecer ejercicio', onClick: () => this.resetExercise() });
		p.buttons({ label: 'Ver solución', onClick: () => this.viewSolution() });

		this.read = p.readout();
	}

	resetExercise() {
		this.store.set(defaultState());
	}

	viewSolution() {
		const patch = {};
		for (const k of ORDER) {
			const m = MATERIALS[k];
			patch[`${k}RepU`] = m.target.repU;
			patch[`${k}RepV`] = m.target.repV;
			if (m.offset) {
				patch[`${k}OffU`] = m.target.offU;
				patch[`${k}OffV`] = m.target.offV;
			}
		}
		this.store.set(patch);
	}

	// ---------- estado ----------
	applyState(patch = {}) {
		const s = this.store.state;
		for (const k of ORDER) {
			const tex = this.textures[k];
			tex.repeat.set(s[`${k}RepU`], s[`${k}RepV`]);
			if (MATERIALS[k].offset) tex.offset.set(s[`${k}OffU`], s[`${k}OffV`]);
		}
		this.wireMeshes.forEach((w) => (w.visible = s.wire));
		if (this.groups) for (const k of ORDER) this.groups[k].forEach((el) => (el.style.display = k === s.material ? '' : 'none'));
		if (this.refView) {
			this.refView.wrap.classList.toggle('hidden', !s.reference);
			if (s.reference) this.resizeReference();
		}
		this.updateReadout();
		this.invalidate();
	}

	updateReadout() {
		const s = this.store.state;
		const k = s.material;
		const m = MATERIALS[k];
		let html = `<span class="k">${m.label}</span><br>
			<span class="k">repeat</span> (${fmt(s[`${k}RepU`])}, ${fmt(s[`${k}RepV`])})`;
		if (m.offset) html += `<br><span class="k">offset</span> (${fmt(s[`${k}OffU`])}, ${fmt(s[`${k}OffV`])})`;
		if (html !== this._html) {
			this.read.innerHTML = html;
			this._html = html;
		}
	}

	// ---------- vista de textura activa ----------
	drawUV(ctx, view) {
		const s = this.store.state;
		const k = s.material;
		const m = MATERIALS[k];
		const img = this.textures[k].image;
		const repU = s[`${k}RepU`];
		const repV = s[`${k}RepV`];
		const offU = m.offset ? s[`${k}OffU`] : 0;
		const offV = m.offset ? s[`${k}OffV`] : 0;
		const cw = 1 / repU;
		const ch = 1 / repV;
		const shiftU = (((-offU / repU) % cw) + cw) % cw;
		const shiftV = (((-offV / repV) % ch) + ch) % ch;
		const { u0, u1, v0, v1 } = view.visibleRange();
		const iA = Math.floor((u0 - shiftU) / cw) - 1;
		const iB = Math.ceil((u1 - shiftU) / cw) + 1;
		const jA = Math.floor((v0 - shiftV) / ch) - 1;
		const jB = Math.ceil((v1 - shiftV) / ch) + 1;

		const ready = img && (!('complete' in img) || img.complete);
		if (ready) {
			for (let i = iA; i <= iB; i++) {
				for (let j = jA; j <= jB; j++) {
					const x0 = shiftU + i * cw;
					const y0 = shiftV + j * ch;
					const [px, py] = view.toPx(x0, y0 + ch);
					ctx.drawImage(img, px, py, cw * view.scale, ch * view.scale);
				}
			}
		}

		drawUnitSquare(ctx, view, '#ffd84d');
		drawTag(ctx, `${m.label} · 1 repetición = ${fmt(cw)} × ${fmt(ch)} del UV [0,1]`, 8, 8, { color: '#ffd84d' });
		drawRuler(ctx, view);
	}

	render() {
		this.view3d.render();
		this.uvView.render();
	}

	dispose() {
		super.dispose();
		this.view3d.dispose();
		this.uvView.dispose();
		this.panel.dispose();
		Object.values(this.textures).forEach((t) => t.dispose());
		this.wireMeshes.forEach((w) => w.material.dispose());
		this.roRef.disconnect();
		this.refView.renderer.dispose();
		this.refView.renderer.forceContextLoss();
		this.refView.scene.traverse((o) => {
			if (o.geometry) o.geometry.dispose();
			if (o.material) o.material.dispose();
		});
		Object.values(this.refTextures).forEach((t) => t.dispose());
		this.refView.wrap.remove();
		delete window.dumpAjusteTexturas;
	}
}
