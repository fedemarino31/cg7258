import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DEFAULT_MODEL_VIEW_PRESET, MODEL_VIEW_PRESETS } from '../config/modelViewPresets.js';
import { paintGrassChecker } from '../config/grassCheckerConfig.js';
import { SCREEN_RASTER_CONFIG } from '../config/screenRasterConfig.js';
import {
	calculateRasterDimensions,
	ndcToRasterPixel,
	rasterizeTriangles,
} from '../pipeline/ScreenRasterizer.js';

export const grey_background = 0x343a40;
const sky_background = 0x87ceeb;
const black_background = 0x000000;

function createSelectedVertexMaterial(options = {}) {
	return new THREE.MeshPhongMaterial({
		color: 0xffff00,
		emissive: 0xffff00,
		emissiveIntensity: 0.5,
		specular: 0x000000,
		shininess: 0,
		depthTest: false,
		...options,
	});
}

function createGrassCheckerTexture() {
	const canvas = document.createElement('canvas');
	canvas.width = 160;
	canvas.height = 160;
	const context = canvas.getContext('2d');
	paintGrassChecker(context, canvas.width, canvas.height);
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.magFilter = THREE.NearestFilter;
	return texture;
}

const grassCheckerTexture = createGrassCheckerTexture();

function enableTeachingCameraProjectiveUvs(material) {
	material.onBeforeCompile = (shader) => {
		shader.vertexShader = `
			attribute vec2 teachingUvOverW;
			attribute float teachingOneOverW;
			varying vec2 vTeachingUvOverW;
			varying float vTeachingOneOverW;
		${shader.vertexShader}`.replace(
			'#include <uv_vertex>',
			`#include <uv_vertex>
			vTeachingUvOverW = teachingUvOverW;
			vTeachingOneOverW = teachingOneOverW;`
		);
		shader.fragmentShader = `
			varying vec2 vTeachingUvOverW;
			varying float vTeachingOneOverW;
		${shader.fragmentShader}`.replace(
			'#include <map_fragment>',
			`#ifdef USE_MAP
				vec2 projectiveUv = vTeachingUvOverW / max(vTeachingOneOverW, 1e-7);
				vec4 sampledDiffuseColor = texture2D(map, projectiveUv);
				diffuseColor *= sampledDiffuseColor;
			#endif`
		);
	};
	material.customProgramCacheKey = () => 'teaching-camera-projective-uv-v1';
}

const clipToDisplay = (position) => {
	const w = Math.abs(position.w) < 1e-6 ? 1e-6 : position.w;
	return new THREE.Vector3(position.x / w, position.y / w, position.z / w);
};

function distanceIntensity(distance, near, far) {
	const normalized = THREE.MathUtils.clamp((distance - near) / Math.max(far - near, 1e-6), 0, 1);
	return 0.94 - normalized * 0.8;
}

function distanceCss(distance, near, far, alpha = 1) {
	const channel = Math.round(distanceIntensity(distance, near, far) * 255);
	return `rgba(${channel}, ${channel}, ${channel}, ${alpha})`;
}

function addTriangleGeometry(
	group,
	triangles,
	mapper = (vertex) => vertex.position,
	shadingMode = 'wireframe',
	depthMapper = () => 0,
	depthRange = { near: 0, far: 1 }
) {
	const surfacePositions = [];
	const surfaceColors = [];
	const checkerPositions = [];
	const checkerColors = [];
	const checkerUvs = [];
	const checkerUvsOverW = [];
	const checkerOneOverW = [];
	let checkerHasProjectiveUvs = true;
	const edgePositions = [];
	const generatedPositions = [];
	for (const triangle of triangles) {
		const points = triangle.vertices.map((vertex) => mapper(vertex));
		const usesGrassChecker = triangle.mesh?.userData.grassChecker;
		for (let index = 0; index < 3; index += 1) {
			const point = points[index];
			const positions = usesGrassChecker ? checkerPositions : surfacePositions;
			const colors = usesGrassChecker ? checkerColors : surfaceColors;
			positions.push(point.x, point.y, point.z);
			if (shadingMode === 'distance') {
				const intensity = distanceIntensity(depthMapper(triangle.vertices[index], triangle), depthRange.near, depthRange.far);
				colors.push(intensity, intensity, intensity);
			} else {
				const color = triangle.color;
				colors.push(color.r, color.g, color.b);
			}
			if (usesGrassChecker) {
				const uv = triangle.vertices[index].uv ?? triangle.uvs[index];
				checkerUvs.push(uv.x, uv.y);
				const teachingW = triangle.vertices[index].clipW ?? triangle.vertices[index].cameraDepth;
				if (Number.isFinite(teachingW)) {
					const reciprocalW = 1 / Math.max(Math.abs(teachingW), 1e-7);
					checkerUvsOverW.push(uv.x * reciprocalW, uv.y * reciprocalW);
					checkerOneOverW.push(reciprocalW);
				} else {
					checkerHasProjectiveUvs = false;
					checkerUvsOverW.push(uv.x, uv.y);
					checkerOneOverW.push(1);
				}
			}
			const next = points[(index + 1) % 3];
			edgePositions.push(point.x, point.y, point.z, next.x, next.y, next.z);
			if (triangle.vertices[index].generatedByClipping) generatedPositions.push(point.x, point.y, point.z);
		}
	}
	if (!surfacePositions.length && !checkerPositions.length) return;

	const createSurface = (positions, colors, checkerUvsForSurface = null, projectiveUvs = null) => {
		if (!positions.length) return null;
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
		geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
		if (checkerUvsForSurface) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(checkerUvsForSurface, 2));
		if (projectiveUvs) {
			geometry.setAttribute('teachingUvOverW', new THREE.Float32BufferAttribute(projectiveUvs.uvOverW, 2));
			geometry.setAttribute('teachingOneOverW', new THREE.Float32BufferAttribute(projectiveUvs.oneOverW, 1));
		}
		geometry.computeVertexNormals();
		const materialOptions = {
			vertexColors: !checkerUvsForSurface || shadingMode === 'distance',
			map: checkerUvsForSurface && shadingMode !== 'distance' ? grassCheckerTexture : null,
			side: THREE.DoubleSide,
		};
		const surfaceMaterial = shadingMode === 'solid'
			? new THREE.MeshPhongMaterial({
				...materialOptions,
				flatShading: true,
				shininess: 35,
				specular: 0x526175,
			})
			: new THREE.MeshBasicMaterial({
				...materialOptions,
				transparent: shadingMode !== 'distance',
				opacity: shadingMode === 'distance' ? 1 : 0.42,
				depthWrite: true,
			});
		if (projectiveUvs && shadingMode !== 'distance') enableTeachingCameraProjectiveUvs(surfaceMaterial);
		return new THREE.Mesh(geometry, surfaceMaterial);
	};
	const surface = createSurface(surfacePositions, surfaceColors);
	const checkerSurface = createSurface(
		checkerPositions,
		checkerColors,
		checkerUvs,
		checkerHasProjectiveUvs ? { uvOverW: checkerUvsOverW, oneOverW: checkerOneOverW } : null
	);
	const edgeGeometry = new THREE.BufferGeometry();
	edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
	const edges = new THREE.LineSegments(
		edgeGeometry,
		new THREE.LineBasicMaterial({ color: 0xdbeafe, transparent: true, opacity: 0.66 })
	);
	if (surface) group.add(surface);
	if (checkerSurface) group.add(checkerSurface);
	if (shadingMode === 'wireframe') group.add(edges);

	if (generatedPositions.length) {
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(generatedPositions, 3));
		group.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xff4fd8, size: 0.055 })));
	}
}

function addCanonicalCube(group, showAxes = true, color = 0x58e6c2, flipZAxis = false) {
	const box = new THREE.LineSegments(
		new THREE.EdgesGeometry(new THREE.BoxGeometry(2, 2, 2)),
		new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 })
	);
	group.add(box);
	if (showAxes) {
		const axes = new THREE.AxesHelper(1.45);
		if (flipZAxis) axes.scale.z = -1;
		group.add(axes);
	}
}

function createPlaneLabel(text, position) {
	const canvas = document.createElement('canvas');
	canvas.width = 192;
	canvas.height = 64;
	const context = canvas.getContext('2d');
	context.font = "600 30px 'DM Mono', monospace";
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	context.fillStyle = '#ffffff';
	context.fillText(text, canvas.width / 2, canvas.height / 2);
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
	sprite.position.copy(position);
	sprite.scale.set(0.36, 0.12, 1);
	sprite.renderOrder = 30;
	return sprite;
}

function addNdcPlaneLabels(group) {
	// NDC is displayed with its Z axis flipped, so near is the front (+Z) face.
	group.add(
		createPlaneLabel('NEAR', new THREE.Vector3(1.28, 0.82, 1.04)),
		createPlaneLabel('FAR', new THREE.Vector3(1.28, 0.82, -1.04))
	);
}

function drawCheckerCanvasTriangle(context, vertices, points, alpha) {
	const image = grassCheckerTexture.image;
	const source = vertices.map((vertex) => ({
		x: vertex.uv.x * image.width,
		y: (1 - vertex.uv.y) * image.height,
	}));
	const [s0, s1, s2] = source;
	const [d0, d1, d2] = points;
	const denominator = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
	if (Math.abs(denominator) < 1e-8) return;
	const solve = (v0, v1, v2) => ({
		x: (v0 * (s1.y - s2.y) + v1 * (s2.y - s0.y) + v2 * (s0.y - s1.y)) / denominator,
		y: (v0 * (s2.x - s1.x) + v1 * (s0.x - s2.x) + v2 * (s1.x - s0.x)) / denominator,
		offset: (v0 * (s1.x * s2.y - s2.x * s1.y)
			+ v1 * (s2.x * s0.y - s0.x * s2.y)
			+ v2 * (s0.x * s1.y - s1.x * s0.y)) / denominator,
	});
	const horizontal = solve(d0.x, d1.x, d2.x);
	const vertical = solve(d0.y, d1.y, d2.y);
	context.save();
	context.beginPath();
	context.moveTo(d0.x, d0.y);
	context.lineTo(d1.x, d1.y);
	context.lineTo(d2.x, d2.y);
	context.closePath();
	context.clip();
	context.globalAlpha = alpha;
	context.transform(horizontal.x, vertical.x, horizontal.y, vertical.y, horizontal.offset, vertical.offset);
	context.drawImage(image, 0, 0);
	context.restore();
}

function addViewFrustum(group, camera) {
	// In view space the teaching camera lives at the origin and looks down -Z.
	// Reusing CameraHelper keeps this diagram visually identical to the helper in
	// the reference scene: yellow frustum, red cone, blue UP and dark crosses.
	const viewCamera = camera.clone(false);
	viewCamera.position.set(0, 0, 0);
	viewCamera.quaternion.identity();
	viewCamera.scale.set(1, 1, 1);
	viewCamera.updateMatrixWorld(true);

	const helper = new THREE.CameraHelper(viewCamera);
	helper.name = 'View Space Camera Frustum';
	group.add(helper);
}

export class PipelineVisualizer {
	constructor(container, screenCanvas, coordinateCanvas) {
		this.container = container;
		this.screenCanvas = screenCanvas;
		this.coordinateCanvas = coordinateCanvas;
		this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.setClearColor(0x0b0e14, 1);
		container.appendChild(this.renderer.domElement);
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(sky_background);
		const hemisphereLight = new THREE.HemisphereLight(0xe5f2ff, 0x222936, 1.45);
		const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
		keyLight.position.set(5, 8, 6);
		const fillLight = new THREE.DirectionalLight(0x9fc7ff, 0.8);
		fillLight.position.set(-5, 2, -4);
		this.scene.add(hemisphereLight, keyLight, fillLight);
		this.camera = new THREE.PerspectiveCamera(42, 1, 0.01, 120);
		this.camera.position.set(8, 6, 9);
		this.screenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 5);
		this.screenCamera.position.set(0, 0, 3);
		this.screenCamera.lookAt(0, 0, 0);
		this.screenCamera.updateMatrixWorld(true);
		this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		this.controls.enableDamping = true;
		this.controls.target.set(0, 0.6, 0);
		this.stage = 'model';
		this.clipMode = 'plots';
		this.screenViewMode = 'raster';
		this.screenRasterWidth = SCREEN_RASTER_CONFIG.width;
		this.shadingMode = 'solid';
		this.showAxes = true;
		this.ndcCameraState = null;
		this.viewCameraState = null;
		this.group = new THREE.Group();
		this.scene.add(this.group);
	}

	setClipMode(mode) {
		this.clipMode = mode;
	}

	setScreenViewMode(mode) {
		this.screenViewMode = mode;
	}

	setScreenRasterWidth(width) {
		this.screenRasterWidth = width;
	}

	setShadingMode(mode) {
		this.shadingMode = mode;
	}

	setHelperVisibility(helper, visible) {
		if (helper === 'axes') this.showAxes = visible;
	}

	resize() {
		const width = Math.max(1, this.container.clientWidth);
		const height = Math.max(1, this.container.clientHeight);
		this.renderer.setSize(width, height, false);
		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
		return { width, height };
	}

	setStage(stage, result, trackedVertex, teachingCamera) {
		const previousStage = this.stage;
		const stageChanged = stage !== previousStage;
		if (stageChanged && previousStage === 'ndc') this.ndcCameraState = this.captureOrbitState();
		if (stageChanged && previousStage === 'view') this.viewCameraState = this.captureOrbitState();
		this.stage = stage;
		this.scene.background = new THREE.Color(
			['model', 'world', 'view', 'ndc'].includes(stage) || (stage === 'clip' && this.clipMode === 'preview')
				? grey_background
				: stage === 'screen' ? black_background : sky_background
		);
		this.depthRange = { near: teachingCamera.near, far: teachingCamera.far };
		this.group.clear();
		const canvasMode = (stage === 'clip' && this.clipMode === 'plots')
			|| (stage === 'screen' && this.screenViewMode !== 'vector');
		this.renderer.domElement.hidden = canvasMode;
		this.screenCanvas.hidden = !canvasMode;
		this.coordinateCanvas.hidden = stage !== 'screen';
		const orbitHint = this.container.parentElement.querySelector('.orbit-hint');
		if (orbitHint) orbitHint.hidden = canvasMode || stage === 'screen';
		if (stage === 'screen') {
			const rasterDimensions = calculateRasterDimensions(result.viewport, this.screenRasterWidth);
			const aspect = this.screenViewMode === 'vector'
				? result.viewport.width / Math.max(1, result.viewport.height)
				: rasterDimensions.width / rasterDimensions.height;
			this.screenLayout = this.calculateScreenLayout(aspect);
			this.drawScreenCoordinates(rasterDimensions);
			if (this.screenViewMode !== 'vector') {
				this.drawRasterScreen(result, rasterDimensions, this.screenViewMode === 'raster-wireframe');
				return;
			}
			const screenMapper = (vertex) => new THREE.Vector3(
				vertex.position.x,
				vertex.position.y,
				-vertex.position.z
			);
			addTriangleGeometry(
				this.group,
				result.ndc,
				screenMapper,
				this.shadingMode,
				(vertex) => vertex.cameraDepth,
				this.depthRange
			);
			this.addScreenFrame();
			if (result.tracked.visible) this.addScreenMarker(result.tracked.ndc);
			return;
		}
		if (stage === 'clip' && this.clipMode === 'plots') {
			this.drawClipPlots(result);
			return;
		}

		if (stage === 'model') {
			const modelTriangles = result.world
				.filter((triangle) => triangle.mesh === trackedVertex.mesh)
				.map((triangle) => ({ ...triangle, vertices: triangle.localVertices.map((position) => ({ position })) }));
			const modelDepth = (vertex, triangle) => -vertex.position.clone()
				.applyMatrix4(triangle.mesh.matrixWorld)
				.applyMatrix4(teachingCamera.matrixWorldInverse).z;
			addTriangleGeometry(this.group, modelTriangles, undefined, this.shadingMode, modelDepth, this.depthRange);
			if (this.showAxes) this.group.add(new THREE.AxesHelper(1.6));
			this.applyModelViewPreset(trackedVertex.mesh);
		} else if (stage === 'world') {
			const worldDepth = (vertex) => -vertex.position.clone().applyMatrix4(teachingCamera.matrixWorldInverse).z;
			addTriangleGeometry(this.group, result.world.map((triangle) => ({ ...triangle, vertices: triangle.vertices.map((position) => ({ position })) })), undefined, this.shadingMode, worldDepth, this.depthRange);
			if (this.showAxes) this.group.add(new THREE.AxesHelper(2.2));
			this.focus(12, new THREE.Vector3(0, 1, 0));
		} else if (stage === 'view') {
			addTriangleGeometry(this.group, result.view.map((triangle) => ({ ...triangle, vertices: triangle.vertices.map((position) => ({ position })) })), undefined, this.shadingMode, (vertex) => -vertex.position.z, this.depthRange);
			if (this.showAxes) this.group.add(new THREE.AxesHelper(1.5));
			addViewFrustum(this.group, teachingCamera);
			if (stageChanged) {
				if (this.viewCameraState) this.restoreOrbitState(this.viewCameraState);
				else this.focus(16, new THREE.Vector3(0, 0, -4));
			}
		} else if (stage === 'clip') {
			// Clip space is 4D. Its visible result is embedded in 3D using x/w,
			// y/w and z/w, while the inspector keeps the original homogeneous w.
			addTriangleGeometry(this.group, result.ndc, undefined, this.shadingMode, (vertex) => vertex.cameraDepth, this.depthRange);
			addCanonicalCube(this.group, this.showAxes, 0x000000);
			this.focus(4.2, new THREE.Vector3());
		} else if (stage === 'ndc') {
			const ndcDisplayMapper = (vertex) => new THREE.Vector3(
				vertex.position.x,
				vertex.position.y,
				-vertex.position.z
			);
			addTriangleGeometry(this.group, result.ndc, ndcDisplayMapper, this.shadingMode, (vertex) => vertex.cameraDepth, this.depthRange);
			addCanonicalCube(this.group, this.showAxes, 0x000000, true);
			addNdcPlaneLabels(this.group);
			if (stageChanged) {
				if (this.ndcCameraState) this.restoreOrbitState(this.ndcCameraState);
				else this.focus(4.2, new THREE.Vector3());
			}
		}
		this.addMarker(result.tracked[stage]);
	}

	addScreenFrame() {
		const points = [
			new THREE.Vector3(-1, -1, 1.02),
			new THREE.Vector3(1, -1, 1.02),
			new THREE.Vector3(1, 1, 1.02),
			new THREE.Vector3(-1, 1, 1.02),
			new THREE.Vector3(-1, -1, 1.02),
		];
		const geometry = new THREE.BufferGeometry().setFromPoints(points);
		const frame = new THREE.Line(
			geometry,
			new THREE.LineBasicMaterial({ color: 0x58e6c2, depthTest: false })
		);
		frame.renderOrder = 20;
		this.group.add(frame);
	}

	addScreenMarker(ndc) {
		const marker = new THREE.Mesh(
			new THREE.CircleGeometry(0.018, 20),
			createSelectedVertexMaterial({ side: THREE.DoubleSide })
		);
		marker.position.set(ndc.x, ndc.y, 1.08);
		marker.renderOrder = 30;
		this.group.add(marker);
	}

	applyModelViewPreset(mesh) {
		const preset = MODEL_VIEW_PRESETS[mesh.name] ?? DEFAULT_MODEL_VIEW_PRESET;
		this.camera.position.fromArray(preset.position);
		this.controls.target.fromArray(preset.target);
		this.camera.near = preset.near;
		this.camera.far = preset.far;
		this.camera.updateProjectionMatrix();
		this.controls.update();
	}

	prepareCanvas(canvas = this.screenCanvas, fillBackground = true, background = '#000000') {
		const rect = this.container.getBoundingClientRect();
		const dpr = Math.min(window.devicePixelRatio, 2);
		canvas.width = Math.max(1, Math.round(rect.width * dpr));
		canvas.height = Math.max(1, Math.round(rect.height * dpr));
		canvas.style.width = `${rect.width}px`;
		canvas.style.height = `${rect.height}px`;
		const context = canvas.getContext('2d');
		context.setTransform(dpr, 0, 0, dpr, 0, 0);
		if (fillBackground) {
			context.fillStyle = background;
			context.fillRect(0, 0, rect.width, rect.height);
		}
		return { context, rect };
	}

	calculateScreenLayout(aspect) {
		const rect = this.container.getBoundingClientRect();
		const margins = {
			left: Math.min(52, rect.width * 0.12),
			right: 18,
			top: Math.min(64, Math.max(48, rect.height * 0.14)),
			bottom: 38,
		};
		const availableWidth = Math.max(1, rect.width - margins.left - margins.right);
		const availableHeight = Math.max(1, rect.height - margins.top - margins.bottom);
		let width = availableWidth;
		let height = width / Math.max(aspect, 1e-6);
		if (height > availableHeight) {
			height = availableHeight;
			width = height * aspect;
		}
		return {
			x: margins.left + (availableWidth - width) * 0.5,
			y: margins.top + (availableHeight - height) * 0.5,
			width,
			height,
		};
	}

	drawRasterScreen(result, dimensions, showWireframe) {
		const { context } = this.prepareCanvas(this.screenCanvas, true, '#0b0e14');
		const raster = rasterizeTriangles(result.ndc, dimensions, {
			shadingMode: this.shadingMode,
			depthRange: this.depthRange,
		});
		const bitmap = document.createElement('canvas');
		bitmap.width = dimensions.width;
		bitmap.height = dimensions.height;
		const bitmapContext = bitmap.getContext('2d');
		const image = bitmapContext.createImageData(dimensions.width, dimensions.height);
		image.data.set(raster.pixels);
		bitmapContext.putImageData(image, 0, 0);

		const layout = this.screenLayout;
		context.imageSmoothingEnabled = false;
		context.drawImage(bitmap, layout.x, layout.y, layout.width, layout.height);
		if (dimensions.width !== 256) this.drawPixelGrid(context, dimensions);
		if (showWireframe) this.drawProjectedWireframe(context, result.ndc);

		if (result.tracked.visible) {
			const pixel = ndcToRasterPixel(result.tracked.ndc, dimensions.width, dimensions.height);
			const x = layout.x + (pixel.x + 0.5) * layout.width / dimensions.width;
			const y = layout.y + (pixel.y + 0.5) * layout.height / dimensions.height;
			context.fillStyle = '#ffff00';
			context.beginPath();
			context.arc(x, y, 3.2, 0, Math.PI * 2);
			context.fill();
		}
	}

	drawPixelGrid(context, dimensions) {
		const layout = this.screenLayout;
		context.save();
		context.beginPath();
		for (let x = 0; x <= dimensions.width; x += 1) {
			const position = layout.x + x * layout.width / dimensions.width;
			context.moveTo(position, layout.y);
			context.lineTo(position, layout.y + layout.height);
		}
		for (let y = 0; y <= dimensions.height; y += 1) {
			const position = layout.y + y * layout.height / dimensions.height;
			context.moveTo(layout.x, position);
			context.lineTo(layout.x + layout.width, position);
		}
		context.strokeStyle = '#333333';
		context.lineWidth = SCREEN_RASTER_CONFIG.gridLineWidth;
		context.stroke();
		context.restore();
	}

	drawProjectedWireframe(context, triangles) {
		const layout = this.screenLayout;
		const map = (position) => ({
			x: layout.x + (position.x * 0.5 + 0.5) * layout.width,
			y: layout.y + (1 - (position.y * 0.5 + 0.5)) * layout.height,
		});
		context.save();
		context.beginPath();
		context.rect(layout.x, layout.y, layout.width, layout.height);
		context.clip();
		context.beginPath();
		for (const triangle of triangles) {
			triangle.vertices.forEach((vertex, index) => {
				const point = map(vertex.position);
				if (index === 0) context.moveTo(point.x, point.y); else context.lineTo(point.x, point.y);
			});
			context.closePath();
		}
		context.strokeStyle = '#dbeafe';
		context.lineWidth = 1.25;
		context.stroke();
		context.restore();
	}

	drawScreenCoordinates(rasterDimensions) {
		const { context } = this.prepareCanvas(this.coordinateCanvas, false);
		const layout = this.screenLayout;
		const vectorMode = this.screenViewMode === 'vector';
		context.save();
		context.font = "9px 'DM Mono', monospace";
		context.fillStyle = '#8d98a9';
		context.strokeStyle = '#566174';
		context.lineWidth = 1;
		context.textAlign = 'center';
		context.textBaseline = 'top';

		const xTicks = vectorMode
			? [-1, -0.5, 0, 0.5, 1].map((value) => ({ value, ratio: (value + 1) / 2 }))
			: this.rasterTicks(rasterDimensions.width).map((value) => ({ value, ratio: (value + 0.5) / rasterDimensions.width }));
		for (const tick of xTicks) {
			const x = layout.x + tick.ratio * layout.width;
			context.beginPath();
			context.moveTo(x, layout.y + layout.height);
			context.lineTo(x, layout.y + layout.height + 4);
			context.stroke();
			context.fillText(this.formatCoordinateTick(tick.value), x, layout.y + layout.height + 7);
		}

		const yTicks = vectorMode
			? [1, 0.5, 0, -0.5, -1].map((value) => ({ value, ratio: (1 - value) / 2 }))
			: this.rasterTicks(rasterDimensions.height).map((value) => ({ value, ratio: (value + 0.5) / rasterDimensions.height }));
		context.textAlign = 'right';
		context.textBaseline = 'middle';
		for (const tick of yTicks) {
			const y = layout.y + tick.ratio * layout.height;
			context.beginPath();
			context.moveTo(layout.x - 4, y);
			context.lineTo(layout.x, y);
			context.stroke();
			context.fillText(this.formatCoordinateTick(tick.value), layout.x - 7, y);
		}

		context.fillStyle = '#8d98a9';
		context.font = "8px 'DM Mono', monospace";
		context.textAlign = 'right';
		context.textBaseline = 'bottom';
		context.fillText(vectorMode ? 'NDC X' : 'PIXEL X', layout.x + layout.width, layout.y - 7);
		context.save();
		context.translate(layout.x - 35, layout.y + layout.height * 0.5);
		context.rotate(-Math.PI / 2);
		context.textAlign = 'center';
		context.fillText(vectorMode ? 'NDC Y' : 'PIXEL Y', 0, 0);
		context.restore();
		context.restore();
	}

	rasterTicks(size) {
		const ticks = [];
		const interval = Math.max(1, Math.round(size / 8));
		for (let value = 0; value < size; value += interval) ticks.push(value);
		if (ticks[ticks.length - 1] !== size - 1) ticks.push(size - 1);
		return ticks;
	}

	formatCoordinateTick(value) {
		return String(value).replace('-', '−');
	}

	drawClipPlots(result) {
		const { context, rect } = this.prepareCanvas();
		const clipTitleFontSize = 16.5;
		const clipLabelFontSize = 14.85;
		const components = [
			{ key: 'x', label: 'X — W', equation: '−w ≤ x ≤ w' },
			{ key: 'y', label: 'Y — W', equation: '−w ≤ y ≤ w' },
			{ key: 'z', label: 'Z — W', equation: '−w ≤ z ≤ w' },
		];
		const top = Math.min(72, rect.height * 0.18);
		const gap = 12;
		const horizontal = rect.width >= 620;
		const columns = horizontal ? 3 : 1;
		const rows = horizontal ? 1 : 3;
		const panelWidth = (rect.width - 32 - gap * (columns - 1)) / columns;
		const panelHeight = (rect.height - top - 24 - gap * (rows - 1)) / rows;
		const rawVertices = result.clip.flatMap((triangle) => triangle.vertices);
		const clippedVertices = result.clipped.flatMap((triangle) => triangle.vertices.map((vertex) => vertex.position));
		const allVertices = [...rawVertices, ...clippedVertices];
		const maxW = Math.max(1, ...allVertices.map((vertex) => Math.max(0, vertex.w)));
		const minW = Math.min(0, ...allVertices.map((vertex) => vertex.w));

		components.forEach((component, componentIndex) => {
			const column = horizontal ? componentIndex : 0;
			const row = horizontal ? 0 : componentIndex;
			const panel = { x: 16 + column * (panelWidth + gap), y: top + row * (panelHeight + gap), width: panelWidth, height: panelHeight };
			const padding = { left: 32, right: 12, top: 33, bottom: 25 };
			const plot = { x: panel.x + padding.left, y: panel.y + padding.top, width: panel.width - padding.left - padding.right, height: panel.height - padding.top - padding.bottom };
			const maxComponent = Math.max(maxW, ...allVertices.map((vertex) => Math.abs(vertex[component.key]))) * 1.06;
			const wMin = minW * 1.05;
			const wMax = maxW * 1.06;
			const mapX = (value) => plot.x + ((value + maxComponent) / (2 * maxComponent)) * plot.width;
			const mapW = (value) => plot.y + plot.height - ((value - wMin) / (wMax - wMin || 1)) * plot.height;

			context.fillStyle = '#0f141d';
			context.fillRect(panel.x, panel.y, panel.width, panel.height);
			context.strokeStyle = '#273142';
			context.strokeRect(panel.x + 0.5, panel.y + 0.5, panel.width - 1, panel.height - 1);
			context.textAlign = 'left';
			context.font = `500 ${clipTitleFontSize}px 'DM Mono', monospace`;
			context.fillStyle = '#e5edf7';
			context.fillText(component.label, panel.x + 12, panel.y + 16);
			context.fillStyle = '#657287';
			context.font = `${clipLabelFontSize}px 'DM Mono', monospace`;
			context.fillText(component.equation, panel.x + 68, panel.y + 16);

			context.save();
			context.beginPath();
			context.rect(plot.x, plot.y, plot.width, plot.height);
			context.clip();
			context.beginPath();
			context.moveTo(mapX(0), mapW(0));
			context.lineTo(mapX(maxW), mapW(maxW));
			context.lineTo(mapX(-maxW), mapW(maxW));
			context.closePath();
			context.fillStyle = '#58e6c20b';
			context.fill();
			context.strokeStyle = '#58e6c2aa';
			context.lineWidth = 1;
			context.beginPath();
			context.moveTo(mapX(-maxW), mapW(maxW));
			context.lineTo(mapX(0), mapW(0));
			context.lineTo(mapX(maxW), mapW(maxW));
			context.stroke();

			for (const triangle of result.clip) {
				const outside = triangle.vertices.some((vertex) => Math.abs(vertex.x) > vertex.w || Math.abs(vertex.y) > vertex.w || Math.abs(vertex.z) > vertex.w);
				context.beginPath();
				triangle.vertices.forEach((vertex, index) => {
					const x = mapX(vertex[component.key]);
					const y = mapW(vertex.w);
					if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
				});
				context.closePath();
				context.strokeStyle = outside ? '#ff657719' : '#aebed018';
				context.lineWidth = 0.55;
				context.stroke();
			}

			for (const triangle of result.clipped) {
				const points = triangle.vertices.map((vertex) => ({
					x: mapX(vertex.position[component.key]),
					y: mapW(vertex.position.w),
				}));
				const averageDepth = triangle.vertices.reduce((sum, vertex) => sum + vertex.position.w, 0) / 3;
				const color = `#${triangle.color.getHexString()}`;
				if (triangle.mesh?.userData.grassChecker && this.shadingMode !== 'distance') {
					drawCheckerCanvasTriangle(context, triangle.vertices, points, this.shadingMode === 'solid' ? 0.72 : 0.28);
				} else {
					context.beginPath();
					points.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
					context.closePath();
					context.fillStyle = this.shadingMode === 'distance'
						? distanceCss(averageDepth, this.depthRange.near, this.depthRange.far)
						: `${color}${this.shadingMode === 'solid' ? 'b8' : '48'}`;
					context.fill();
				}
				if (this.shadingMode === 'wireframe') {
					context.beginPath();
					points.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
					context.closePath();
					context.strokeStyle = '#e4edf5aa';
					context.lineWidth = 0.6;
					context.stroke();
				}
				for (const vertex of triangle.vertices) {
					if (!vertex.generatedByClipping) continue;
					context.fillStyle = '#ff4fd8';
					context.beginPath();
					context.arc(mapX(vertex.position[component.key]), mapW(vertex.position.w), 1.8, 0, Math.PI * 2);
					context.fill();
				}
			}

			const tracked = result.tracked.clip;
			context.fillStyle = '#ffff00';
			context.beginPath();
			context.arc(mapX(tracked[component.key]), mapW(tracked.w), 4, 0, Math.PI * 2);
			context.fill();
			context.restore();

			context.strokeStyle = '#3b4658';
			context.lineWidth = 0.75;
			context.beginPath();
			context.moveTo(mapX(0), plot.y);
			context.lineTo(mapX(0), plot.y + plot.height);
			context.moveTo(plot.x, mapW(0));
			context.lineTo(plot.x + plot.width, mapW(0));
			context.stroke();
			context.fillStyle = '#69768a';
			context.font = `${clipLabelFontSize}px 'DM Mono', monospace`;
			context.textAlign = 'left';
			context.fillText('w', mapX(0) + 5, plot.y + 10);
			context.textAlign = 'right';
			context.fillText(component.key, plot.x + plot.width - 4, mapW(0) - 5);
			if (component.key === 'z') {
				context.fillStyle = '#58e6c2';
				context.textAlign = 'left';
				context.fillText('far  z = +w', plot.x + 8, plot.y + 12);
				context.textAlign = 'right';
				context.fillText('near  z = −w', plot.x + plot.width - 8, plot.y + 12);
			}
		});
	}

	focus(distance, target) {
		this.controls.target.copy(target);
		this.camera.position.copy(target).add(new THREE.Vector3(distance * 0.62, distance * 0.46, distance * 0.72));
		this.camera.near = Math.max(0.01, distance / 1000);
		this.camera.far = distance * 12;
		this.camera.updateProjectionMatrix();
		this.controls.update();
	}

	captureOrbitState() {
		return {
			position: this.camera.position.clone(),
			target: this.controls.target.clone(),
			up: this.camera.up.clone(),
			zoom: this.camera.zoom,
			near: this.camera.near,
			far: this.camera.far,
		};
	}

	restoreOrbitState(state) {
		this.camera.position.copy(state.position);
		this.controls.target.copy(state.target);
		this.camera.up.copy(state.up);
		this.camera.zoom = state.zoom;
		this.camera.near = state.near;
		this.camera.far = state.far;
		this.camera.updateProjectionMatrix();
		this.controls.update();
	}

	addMarker(vector) {
		if (!vector) return;
		const point = this.stage === 'clip' ? clipToDisplay({ position: vector }) : new THREE.Vector3(vector.x, vector.y, vector.z);
		if (this.stage === 'ndc') point.z *= -1;
		const marker = new THREE.Mesh(
			new THREE.SphereGeometry(this.stage === 'world' || this.stage === 'view' ? 0.06 : 0.0225, 12, 8),
			createSelectedVertexMaterial()
		);
		marker.position.copy(point);
		marker.renderOrder = 10;
		this.group.add(marker);
	}

	render() {
		if (this.stage === 'clip' && this.clipMode === 'plots') return;
		if (this.stage === 'screen') {
			if (this.screenViewMode !== 'vector') return;
			const rect = this.container.getBoundingClientRect();
			const layout = this.screenLayout ?? this.calculateScreenLayout(rect.width / Math.max(1, rect.height));
			this.renderer.setScissorTest(false);
			this.renderer.setViewport(0, 0, rect.width, rect.height);
			// Rendering a scene background updates WebGL's active clear color.
			// Restore the dark perimeter before clearing the full screen canvas.
			this.renderer.setClearColor(0x0b0e14, 1);
			this.renderer.clear();
			this.renderer.setViewport(layout.x, rect.height - layout.y - layout.height, layout.width, layout.height);
			this.renderer.setScissor(layout.x, rect.height - layout.y - layout.height, layout.width, layout.height);
			this.renderer.setScissorTest(true);
			this.renderer.render(this.scene, this.screenCamera);
			this.renderer.setScissorTest(false);
			return;
		}
		this.renderer.setScissorTest(false);
		const rect = this.container.getBoundingClientRect();
		this.renderer.setViewport(0, 0, rect.width, rect.height);
		this.controls.update();
		this.renderer.render(this.scene, this.camera);
	}
}
