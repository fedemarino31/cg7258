import * as THREE from 'three';
import { Lab, onClick } from '../../shared/Lab.js';
import { Scene3DView } from '../../shared/Scene3DView.js';
import { TextureSpaceView } from '../../shared/TextureSpaceView.js';
import { ControlPanel } from '../../layout/ControlPanel.js';
import { createStore } from '../../app/AppState.js';
import { TEXTURE_KINDS, getTextureData, rgbCss } from '../../shared/textures.js';
import { makeTeapot, makeSphere, makeCube, makeCylinder, makePointMarker } from '../../shared/geometries.js';
import { drawRuler, drawUnitSquare, drawGridLines, drawTexelGrid, fillTexel, drawTextureWrapped, drawTag, fmt } from '../../shared/uvDraw.js';

const TEX_SIZE = 256;

const HIGHLIGHT_GLSL = `
	uniform vec2 uCursor; uniform float uRadius; uniform float uActive;`;
const HIGHLIGHT_MAIN = `
	{
		// Puntos espejo: mismo (u,v) repetido en otras zonas de la malla. Se pintan sobre la
		// superficie como un punto blanco con borde negro, distinto del marcador 3D (esfera amarilla).
		float d = length(vMapUv - uCursor);
		float rOuter = uRadius;
		float rInner = uRadius * 0.72;
		float aa = uRadius * 0.12;
		float fill = uActive * (1.0 - smoothstep(rInner - aa, rInner + aa, d));
		float ring = uActive * smoothstep(rInner - aa, rInner + aa, d) * (1.0 - smoothstep(rOuter - aa, rOuter + aa, d));
		diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.0), ring);
		diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), fill);
	}`;

function patchHighlight(mat, uniforms) {
	mat.onBeforeCompile = (shader) => {
		Object.assign(shader.uniforms, uniforms);
		shader.fragmentShader = shader.fragmentShader
			.replace('#include <common>', '#include <common>\n' + HIGHLIGHT_GLSL)
			.replace('#include <map_fragment>', '#include <map_fragment>\n' + HIGHLIGHT_MAIN);
	};
	return mat;
}

export class Texture2DLab extends Lab {
	static leftTitle = 'Escena 3D';
	static centerTitle = 'Espacio de textura · UV';
	static help = [
		'Mové el puntero sobre el objeto: se marca su coordenada (u,v) en la textura.',
		'Mové el puntero sobre la textura: las zonas del objeto que usan ese texel se resaltan en amarillo.',
		'Clic en cualquiera de las dos vistas fija/libera el punto.',
		'Rueda: zoom en la textura (con zoom alto se ven los texels). Botón derecho: paneo.',
	];

	constructor(layout) {
		super();
		this.store = createStore({
			geometry: 'teapot',
			texture: 'grid',
			wire: false,
			axes: true,
			values: true,
			lit: true,
			grid: false,
			texels: false,
			uv: null,
			locked: false,
			source: 'none',
		});
		this.geos = { teapot: makeTeapot(3, 14), sphere: makeSphere(1.5), cube: makeCube(), cylinder: makeCylinder() };
		this.hl = {
			uCursor: { value: new THREE.Vector2() },
			uRadius: { value: 0.045 },
			uActive: { value: 0 },
		};
		this.tex3 = {};

		this.view3d = new Scene3DView(layout.left, {
			position: [2.7, 1.9, 3.9],
			minDistance: 2.5,
			maxDistance: 12,
			onInvalidate: this.invalidate,
			tag: 'Arrastrar: orbitar · Rueda: zoom',
		});
		const scene = this.view3d.scene;
		scene.add(new THREE.AmbientLight(0xffffff, 0.75));
		const dl = new THREE.DirectionalLight(0xffffff, 2.2);
		dl.position.set(3, 5, 4);
		scene.add(dl);
		const grid = new THREE.GridHelper(8, 16, 0x3a4150, 0x262b35);
		grid.position.y = -1.8;
		scene.add(grid);

		this.mesh = new THREE.Mesh(this.geos.teapot, new THREE.MeshBasicMaterial());
		scene.add(this.mesh);
		this.wireMesh = new THREE.Mesh(
			this.geos.teapot,
			new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.35 })
		);
		scene.add(this.wireMesh);
		// Mismo aspecto que el punto de la vista UV: círculo amarillo pequeño con borde negro.
		this.marker = makePointMarker({ color: 0xffd84d, radius: 0.042, border: 0.012 });
		this.marker.visible = false;
		scene.add(this.marker);

		this.uvView = new TextureSpaceView(layout.center, {
			center: [0.5, 0.5],
			extent: 1.35,
			onInvalidate: this.invalidate,
			tag: 'Rueda: zoom · Botón derecho: paneo',
		});
		this.uvView.drawFn = (ctx, v) => this.drawUV(ctx, v);
		this.uvView.cursor = 'crosshair';

		this.bindEvents();
		this.buildControls(layout.controls);
		this.applyState();
		this.store.subscribe((s, patch) => this.applyState(patch));
	}

	bindEvents() {
		const dom = this.view3d.dom;
		this.listen(dom, 'pointermove', (e) => {
			if (this.store.state.locked) return;
			const hit = this.view3d.raycast(e, [this.mesh])[0];
			if (hit?.uv) {
				this.hitPoint = hit.point.clone();
				this.store.set({ uv: [hit.uv.x, hit.uv.y], source: 'surface' });
			}
		});
		onClick(this, dom, (e) => {
			const hit = this.view3d.raycast(e, [this.mesh])[0];
			const s = this.store.state;
			if (s.locked) this.store.set({ locked: false });
			else if (hit?.uv) {
				this.hitPoint = hit.point.clone();
				this.store.set({ uv: [hit.uv.x, hit.uv.y], source: 'surface', locked: true });
			}
		});
		const h = this.uvView.handlers;
		h.move = (uv) => {
			if (this.store.state.locked) return;
			if (uv[0] >= 0 && uv[0] <= 1 && uv[1] >= 0 && uv[1] <= 1) this.store.set({ uv: [uv[0], uv[1]], source: 'texture' });
		};
		h.down = (uv) => {
			const s = this.store.state;
			if (s.locked) this.store.set({ locked: false });
			else if (uv[0] >= 0 && uv[0] <= 1 && uv[1] >= 0 && uv[1] <= 1)
				this.store.set({ uv: [uv[0], uv[1]], source: 'texture', locked: true });
			return true;
		};
	}

	buildControls(el) {
		const p = (this.panel = new ControlPanel(el, this.store));
		p.idea(
			'Una textura 2D se consulta mediante dos coordenadas, U y V. La superficie 3D y la imagen son espacios diferentes relacionados por los atributos UV de la geometría.'
		);
		p.select('geometry', 'Geometría', [
			{ value: 'teapot', label: 'Tetera' },
			{ value: 'sphere', label: 'Esfera' },
			{ value: 'cube', label: 'Cubo' },
			{ value: 'cylinder', label: 'Cilindro' },
		]);
		p.select('texture', 'Textura', TEXTURE_KINDS);
		p.title('Visualización');
		p.checkbox('wire', 'Mostrar wireframe');
		p.checkbox('axes', 'Mostrar ejes UV');
		p.checkbox('values', 'Mostrar valores UV');
		p.checkbox('lit', 'Material iluminado');
		p.checkbox('grid', 'Mostrar cuadrícula UV');
		p.checkbox('texels', 'Mostrar texels');
		p.buttons({
			label: 'Restablecer punto',
			onClick: () => {
				this.marker.visible = false;
				this.store.set({ uv: null, locked: false, source: 'none' });
			},
		});
		this.read = p.readout();
	}

	getTex3(kind) {
		if (!this.tex3[kind]) this.tex3[kind] = getTextureData(kind, TEX_SIZE).toThree('clamp');
		return this.tex3[kind];
	}

	applyState() {
		const s = this.store.state;
		const geo = this.geos[s.geometry];
		if (this.mesh.geometry !== geo) {
			this.mesh.geometry = geo;
			this.wireMesh.geometry = geo;
			this.marker.visible = false;
			if (s.source === 'surface') this.store.state.uv = null;
		}
		const map = this.getTex3(s.texture);
		if (!this.mats) this.mats = {};
		const kind = s.lit ? 'lit' : 'basic';
		if (!this.mats[kind]) {
			const m = s.lit
				? new THREE.MeshLambertMaterial({ side: THREE.DoubleSide })
				: new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
			this.mats[kind] = patchHighlight(m, this.hl);
			this.own(this.mats[kind]);
		}
		const mat = this.mats[kind];
		if (mat.map !== map) {
			mat.map = map;
			mat.needsUpdate = true;
		}
		this.mesh.material = mat;
		this.wireMesh.visible = s.wire;
		if (s.uv) {
			this.hl.uCursor.value.set(s.uv[0], s.uv[1]);
			this.hl.uActive.value = 1;
		} else this.hl.uActive.value = 0;
		if (s.source === 'surface' && s.uv && this.hitPoint) {
			this.marker.position.copy(this.hitPoint);
			this.marker.visible = true;
		} else if (s.source !== 'surface') this.marker.visible = false;
		this.invalidate();
	}

	drawUV(ctx, v) {
		const s = this.store.state;
		const tex = getTextureData(s.texture, TEX_SIZE);
		drawTextureWrapped(ctx, v, tex, 'clamp', { dimOutside: false });
		// oscurecer lo que queda fuera de [0,1]²
		const [x, y] = v.toPx(0, 1);
		ctx.fillStyle = 'rgba(18,20,26,1)';
		ctx.beginPath();
		ctx.rect(0, 0, v.w, v.h);
		ctx.rect(x, y, v.scale, v.scale);
		ctx.fill('evenodd');
		if (s.grid) drawGridLines(ctx, v, 8);
		let texelsShown = false;
		if (s.texels) texelsShown = drawTexelGrid(ctx, v, TEX_SIZE);
		drawUnitSquare(ctx, v);
		if (s.uv) {
			const [u, vv] = s.uv;
			if (texelsShown) {
				fillTexel(ctx, v, TEX_SIZE, Math.min(TEX_SIZE - 1, Math.floor(u * TEX_SIZE)), Math.min(TEX_SIZE - 1, Math.floor(vv * TEX_SIZE)), 'rgba(255,216,77,0.35)', '#ffd84d');
			}
			const [px, py] = v.toPx(u, vv);
			ctx.save();
			ctx.strokeStyle = 'rgba(255,216,77,0.55)';
			ctx.lineWidth = 1;
			ctx.setLineDash([4, 4]);
			ctx.beginPath();
			ctx.moveTo(px, v.toPx(0, 1)[1]);
			ctx.lineTo(px, v.toPx(0, 0)[1]);
			ctx.moveTo(v.toPx(0, 0)[0], py);
			ctx.lineTo(v.toPx(1, 0)[0], py);
			ctx.stroke();
			ctx.restore();
			ctx.beginPath();
			ctx.arc(px, py, 7, 0, Math.PI * 2);
			ctx.fillStyle = '#ffd84d';
			ctx.fill();
			ctx.lineWidth = 2;
			ctx.strokeStyle = '#000';
			ctx.stroke();
			if (s.values) drawTag(ctx, `(u, v) = (${fmt(u)}, ${fmt(vv)})`, Math.min(v.w - 150, px + 12), Math.max(4, py - 26), { color: '#ffd84d' });
		}
		if (s.axes) drawRuler(ctx, v);
	}

	render() {
		const s = this.store.state;
		this.view3d.labels.set('uv', {
			html: s.uv ? `(u,v) = (${fmt(s.uv[0])}, ${fmt(s.uv[1])})` : '',
			color: '#ffd84d',
			position: this.marker.position,
			visible: s.values && s.source === 'surface' && !!s.uv,
		});
		this.view3d.render();
		this.uvView.render();
		this.updateReadout();
	}

	updateReadout() {
		const s = this.store.state;
		let html;
		if (!s.uv) html = '<span class="k">Movés el puntero sobre el objeto o sobre la textura.</span>';
		else {
			const tex = getTextureData(s.texture, TEX_SIZE);
			const c = tex.sample(s.uv[0], s.uv[1], 'clamp', 'nearest').rgb;
			html = `<span class="k">u</span> ${fmt(s.uv[0], 3)} &nbsp; <span class="k">v</span> ${fmt(s.uv[1], 3)}<br>
				<span class="sw" style="background:${rgbCss(c)}"></span>rgb(${c.join(', ')})<br>
				<span class="k">${s.locked ? 'Punto fijado (clic para liberar)' : 'Clic para fijar el punto'}</span>`;
		}
		if (html !== this._lastHtml) {
			this.read.innerHTML = html;
			this._lastHtml = html;
		}
	}

	dispose() {
		super.dispose();
		this.view3d.dispose();
		this.uvView.dispose();
		this.panel.dispose();
		Object.values(this.tex3).forEach((t) => t.dispose());
		Object.values(this.geos).forEach((g) => g.dispose());
	}
}
