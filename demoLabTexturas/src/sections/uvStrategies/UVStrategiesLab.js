import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Lab, onClick } from '../../shared/Lab.js';
import { Scene3DView } from '../../shared/Scene3DView.js';
import { TextureSpaceView } from '../../shared/TextureSpaceView.js';
import { ControlPanel } from '../../layout/ControlPanel.js';
import { createStore } from '../../app/AppState.js';
import { drawRuler, drawTag, drawUnitSquare, fmt } from '../../shared/uvDraw.js';
import {
	GENERATED_OBJECTS,
	buildGenerated,
	buildTerrain,
	buildCylindricalProjection,
	buildBoxProjection,
	dataFromModelGeometry,
	tubeSectionRing,
} from './geometry.js';
import {
	ASSET_URLS,
	canvasTexture,
	createCheckerTexture,
	createColaLabelTexture,
	createTubeTexture,
	createUvDiagnosticTexture,
	loadColorTexture,
} from './textures.js';
import { getTextureData as getSharedTextureData } from '../../shared/textures.js';

export const UV_STRATEGY_CASES = [
	{ value: 'generacion', label: 'UV de generación' },
	{ value: 'planar', label: 'Proyección planar' },
	{ value: 'cilindrica', label: 'Proyección cilíndrica' },
	{ value: 'caja', label: 'Proyección tipo caja' },
	{ value: 'unwrap', label: 'Unwrap y atlas' },
];

const CASES = {
	generacion: {
		concept: 'Los mismos parámetros que construyen la superficie se escriben como u y v. Es la elección más natural cuando forma y parametrización nacen juntas.',
		camera: [4.5, 3.2, 5.6],
	},
	planar: {
		concept: 'La malla ya existe: sus posiciones locales se proyectan sobre XZ para calcular nuevas coordenadas UV.',
		camera: [4.8, 3.7, 5.2],
	},
	cilindrica: {
		concept: 'La geometría irregular recibe después un sistema cilíndrico: el ángulo produce u y la altura produce v.',
		camera: [4.5, 2.8, 5.2],
	},
	caja: {
		concept: 'Cada triángulo elige una proyección X, Y o Z según la componente dominante de su normal.',
		camera: [4.2, 3.4, 5.1],
	},
	unwrap: {
		concept: 'Las islas UV fueron diseñadas fuera de esta aplicación y llegan como parte de los datos del modelo.',
		camera: [4.5, 3.2, 5.6],
	},
};

const AXIS_COLORS = ['#ef5a62', '#47d57c', '#528dff'];

// Por encima de este número de triángulos se desactivan las operaciones por-triángulo (resaltado en
// el panel UV, costuras, selección por clic): los demás casos de este capítulo rondan el millar de
// triángulos; un modelo importado puede tener órdenes de magnitud más y esas operaciones son O(triángulos)
// por cuadro, así que se muestran solo el modelo texturizado y el atlas plano, sin trabarse.
const HEAVY_MESH_TRIANGLE_LIMIT = 40000;

function patchSelection(material, uniforms) {
	material.onBeforeCompile = (shader) => {
		shader.uniforms.uHasSelection = uniforms.uHasSelection;
		shader.vertexShader = shader.vertexShader
			.replace('#include <common>', '#include <common>\nattribute float aSelected; varying float vSelected;')
			.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSelected = aSelected;');
		shader.fragmentShader = shader.fragmentShader
			.replace('#include <common>', '#include <common>\nuniform float uHasSelection; varying float vSelected;')
			.replace('#include <dithering_fragment>', `#include <dithering_fragment>
				if (uHasSelection > 0.5) {
					vec3 muted = gl_FragColor.rgb * 0.34;
					vec3 selected = mix(gl_FragColor.rgb, vec3(1.0, 0.78, 0.05), 0.48);
					gl_FragColor.rgb = mix(muted, selected, vSelected);
				}`);
	};
	return material;
}

function lineFromPoints(points, color) {
	return new THREE.Line(
		new THREE.BufferGeometry().setFromPoints(points),
		new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: false })
	);
}

// Primera textura con imagen encontrada entre los materiales del modelo: el atlas que viene
// embebido dentro del propio GLB, sin depender de un archivo aparte.
function extractGlbTexture(root) {
	let found = null;
	root.traverse((object) => {
		if (found || !object.isMesh) return;
		for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
			if (material?.map) {
				found = material.map;
				break;
			}
		}
	});
	return found;
}

function combineModelMeshes(root) {
	root.updateMatrixWorld(true);
	// Se recorre dos veces: una para saber el tamaño total (y reservar los typed arrays de una sola
	// vez) y otra para copiarlos con .set(). Evita el spread sobre arrays de millones de elementos
	// (revienta la pila) y evita también los arrays de JS intermedios de un modelo grande.
	const meshGeometries = [];
	let vertexCount = 0;
	root.traverse((object) => {
		if (!object.isMesh || !object.geometry?.getAttribute('uv')) return;
		let geometry = object.geometry.clone();
		geometry.applyMatrix4(object.matrixWorld);
		if (geometry.index) geometry = geometry.toNonIndexed();
		if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
		meshGeometries.push(geometry);
		vertexCount += geometry.getAttribute('position').count;
	});
	if (!meshGeometries.length) throw new Error('El GLB no contiene una malla con atributo UV.');
	const positions = new Float32Array(vertexCount * 3);
	const normals = new Float32Array(vertexCount * 3);
	const uvs = new Float32Array(vertexCount * 2);
	let offset = 0;
	for (const g of meshGeometries) {
		const count = g.getAttribute('position').count;
		positions.set(g.getAttribute('position').array, offset * 3);
		normals.set(g.getAttribute('normal').array, offset * 3);
		uvs.set(g.getAttribute('uv').array, offset * 2);
		offset += count;
		g.dispose();
	}
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
	geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
	geometry.computeBoundingBox();
	const box = geometry.boundingBox;
	const center = box.getCenter(new THREE.Vector3());
	const size = box.getSize(new THREE.Vector3());
	const scale = 3 / Math.max(size.x, size.y, size.z, 1e-6);
	geometry.translate(-center.x, -center.y, -center.z);
	geometry.scale(scale, scale, scale);
	return geometry;
}

class UVStrategiesLab extends Lab {
	static leftTitle = 'Escena 3D · coordenadas UV aplicadas';
	static centerTitle = 'Espacio UV · triángulos reales';
	static help = [
		'Clic en un triángulo de cualquiera de las dos vistas para relacionar la superficie 3D con sus coordenadas UV.',
		'Arrastrá en la escena para orbitar. En UV, usá la rueda para acercar y el botón derecho para desplazar.',
		'El wireframe se superpone a la textura; las líneas naranjas marcan costuras UV.',
		'El caso de unwrap carga un modelo GLB con su textura embebida (sin archivos aparte) y la muestra tal cual está en el archivo.',
	];

	constructor(layout) {
		super();
		this.caseId = this.constructor.caseId;
		this.config = CASES[this.caseId];
		this.store = createStore({
			case: this.caseId,
			object: 'plane',
			textureMode: 'real',
			wire: false,
			wireUV: true,
			seams: true,
			reference: true,
			boxColors: false,
			uvFilter: 'all',
			selected: null,
			sectionT: 0.55,
		});
		this.selectionUniforms = { uHasSelection: { value: 0 } };
		this.disposed = false;
		this.textures = {};
		this.textureCanvases = {
			diagnostic: createUvDiagnosticTexture(),
			checker: createCheckerTexture(),
			tube: createTubeTexture(),
			cola: createColaLabelTexture(),
		};
		this.textures.diagnostic = canvasTexture(this.textureCanvases.diagnostic);
		this.textures.checker = canvasTexture(this.textureCanvases.checker);
		this.textures.tube = canvasTexture(this.textureCanvases.tube);
		// El recorrido es mucho más largo que la sección: se repite ×3 a lo largo de v para que no se estire.
		this.textures.tube.wrapT = THREE.RepeatWrapping;
		this.textures.tube.repeat.set(1, 3);
		this.textures.tube.needsUpdate = true;
		this.textures.cola = canvasTexture(this.textureCanvases.cola);
		// Misma textura "Imagen (paisaje)" del capítulo anterior (Dimensiones y tipos de textura / Coordenadas UV).
		this.textures.landscape = getSharedTextureData('image', 512).toThree('clamp');

		this.view3d = new Scene3DView(layout.left, {
			position: this.config.camera,
			minDistance: 2.2,
			maxDistance: 14,
			onInvalidate: this.invalidate,
			tag: 'Clic: seleccionar · Arrastrar: orbitar',
		});
		this.view3d.renderer.outputColorSpace = THREE.SRGBColorSpace;
		const scene = this.view3d.scene;
		scene.add(new THREE.HemisphereLight(0xdbe9ff, 0x2d251c, 1.45));
		const key = new THREE.DirectionalLight(0xffffff, 2.25);
		key.position.set(4, 6, 5);
		scene.add(key);
		const grid = new THREE.GridHelper(9, 18, 0x354154, 0x222936);
		grid.position.y = -1.85;
		scene.add(grid);

		this.uvView = new TextureSpaceView(layout.center, {
			center: [0.5, 0.5],
			extent: 1.25,
			onInvalidate: this.invalidate,
			tag: 'Clic: seleccionar · Rueda: zoom · Botón derecho: paneo',
		});
		this.uvView.drawFn = (ctx, view) => this.drawUV(ctx, view);
		this.uvView.cursor = 'pointer';

		this.notice3d = document.createElement('div');
		this.notice3d.className = 'asset-notice';
		this.notice3d.hidden = true;
		layout.left.appendChild(this.notice3d);
		this.noticeUv = document.createElement('div');
		this.noticeUv.className = 'asset-notice';
		this.noticeUv.hidden = true;
		layout.center.appendChild(this.noticeUv);

		this.ensureMaterials();
		this.bindEvents();
		this.buildControls(layout.controls);
		this.store.subscribe((state, patch) => this.applyState(patch));
		this.loadCaseTexture();
		if (this.caseId === 'unwrap') this.loadUnwrapCase();
		else {
			this.buildCurrentGeometry();
			this.applyState({ textureMode: true, wire: true, seams: true, reference: true, boxColors: true, uvFilter: true });
		}
	}

	ensureMaterials() {
		const common = { roughness: 0.82, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };
		this.materialTextured = patchSelection(new THREE.MeshStandardMaterial(common), this.selectionUniforms);
		this.materialAxis = patchSelection(new THREE.MeshStandardMaterial({ ...common, vertexColors: true }), this.selectionUniforms);
	}

	loadCaseTexture() {
		const asset = this.caseId === 'planar' ? ASSET_URLS.terrain : this.caseId === 'cilindrica' ? ASSET_URLS.cylindricalStone : this.caseId === 'caja' ? ASSET_URLS.boxRock : this.caseId === 'generacion' ? ASSET_URLS.earth : null;
		if (!asset) return;
		const key = this.caseId === 'generacion' ? 'earth' : 'case';
		this.textures[key] = loadColorTexture(asset, () => {
			if (this.disposed) return;
			this.resourceError = null;
			this.updateMaterial();
			this.invalidate();
		}, () => {
			if (this.disposed) return;
			if (key === 'earth') this.resourceError = 'Falta maps/tierra.jpg; se muestra la textura diagnóstica.';
			this.invalidate();
		});
	}

	buildCurrentGeometry() {
		let data;
		if (this.caseId === 'generacion') data = buildGenerated(this.store.state.object);
		else if (this.caseId === 'planar') data = buildTerrain();
		else if (this.caseId === 'cilindrica') data = buildCylindricalProjection();
		else if (this.caseId === 'caja') data = buildBoxProjection();
		if (data) this.mountData(data);
	}

	mountData(data) {
		this.removeCurrentGeometry();
		this.data = data;
		const geometry = data.geometry;
		geometry.setAttribute('aSelected', new THREE.BufferAttribute(new Float32Array(data.triangleCount * 3), 1));
		const colors = new Float32Array(data.triangleCount * 9);
		for (let t = 0; t < data.triangleCount; t++) {
			const color = new THREE.Color(AXIS_COLORS[data.groups[t]] || '#8ca8d8');
			for (let k = 0; k < 3; k++) colors.set([color.r, color.g, color.b], (t * 3 + k) * 3);
		}
		geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
		this.mesh = new THREE.Mesh(geometry, this.materialTextured);
		this.view3d.scene.add(this.mesh);
		this.wire = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.34, depthTest: true }));
		this.view3d.scene.add(this.wire);
		this.selectionLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffd84d, depthTest: false }));
		this.selectionLines.renderOrder = 8;
		this.view3d.scene.add(this.selectionLines);
		this.mountSeams();
		this.mountGuides();
		this.mountProjectionReference();
		this.store.state.selected = null;
		this.updateSelection();
		this.updateMaterial();
		this.applyVisibility();
		this.invalidate();
	}

	removeCurrentGeometry() {
		for (const object of [this.mesh, this.wire, this.selectionLines, this.seamLines, this.guides, this.reference]) {
			if (!object) continue;
			this.view3d.scene.remove(object);
			if (object !== this.mesh && object !== this.wire) object.traverse?.((child) => {
				child.geometry?.dispose();
				child.material?.dispose();
			});
		}
		this.mesh?.geometry.dispose();
		this.wire?.material.dispose();
		this.mesh = this.wire = this.selectionLines = this.seamLines = this.guides = this.reference = null;
		this.sectionRingLine = null;
	}

	mountSeams() {
		const points = [];
		for (const { t, e } of this.data.seams) {
			points.push(this.offsetPosition(t, e, 0.018), this.offsetPosition(t, (e + 1) % 3, 0.018));
		}
		this.seamLines = new THREE.LineSegments(
			new THREE.BufferGeometry().setFromPoints(points),
			new THREE.LineBasicMaterial({ color: 0xff832d, depthTest: false })
		);
		this.seamLines.renderOrder = 7;
		this.view3d.scene.add(this.seamLines);
	}

	mountGuides() {
		this.guides = new THREE.Group();
		(this.data.guides || []).forEach((guide, index) => {
			const line = lineFromPoints(guide.points, guide.color);
			line.renderOrder = 9;
			this.guides.add(line);
			const mid = guide.points[Math.floor(guide.points.length / 2)];
			this.view3d.labels.set(`uv-guide-${index}`, {
				html: guide.label,
				position: mid,
				color: `#${guide.color.toString(16).padStart(6, '0')}`,
			});
		});
		if (!(this.data.guides || []).length) {
			this.view3d.labels.hide('uv-guide-0');
			this.view3d.labels.hide('uv-guide-1');
		}
		if (this.data.tube) {
			this.sectionRingLine = lineFromPoints(tubeSectionRing(this.data.tube, this.store.state.sectionT), 0xffd84d);
			this.sectionRingLine.renderOrder = 9;
			this.guides.add(this.sectionRingLine);
			this.updateSectionRing();
		} else {
			this.sectionRingLine = null;
			this.view3d.labels.hide('uv-guide-section');
		}
		this.view3d.scene.add(this.guides);
	}

	// Recalcula el anillo de la sección transversal del tubo en la posición elegida por el slider.
	updateSectionRing() {
		if (!this.sectionRingLine || !this.data?.tube) return;
		const ring = tubeSectionRing(this.data.tube, this.store.state.sectionT);
		this.sectionRingLine.geometry.setFromPoints(ring);
		this.view3d.labels.set('uv-guide-section', { html: 'u · sección', position: ring[0], color: '#ffd84d' });
		this.invalidate();
	}

	mountProjectionReference() {
		this.reference = new THREE.Group();
		const material = new THREE.MeshBasicMaterial({ color: 0x56c8ff, transparent: true, opacity: 0.2, wireframe: true, depthWrite: false });
		if (this.caseId === 'planar') {
			const plane = new THREE.Mesh(new THREE.PlaneGeometry(4.65, 4.65, 10, 10), material);
			plane.rotation.x = -Math.PI / 2;
			plane.position.y = 1.3;
			this.reference.add(plane);
		} else if (this.caseId === 'cilindrica') {
			this.reference.add(new THREE.Mesh(new THREE.CylinderGeometry(1.13, 1.13, 3.4, 32, 1, true), material));
			this.reference.add(lineFromPoints([V(0, -2, 0), V(0, 2, 0)], 0x56c8ff));
		} else if (this.caseId === 'caja') {
			this.reference.add(new THREE.Mesh(new THREE.BoxGeometry(3.05, 3.05, 3.05), material));
		}
		this.view3d.scene.add(this.reference);
	}

	offsetPosition(t, k, amount) {
		const p = this.data.positionAt(t, k);
		const i = (t * 3 + k) * 3;
		return p.addScaledVector(new THREE.Vector3(this.data.normal[i], this.data.normal[i + 1], this.data.normal[i + 2]), amount);
	}

	bindEvents() {
		onClick(this, this.view3d.dom, (event) => {
			if (!this.mesh || this.isHeavyMesh()) return;
			const hit = this.view3d.raycast(event, [this.mesh])[0];
			this.store.set({ selected: hit ? hit.faceIndex : null });
		});
		this.uvView.handlers.down = (uv) => {
			const triangle = this.triangleAtUV(uv);
			this.store.set({ selected: triangle });
			return triangle != null;
		};
		this.uvView.handlers.cursorAt = (uv) => this.triangleAtUV(uv) != null ? 'pointer' : 'default';
	}

	// Por encima de HEAVY_MESH_TRIANGLE_LIMIT se desactivan selección, costuras y el resaltado por
	// triángulo del panel UV (ver comentario junto a la constante).
	isHeavyMesh() {
		return !!this.data && this.data.triangleCount > HEAVY_MESH_TRIANGLE_LIMIT;
	}

	triangleAtUV(uv) {
		if (!this.data || this.isHeavyMesh()) return null;
		const query = new THREE.Vector3(uv[0], uv[1], 0);
		const barycentric = new THREE.Vector3();
		const triangle = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
		for (let t = this.data.triangleCount - 1; t >= 0; t--) {
			if (!this.isTriangleVisible(t)) continue;
			for (let k = 0; k < 3; k++) {
				const value = this.data.uvAt(t, k);
				triangle[k].set(value[0], value[1], 0);
			}
			if (THREE.Triangle.getBarycoord(query, triangle[0], triangle[1], triangle[2], barycentric) && barycentric.x >= 0 && barycentric.y >= 0 && barycentric.z >= 0) return t;
		}
		return null;
	}

	buildControls(element) {
		const panel = (this.panel = new ControlPanel(element, this.store));
		panel.idea(this.config.concept);
		if (this.caseId === 'generacion') {
			panel.select('object', 'Objeto', GENERATED_OBJECTS);
			this.sectionSlider = panel.slider('sectionT', 'Posición de la sección (v · recorrido)', { min: 0, max: 1, step: 0.01 });
			this.sectionSliderWrap = this.sectionSlider.closest('.ctl');
		}
		if (this.caseId !== 'unwrap') {
			const textureOptions = [
				{ value: 'real', label: 'Del caso' },
				{ value: 'diagnostic', label: 'UV diagnóstica' },
			];
			if (this.caseId === 'generacion') textureOptions.push({ value: 'landscape', label: 'Paisaje' });
			panel.segmented('textureMode', 'Textura aplicada', textureOptions);
		}
		panel.title('Visualización');
		panel.checkbox('wire', 'Mostrar wireframe');
		if (this.caseId === 'unwrap') panel.checkbox('wireUV', 'Mostrar wireframe en UV');
		if (this.caseId === 'generacion' || this.caseId === 'cilindrica' || this.caseId === 'unwrap') panel.checkbox('seams', 'Mostrar costura');
		if (['planar', 'cilindrica', 'caja'].includes(this.caseId)) panel.checkbox('reference', 'Mostrar referencia de proyección');
		if (this.caseId === 'caja') {
			panel.checkbox('boxColors', 'Colorear por proyección');
			panel.segmented('uvFilter', 'Filtro UV', [
				{ value: 'all', label: 'Todo' }, { value: 'x', label: 'X' }, { value: 'y', label: 'Y' }, { value: 'z', label: 'Z' },
			]);
		}
		panel.buttons({ label: 'Restablecer cámara', onClick: () => this.view3d.resetCamera() });
		this.readout = panel.readout();
	}

	applyState(patch = {}) {
		if (patch.case && this.store.state.case !== this.caseId) {
			location.hash = `#/estrategias-uv/${this.store.state.case}`;
			return;
		}
		if (patch.object && this.caseId === 'generacion') this.buildCurrentGeometry();
		if (patch.textureMode || patch.object || patch.boxColors) this.updateMaterial();
		if (patch.selected || Object.prototype.hasOwnProperty.call(patch, 'selected')) this.updateSelection();
		if (patch.uvFilter && this.store.state.selected != null && !this.isTriangleVisible(this.store.state.selected)) this.store.state.selected = null;
		if (patch.sectionT) this.updateSectionRing();
		if (this.sectionSliderWrap) this.sectionSliderWrap.style.display = this.data?.tube ? '' : 'none';
		this.applyVisibility();
		this.invalidate();
	}

	caseTexture() {
		const state = this.store.state;
		if (state.textureMode === 'diagnostic') return this.textures.diagnostic;
		if (state.textureMode === 'landscape') return this.textures.landscape;
		if (this.caseId === 'generacion') {
			if (state.object === 'tube') return this.textures.tube;
			if (state.object === 'bottle') return this.textures.cola;
			if (state.object === 'sphere') return this.textures.earth?.image?.complete ? this.textures.earth : this.textures.diagnostic;
			return this.textures.checker;
		}
		if (this.caseId === 'unwrap') return this.textures.atlas || this.textures.diagnostic;
		return this.textures.case || this.textures.diagnostic;
	}

	updateMaterial() {
		if (!this.mesh) return;
		const texture = this.caseTexture();
		this.materialTextured.map = texture;
		this.materialTextured.needsUpdate = true;
		this.mesh.material = this.caseId === 'caja' && this.store.state.boxColors ? this.materialAxis : this.materialTextured;
	}

	applyVisibility() {
		if (!this.data) return;
		const state = this.store.state;
		this.wire.visible = state.wire;
		this.seamLines.visible = state.seams && this.data.seams.length > 0;
		if (this.reference) this.reference.visible = state.reference && ['planar', 'cilindrica', 'caja'].includes(this.caseId);
	}

	updateSelection() {
		if (!this.data || !this.mesh) return;
		const selected = this.store.state.selected;
		const attribute = this.mesh.geometry.getAttribute('aSelected');
		attribute.array.fill(0);
		const points = [];
		if (selected != null && selected < this.data.triangleCount) {
			attribute.array.fill(1, selected * 3, selected * 3 + 3);
			for (let e = 0; e < 3; e++) points.push(this.offsetPosition(selected, e, 0.026), this.offsetPosition(selected, (e + 1) % 3, 0.026));
		}
		attribute.needsUpdate = true;
		this.selectionUniforms.uHasSelection.value = selected == null ? 0 : 1;
		this.selectionLines.geometry.setFromPoints(points);
		this.invalidate();
	}

	isTriangleVisible(t) {
		if (this.caseId !== 'caja' || this.store.state.uvFilter === 'all') return true;
		return this.data.groups[t] === ['x', 'y', 'z'].indexOf(this.store.state.uvFilter);
	}

	drawUV(ctx, view) {
		if (!this.data) return;
		const texture = this.caseTexture();
		const image = texture?.image;
		const [x, y] = view.toPx(0, 1);
		if (image && (!('complete' in image) || image.complete)) {
			ctx.save();
			ctx.globalAlpha = this.caseId === 'caja' && this.store.state.boxColors ? 0.36 : 0.9;
			ctx.drawImage(image, x, y, view.scale, view.scale);
			ctx.restore();
		}
		drawUnitSquare(ctx, view, 'rgba(255,255,255,.65)');
		const selected = this.store.state.selected;
		const heavy = this.isHeavyMesh();
		const showWireUV = this.store.state.wireUV;
		if (!heavy) {
			for (let t = 0; t < this.data.triangleCount; t++) {
				if (!this.isTriangleVisible(t)) continue;
				this.uvTrianglePath(ctx, view, t);
				if (this.caseId === 'caja' && this.store.state.boxColors) {
					ctx.fillStyle = `${AXIS_COLORS[this.data.groups[t]]}99`;
					ctx.fill();
				} else if (selected != null && selected !== t) {
					ctx.fillStyle = 'rgba(6,9,14,.32)';
					ctx.fill();
				}
				if (showWireUV) {
					ctx.strokeStyle = 'rgba(255,255,255,.28)';
					ctx.lineWidth = 1;
					ctx.stroke();
				}
			}
			if (this.store.state.seams) this.drawUvSeams(ctx, view);
			if (selected != null && this.isTriangleVisible(selected)) {
				this.uvTrianglePath(ctx, view, selected);
				ctx.fillStyle = 'rgba(255,216,77,.52)';
				ctx.fill();
				ctx.strokeStyle = '#ffd84d';
				ctx.lineWidth = 2.5;
				ctx.stroke();
			}
		} else {
			if (showWireUV) this.drawHeavyUvWireframe(ctx, view);
			drawTag(ctx, [`${this.data.triangleCount.toLocaleString('es')} triángulos`, 'resaltado por triángulo desactivado'], 8, 8, { color: '#dbe7fa' });
		}
		if (this.caseId === 'caja') {
			const active = this.store.state.uvFilter === 'all' ? 'X / Y / Z superpuestos' : `Solo proyección ${this.store.state.uvFilter.toUpperCase()}`;
			drawTag(ctx, active, view.w - 8, 8, { align: 'right', color: '#dbe7fa' });
		}
		if (this.caseId === 'generacion' && this.store.state.object === 'tube') {
			drawTag(ctx, ['u → alrededor de la sección', 'v ↑ a lo largo del recorrido'], view.w - 8, view.h - 60, { align: 'right', color: '#dbe7fa' });
		}
		drawRuler(ctx, view);
	}

	uvTrianglePath(ctx, view, triangle) {
		ctx.beginPath();
		for (let k = 0; k < 3; k++) {
			const uv = this.data.uvAt(triangle, k);
			const point = view.toPx(uv[0], uv[1]);
			if (k) ctx.lineTo(point[0], point[1]);
			else ctx.moveTo(point[0], point[1]);
		}
		ctx.closePath();
	}

	// Wireframe UV de una malla pesada: todas las aristas en un solo path/stroke (en vez de un
	// stroke por triángulo) para poder mostrarlo también cuando el resaltado por triángulo está
	// desactivado por rendimiento.
	drawHeavyUvWireframe(ctx, view) {
		ctx.save();
		ctx.strokeStyle = 'rgba(255,255,255,.22)';
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (let t = 0; t < this.data.triangleCount; t++) {
			if (!this.isTriangleVisible(t)) continue;
			for (let k = 0; k < 3; k++) {
				const uv = this.data.uvAt(t, k);
				const point = view.toPx(uv[0], uv[1]);
				if (k) ctx.lineTo(point[0], point[1]);
				else ctx.moveTo(point[0], point[1]);
			}
			ctx.closePath();
		}
		ctx.stroke();
		ctx.restore();
	}

	drawUvSeams(ctx, view) {
		ctx.save();
		ctx.strokeStyle = '#ff832d';
		ctx.lineWidth = 2.2;
		ctx.beginPath();
		for (const { t, e } of this.data.seams) {
			if (!this.isTriangleVisible(t)) continue;
			const a = this.data.uvAt(t, e);
			const b = this.data.uvAt(t, (e + 1) % 3);
			const pa = view.toPx(a[0], a[1]);
			const pb = view.toPx(b[0], b[1]);
			ctx.moveTo(pa[0], pa[1]);
			ctx.lineTo(pb[0], pb[1]);
		}
		ctx.stroke();
		ctx.restore();
	}

	async loadUnwrapCase() {
		this.setAssetNotice('Cargando modelo…', 'Leyendo el GLB y extrayendo su textura embebida (puede tardar unos segundos).');
		try {
			const gltf = await new Promise((resolve, reject) => new GLTFLoader().load(ASSET_URLS.unwrapModel, resolve, undefined, reject));
			if (this.disposed) return;
			const atlas = extractGlbTexture(gltf.scene);
			if (!atlas) throw new Error('El GLB no tiene ningún material con textura (material.map) para usar como atlas.');
			atlas.colorSpace = THREE.SRGBColorSpace;
			atlas.needsUpdate = true;
			this.textures.atlas = atlas;
			const geometry = combineModelMeshes(gltf.scene);
			this.mountData(dataFromModelGeometry(geometry));
			this.updateMaterial();
			if (this.data.triangleCount > HEAVY_MESH_TRIANGLE_LIMIT) {
				this.setAssetNotice(
					'Modelo de muy alto detalle',
					`${this.data.triangleCount.toLocaleString('es')} triángulos: se omiten costuras y selección por triángulo para mantener la vista fluida. Se muestran el modelo texturizado y el atlas.`
				);
			} else {
				this.setAssetNotice('', '');
			}
		} catch (error) {
			if (this.disposed) return;
			this.resourceError = error.message;
			this.setAssetNotice('Recursos pendientes', `No se pudo cargar el modelo: ${error.message}`);
			this.invalidate();
		}
	}

	setAssetNotice(title, detail) {
		for (const notice of [this.notice3d, this.noticeUv]) {
			notice.innerHTML = title ? `<strong>${title}</strong><span>${detail}</span>` : '';
			notice.hidden = !title;
		}
	}

	render() {
		this.view3d.render();
		this.uvView.render();
		this.updateReadout();
	}

	updateReadout() {
		let html;
		if (!this.data) {
			html = '<span class="k">Cargando el modelo…</span>';
		} else if (this.store.state.selected == null) {
			const hint = this.isHeavyMesh() ? 'selección por triángulo desactivada (modelo muy pesado)' : 'seleccioná uno en cualquier vista.';
			html = `<span class="k">Estrategia</span><br>${this.data.strategy}<br><span class="k">${this.data.triangleCount.toLocaleString('es')} triángulos · ${hint}</span>`;
		} else {
			const t = this.store.state.selected;
			const values = [0, 1, 2].map((k) => this.data.uvAt(t, k));
			html = `<span class="k">Triángulo</span> #${t}<br>${values.map((uv, index) => `<span class="k">UV${index}</span> (${fmt(uv[0], 3)}, ${fmt(uv[1], 3)})`).join('<br>')}<br><span class="k">Origen</span> ${this.data.strategy}`;
			if (this.caseId === 'caja') html += `<br><span class="k">Grupo</span> <span style="color:${AXIS_COLORS[this.data.groups[t]]}">${this.data.groupNames[this.data.groups[t]]}</span>`;
		}
		if (this.resourceError && this.caseId === 'generacion' && this.store.state.object === 'sphere') html += `<br><span class="resource-warning">${this.resourceError}</span>`;
		if (html !== this._lastReadout) {
			this.readout.innerHTML = html;
			this._lastReadout = html;
		}
	}

	dispose() {
		this.disposed = true;
		super.dispose();
		this.removeCurrentGeometry();
		this.view3d.dispose();
		this.uvView.dispose();
		this.panel.dispose();
		this.notice3d.remove();
		this.noticeUv.remove();
		this.materialTextured.dispose();
		this.materialAxis.dispose();
		new Set(Object.values(this.textures)).forEach((texture) => texture?.dispose());
	}
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class GeneratedUVLab extends UVStrategiesLab { static caseId = 'generacion'; }
export class PlanarUVLab extends UVStrategiesLab { static caseId = 'planar'; }
export class CylindricalUVLab extends UVStrategiesLab { static caseId = 'cilindrica'; }
export class BoxUVLab extends UVStrategiesLab { static caseId = 'caja'; }
export class UnwrapUVLab extends UVStrategiesLab { static caseId = 'unwrap'; }
