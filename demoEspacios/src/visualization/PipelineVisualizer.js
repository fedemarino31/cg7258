import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DEFAULT_MODEL_VIEW_PRESET, MODEL_VIEW_PRESETS } from '../config/modelViewPresets.js';

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
	const edgePositions = [];
	const generatedPositions = [];
	for (const triangle of triangles) {
		const points = triangle.vertices.map((vertex) => mapper(vertex));
		for (let index = 0; index < 3; index += 1) {
			const point = points[index];
			surfacePositions.push(point.x, point.y, point.z);
			if (shadingMode === 'distance') {
				const intensity = distanceIntensity(depthMapper(triangle.vertices[index], triangle), depthRange.near, depthRange.far);
				surfaceColors.push(intensity, intensity, intensity);
			} else {
				const color = triangle.color;
				surfaceColors.push(color.r, color.g, color.b);
			}
			const next = points[(index + 1) % 3];
			edgePositions.push(point.x, point.y, point.z, next.x, next.y, next.z);
			if (triangle.vertices[index].generatedByClipping) generatedPositions.push(point.x, point.y, point.z);
		}
	}
	if (!surfacePositions.length) return;

	const surfaceGeometry = new THREE.BufferGeometry();
	surfaceGeometry.setAttribute('position', new THREE.Float32BufferAttribute(surfacePositions, 3));
	surfaceGeometry.setAttribute('color', new THREE.Float32BufferAttribute(surfaceColors, 3));
	surfaceGeometry.computeVertexNormals();
	const surfaceMaterial = shadingMode === 'solid'
		? new THREE.MeshPhongMaterial({
			vertexColors: true,
			flatShading: true,
			shininess: 35,
			specular: 0x526175,
			side: THREE.DoubleSide,
		})
		: new THREE.MeshBasicMaterial({
			vertexColors: true,
			transparent: shadingMode !== 'distance',
			opacity: shadingMode === 'translucent' ? 0.28 : shadingMode === 'distance' ? 1 : 0.42,
			side: THREE.DoubleSide,
			// Even the didactic translucent modes write depth so overlapping
			// triangles are resolved by the z-buffer instead of draw order.
			depthWrite: true,
		});
	const surface = new THREE.Mesh(
		surfaceGeometry,
		surfaceMaterial
	);
	const edgeGeometry = new THREE.BufferGeometry();
	edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
	const edges = new THREE.LineSegments(
		edgeGeometry,
		new THREE.LineBasicMaterial({ color: 0xdbeafe, transparent: true, opacity: 0.66 })
	);
	group.add(surface);
	if (shadingMode === 'wireframe') group.add(edges);

	if (generatedPositions.length) {
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(generatedPositions, 3));
		group.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xff4fd8, size: 0.055 })));
	}
}

function addCanonicalCube(group, showAxes = true) {
	const box = new THREE.LineSegments(
		new THREE.EdgesGeometry(new THREE.BoxGeometry(2, 2, 2)),
		new THREE.LineBasicMaterial({ color: 0x58e6c2, transparent: true, opacity: 0.85 })
	);
	group.add(box);
	if (showAxes) group.add(new THREE.AxesHelper(1.45));
}

function addViewFrustum(group, camera) {
	const inverseProjection = camera.projectionMatrixInverse;
	const corners = [];
	for (const z of [-1, 1]) {
		for (const y of [-1, 1]) {
			for (const x of [-1, 1]) corners.push(new THREE.Vector3(x, y, z).applyMatrix4(inverseProjection));
		}
	}
	const pairs = [[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]];
	const positions = [];
	for (const [a, b] of pairs) positions.push(...corners[a].toArray(), ...corners[b].toArray());
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	group.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0x58e6c2, transparent: true, opacity: 0.58 })));
}

export class PipelineVisualizer {
	constructor(container, screenCanvas) {
		this.container = container;
		this.screenCanvas = screenCanvas;
		this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		container.appendChild(this.renderer.domElement);
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(0x0b0e14);
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
		this.shadingMode = 'wireframe';
		this.showGrid = true;
		this.showAxes = true;
		this.group = new THREE.Group();
		this.scene.add(this.group);
	}

	setClipMode(mode) {
		this.clipMode = mode;
	}

	setShadingMode(mode) {
		this.shadingMode = mode;
	}

	setHelperVisibility(helper, visible) {
		if (helper === 'grid') this.showGrid = visible;
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
		this.stage = stage;
		this.depthRange = { near: teachingCamera.near, far: teachingCamera.far };
		this.group.clear();
		const canvasMode = stage === 'clip' && this.clipMode === 'plots';
		this.renderer.domElement.hidden = canvasMode;
		this.screenCanvas.hidden = !canvasMode;
		const orbitHint = this.container.parentElement.querySelector('.orbit-hint');
		if (orbitHint) orbitHint.hidden = canvasMode || stage === 'screen';
		if (stage === 'screen') {
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
			if (this.showGrid) this.group.add(new THREE.GridHelper(12, 12, 0x4f6c67, 0x293b39));
			if (this.showAxes) this.group.add(new THREE.AxesHelper(2.2));
			this.focus(12, new THREE.Vector3(0, 1, 0));
		} else if (stage === 'view') {
			addTriangleGeometry(this.group, result.view.map((triangle) => ({ ...triangle, vertices: triangle.vertices.map((position) => ({ position })) })), undefined, this.shadingMode, (vertex) => -vertex.position.z, this.depthRange);
			if (this.showAxes) this.group.add(new THREE.AxesHelper(1.5));
			addViewFrustum(this.group, teachingCamera);
			this.focus(16, new THREE.Vector3(0, 0, -4));
		} else if (stage === 'clip') {
			// Clip space is 4D. Its visible result is embedded in 3D using x/w,
			// y/w and z/w, while the inspector keeps the original homogeneous w.
			addTriangleGeometry(this.group, result.ndc, undefined, this.shadingMode, (vertex) => vertex.cameraDepth, this.depthRange);
			addCanonicalCube(this.group, this.showAxes);
			this.focus(4.2, new THREE.Vector3());
		} else if (stage === 'ndc') {
			addTriangleGeometry(this.group, result.ndc, undefined, this.shadingMode, (vertex) => vertex.cameraDepth, this.depthRange);
			addCanonicalCube(this.group, this.showAxes);
			this.focus(4.2, new THREE.Vector3());
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
			new THREE.MeshBasicMaterial({ color: 0xff4d62, depthTest: false })
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

	prepareCanvas() {
		const canvas = this.screenCanvas;
		const rect = this.container.getBoundingClientRect();
		const dpr = Math.min(window.devicePixelRatio, 2);
		canvas.width = Math.max(1, Math.round(rect.width * dpr));
		canvas.height = Math.max(1, Math.round(rect.height * dpr));
		canvas.style.width = `${rect.width}px`;
		canvas.style.height = `${rect.height}px`;
		const context = canvas.getContext('2d');
		context.setTransform(dpr, 0, 0, dpr, 0, 0);
		context.fillStyle = '#0b0e14';
		context.fillRect(0, 0, rect.width, rect.height);
		return { context, rect };
	}

	drawClipPlots(result) {
		const { context, rect } = this.prepareCanvas();
		const components = [
			{ key: 'x', label: 'X — W', equation: '−w ≤ x ≤ w' },
			{ key: 'y', label: 'Y — W', equation: '−w ≤ y ≤ w' },
			{ key: 'z', label: 'Z — W', equation: '−w ≤ z ≤ w' },
		];
		const top = Math.min(152, rect.height * 0.28);
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
			context.font = "500 10px 'DM Mono', monospace";
			context.fillStyle = '#e5edf7';
			context.fillText(component.label, panel.x + 12, panel.y + 16);
			context.fillStyle = '#657287';
			context.font = "9px 'DM Mono', monospace";
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
				context.beginPath();
				triangle.vertices.forEach((vertex, index) => {
					const x = mapX(vertex.position[component.key]);
					const y = mapW(vertex.position.w);
					if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
				});
				context.closePath();
				const averageDepth = triangle.vertices.reduce((sum, vertex) => sum + vertex.position.w, 0) / 3;
				const color = `#${triangle.color.getHexString()}`;
				context.fillStyle = this.shadingMode === 'distance'
					? distanceCss(averageDepth, this.depthRange.near, this.depthRange.far)
					: `${color}${this.shadingMode === 'solid' ? 'b8' : this.shadingMode === 'translucent' ? '38' : '48'}`;
				context.fill();
				if (this.shadingMode === 'wireframe') {
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
			context.fillStyle = '#ff4d62';
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
			context.fillText('w', mapX(0) + 5, plot.y + 10);
			context.fillText(component.key, plot.x + plot.width - 8, mapW(0) - 5);
			if (component.key === 'z') {
				context.fillStyle = '#58e6c2';
				context.fillText('far  z = +w', plot.x + 8, plot.y + 12);
				context.fillText('near  z = −w', plot.x + plot.width - 88, plot.y + 12);
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

	addMarker(vector) {
		if (!vector) return;
		const point = this.stage === 'clip' ? clipToDisplay({ position: vector }) : new THREE.Vector3(vector.x, vector.y, vector.z);
		const marker = new THREE.Mesh(
			new THREE.SphereGeometry(this.stage === 'world' || this.stage === 'view' ? 0.12 : 0.045, 12, 8),
			new THREE.MeshBasicMaterial({ color: 0xff4d62, depthTest: false })
		);
		marker.position.copy(point);
		marker.renderOrder = 10;
		this.group.add(marker);
	}

	render() {
		if (this.stage === 'clip' && this.clipMode === 'plots') return;
		if (this.stage === 'screen') {
			this.renderer.render(this.scene, this.screenCamera);
			return;
		}
		this.controls.update();
		this.renderer.render(this.scene, this.camera);
	}
}
