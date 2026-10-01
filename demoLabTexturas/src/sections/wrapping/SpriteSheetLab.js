import * as THREE from 'three';
import { Lab } from '../../shared/Lab.js';
import { Scene3DView } from '../../shared/Scene3DView.js';
import { TextureSpaceView } from '../../shared/TextureSpaceView.js';
import { ControlPanel } from '../../layout/ControlPanel.js';
import { createStore } from '../../app/AppState.js';
import { drawRuler, drawUnitSquare, drawTag, fmt } from '../../shared/uvDraw.js';
import { loadSpriteSheet } from './textures.js';

const COLS = 4;
const ROWS = 4;
const FRAMES = COLS * ROWS;
const HORSE_URL = `${import.meta.env.BASE_URL}horse.jpg`;

// Rectángulo UV (offset + tamaño) del cuadro `frame` (0-indexado, recorrido por filas de la imagen).
// La V de una textura crece hacia arriba, así que la fila 0 de la imagen (la de arriba) cae en la V más alta.
function frameRect(frame) {
	const col = frame % COLS;
	const row = Math.floor(frame / COLS);
	return { ox: col / COLS, oy: 1 - (row + 1) / ROWS, w: 1 / COLS, h: 1 / ROWS };
}

export class SpriteSheetLab extends Lab {
	static leftTitle = 'Escena 3D · cubo animado';
	static centerTitle = 'Espacio de textura · sprite sheet completo';
	static help = [
		'El cubo usa siempre la misma textura y el mismo material: lo único que cambia con el tiempo son su offset y su repeat.',
		'repeat.set(1/4, 1/4) recorta un cuadro de la cuadrícula 4×4; offset elige cuál, recorriendo los 16 en orden.',
		'El rectángulo amarillo del panel derecho marca el cuadro que se está mostrando en ese instante sobre el cubo.',
		'Arrastrá el slider "Cuadro" para saltar a uno puntual; eso pausa la reproducción automática.',
	];

	constructor(layout) {
		super();
		this.store = createStore({
			playing: true,
			fps: 8,
			frame: 0,
			wire: false,
		});
		this.acc = 0;

		this.view3d = new Scene3DView(layout.left, {
			position: [2.6, 2.0, 3.4],
			minDistance: 2.2,
			maxDistance: 10,
			onInvalidate: this.invalidate,
			tag: 'Arrastrar: orbitar · Rueda: zoom',
		});
		const scene = this.view3d.scene;
		scene.add(new THREE.AmbientLight(0xffffff, 0.85));
		const dl = new THREE.DirectionalLight(0xffffff, 2.1);
		dl.position.set(3, 5, 4);
		scene.add(dl);
		const grid = new THREE.GridHelper(8, 16, 0x3a4150, 0x262b35);
		grid.position.y = -1.6;
		scene.add(grid);

		this.texture = loadSpriteSheet(HORSE_URL, () => this.invalidate());
		this.texture.repeat.set(1 / COLS, 1 / ROWS);

		// BoxGeometry ya mapea la textura completa [0,1]² en cada una de sus 6 caras: al recortar la
		// textura con offset/repeat, las 6 caras muestran automáticamente el mismo cuadro del sprite.
		this.mesh = new THREE.Mesh(
			new THREE.BoxGeometry(2.4, 2.4, 2.4),
			new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.85, metalness: 0 })
		);
		scene.add(this.mesh);
		this.wireMesh = new THREE.Mesh(
			this.mesh.geometry,
			new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.35 })
		);
		scene.add(this.wireMesh);

		this.uvView = new TextureSpaceView(layout.center, {
			center: [0.5, 0.5],
			extent: 1.3,
			onInvalidate: this.invalidate,
			tag: 'Rueda: zoom · Botón derecho: paneo',
		});
		this.uvView.drawFn = (ctx, v) => this.drawUV(ctx, v);

		this.buildControls(layout.controls);
		this.applyState();
		this.store.subscribe((s, patch) => this.applyState(patch));
	}

	buildControls(el) {
		const p = (this.panel = new ControlPanel(el, this.store));
		p.idea(
			'offset y repeat de una textura se pueden animar con el tiempo: cada instante recorta y ubica un cuadro distinto del mismo sprite sheet, sin tocar la geometría ni cambiar de textura.'
		);
		p.checkbox('playing', 'Reproducir automáticamente');
		p.slider('fps', 'Velocidad (cuadros/seg)', { min: 1, max: 24, step: 1, digits: 0 });
		this.frameSlider = p.slider('frame', 'Cuadro (manual)', { min: 0, max: FRAMES - 1, step: 1, digits: 0 });
		this.frameSlider.addEventListener('pointerdown', () => this.store.set({ playing: false }));
		p.title('Visualización');
		p.checkbox('wire', 'Mostrar wireframe');
		this.read = p.readout();
	}

	setFrame(frame) {
		const r = frameRect(frame);
		this.texture.offset.set(r.ox, r.oy);
	}

	applyState() {
		const s = this.store.state;
		this.animating = s.playing;
		this.wireMesh.visible = s.wire;
		this.setFrame(s.frame);
		this.invalidate();
	}

	update(dt) {
		const s = this.store.state;
		this.acc += dt;
		const step = 1 / Math.max(1, s.fps);
		let frame = s.frame;
		let advanced = false;
		while (this.acc >= step) {
			this.acc -= step;
			frame = (frame + 1) % FRAMES;
			advanced = true;
		}
		if (advanced) this.store.set({ frame });
	}

	drawUV(ctx, v) {
		const s = this.store.state;
		const img = this.texture.image;
		const [x, y] = v.toPx(0, 1);
		if (img && (!('complete' in img) || img.complete)) ctx.drawImage(img, x, y, v.scale, v.scale);
		drawUnitSquare(ctx, v);

		const r = frameRect(s.frame);
		const [rx, ry] = v.toPx(r.ox, r.oy + r.h);
		ctx.save();
		ctx.fillStyle = 'rgba(255,216,77,0.18)';
		ctx.fillRect(rx, ry, r.w * v.scale, r.h * v.scale);
		ctx.strokeStyle = '#ffd84d';
		ctx.lineWidth = 3;
		ctx.strokeRect(rx, ry, r.w * v.scale, r.h * v.scale);
		ctx.restore();
		drawTag(ctx, `Cuadro ${s.frame + 1}/${FRAMES}`, Math.min(v.w - 120, rx + 6), Math.max(4, ry - 22), { color: '#ffd84d' });
		drawRuler(ctx, v);
	}

	render() {
		this.view3d.render();
		this.uvView.render();
		this.updateReadout();
	}

	updateReadout() {
		const s = this.store.state;
		const r = frameRect(s.frame);
		const html = `<span class="k">Cuadro</span> ${s.frame + 1} / ${FRAMES}<br>
			<span class="k">offset</span> (${fmt(r.ox)}, ${fmt(r.oy)})<br>
			<span class="k">repeat</span> (${fmt(r.w)}, ${fmt(r.h)})<br>
			<span class="k">${s.playing ? `reproduciendo a ${s.fps} cuadros/seg` : 'en pausa'}</span>`;
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
		this.texture.dispose();
		this.mesh.geometry.dispose();
		this.mesh.material.dispose();
		this.wireMesh.material.dispose();
	}
}
