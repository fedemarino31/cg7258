import * as THREE from 'three';
import { interpolateNormal, interpolatePosition } from './normals.js';
import { locatePoint, triangleNormalSet } from './surface.js';

const COLORS = {
	vertex: 0x36e6d4,
	face: 0xff70c6,
	interpolated: 0x8ad8ff,
	sampling: 0xff2d2d,
	selected: 0xfff275,
	edge: 0x12212a,
};

function disposeObject(root) {
	root.traverse((object) => {
		object.geometry?.dispose();
		if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
		else object.material?.dispose();
		object.material?.map?.dispose();
	});
}

function solidArrow(origin, direction, length, color, lineWidth = 1) {
	const arrow = new THREE.ArrowHelper(direction, origin, length, color, length * 0.24, length * 0.12);
	arrow.line.material.linewidth = lineWidth;
	return arrow;
}

function dashedArrow(origin, direction, length, color) {
	const group = new THREE.Group();
	const end = origin.clone().addScaledVector(direction, length * 0.8);
	const geometry = new THREE.BufferGeometry().setFromPoints([origin, end]);
	const material = new THREE.LineDashedMaterial({ color, dashSize: 0.09, gapSize: 0.055 });
	const line = new THREE.Line(geometry, material);
	line.computeLineDistances();
	group.add(line);
	const cone = new THREE.Mesh(
		new THREE.ConeGeometry(length * 0.1, length * 0.22, 10),
		new THREE.MeshBasicMaterial({ color })
	);
	cone.position.copy(origin).addScaledVector(direction, length * 0.91);
	cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
	group.add(cone);
	return group;
}

function makeLabel(text) {
	const canvas = document.createElement('canvas');
	canvas.width = 192;
	canvas.height = 96;
	const context = canvas.getContext('2d');
	context.fillStyle = 'rgba(7, 18, 25, 0.86)';
	context.beginPath();
	context.roundRect(20, 18, 152, 60, 18);
	context.fill();
	context.fillStyle = '#ffffff';
	context.font = '700 34px Arial';
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	context.fillText(text, 96, 49);
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
	sprite.scale.set(0.72, 0.36, 1);
	sprite.renderOrder = 20;
	return sprite;
}

function positionKey(position, normal) {
	return [...position.toArray(), ...normal.toArray()].map((value) => value.toFixed(3)).join('|');
}

export class SurfaceVisuals {
	constructor(scene, mode) {
		this.scene = scene;
		this.mode = mode;
		this.root = new THREE.Group();
		this.scene.add(this.root);
	}

	rebuild(surfaceData, mesh, state) {
		disposeObject(this.root);
		this.scene.remove(this.root);
		this.root = new THREE.Group();
		this.scene.add(this.root);
		this.surfaceData = surfaceData;
		this.mesh = mesh;

		this.edges = this.#buildEdges();
		this.labels = this.#buildLabels();
		this.vertexNormals = this.#buildVertexNormals();
		this.faceNormals = this.#buildFaceNormals();
		this.interpolatedNormals = this.#buildInterpolatedNormals();
		this.samplingLine = this.#buildSamplingLine(state.samplingPosition);
		this.samplingNormals = this.#buildSamplingNormals(state.samplingPosition, state.sampleCount);
		this.wireframe = new THREE.LineSegments(
			new THREE.WireframeGeometry(mesh.geometry),
			new THREE.LineBasicMaterial({ color: 0xe9f7ff, transparent: true, opacity: 0.5 })
		);
		this.root.add(
			this.edges,
			this.labels,
			this.vertexNormals,
			this.faceNormals,
			this.interpolatedNormals,
			this.samplingLine,
			this.samplingNormals,
			this.wireframe
		);

		this.marker = new THREE.Mesh(
			new THREE.SphereGeometry(0.07, 18, 12),
			new THREE.MeshBasicMaterial({ color: COLORS.selected, depthTest: false })
		);
		this.marker.renderOrder = 30;
		this.selectedNormal = new THREE.Group();
		this.root.add(this.marker, this.selectedNormal);
		this.applyVisibility(state);
	}

	#buildEdges() {
		const group = new THREE.Group();
		for (const triangle of this.surfaceData.triangles) {
			const points = [...triangle.vertices, triangle.vertices[0]].map((point) =>
				point.clone().addScaledVector(triangle.faceNormal, 0.008)
			);
			group.add(
				new THREE.Line(
					new THREE.BufferGeometry().setFromPoints(points),
					new THREE.LineBasicMaterial({ color: COLORS.edge })
				)
			);
		}
		return group;
	}

	#buildLabels() {
		const group = new THREE.Group();
		for (const triangle of this.surfaceData.triangles) {
			const center = triangle.vertices.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / 3);
			const label = makeLabel(triangle.name);
			label.position.copy(center).addScaledVector(triangle.faceNormal, 0.08);
			group.add(label);
		}
		return group;
	}

	#buildVertexNormals() {
		const group = new THREE.Group();
		const seen = new Set();
		for (const triangle of this.surfaceData.triangles) {
			const normals = triangleNormalSet(triangle, this.mode);
			triangle.vertices.forEach((position, index) => {
				const normal = normals[index];
				const key = positionKey(position, normal);
				if (seen.has(key)) return;
				seen.add(key);
				let origin = position.clone();
				if (this.mode === 'flat' && Math.abs(position.x) < 1e-5) {
					const sign = normal.x < -0.001 ? 1 : -1;
					origin.add(new THREE.Vector3(0, 0, sign * 0.045));
				}
				group.add(solidArrow(origin, normal, 0.64, COLORS.vertex, 2));
			});
		}
		return group;
	}

	#buildFaceNormals() {
		const group = new THREE.Group();
		for (const triangle of this.surfaceData.triangles) {
			const center = triangle.vertices.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / 3);
			group.add(dashedArrow(center, triangle.faceNormal, 0.52, COLORS.face));
		}
		return group;
	}

	#buildInterpolatedNormals() {
		const group = new THREE.Group();
		const weights = new THREE.Vector3(0.24, 0.37, 0.39);
		for (const triangle of this.surfaceData.triangles) {
			const position = interpolatePosition(weights, triangle);
			const normal = interpolateNormal(weights, triangleNormalSet(triangle, this.mode));
			group.add(solidArrow(position, normal, 0.36, COLORS.interpolated));
		}
		return group;
	}

	#samplingPoint(t, z) {
		if (t <= 0.5) return new THREE.Vector3(-2 + t * 4, 0, z);
		const localX = (t - 0.5) * 4;
		return new THREE.Vector3(localX * Math.cos(THREE.MathUtils.degToRad(this.angle)), localX * Math.sin(THREE.MathUtils.degToRad(this.angle)), z);
	}

	#buildSamplingLine(position) {
		this.angle = Math.round(THREE.MathUtils.radToDeg(Math.atan2(this.surfaceData.normalB.x * -1, this.surfaceData.normalB.y)));
		const z = THREE.MathUtils.lerp(-1.25, 1.25, position);
		const points = [this.#samplingPoint(0, z), this.#samplingPoint(0.5, z), this.#samplingPoint(1, z)];
		return new THREE.Line(
			new THREE.BufferGeometry().setFromPoints(points),
			new THREE.LineBasicMaterial({ color: COLORS.sampling })
		);
	}

	#buildSamplingNormals(position, count) {
		const group = new THREE.Group();
		const z = THREE.MathUtils.lerp(-1.25, 1.25, position);
		for (let index = 0; index < count; index += 1) {
			const point = this.#samplingPoint((index + 0.5) / count, z);
			const located = locatePoint(this.surfaceData, point);
			if (!located) continue;
			const triangle = this.surfaceData.triangles[located.triangleIndex];
			const normal = interpolateNormal(located.weights, triangleNormalSet(triangle, this.mode));
			group.add(solidArrow(point, normal, 0.3, COLORS.sampling));
		}
		return group;
	}

	updateInspection(selection, state) {
		while (this.selectedNormal.children.length) {
			const child = this.selectedNormal.children.pop();
			disposeObject(child);
		}
		if (!selection) {
			this.marker.visible = false;
			this.selectedNormal.visible = false;
			return;
		}
		const triangle = this.surfaceData.triangles[selection.triangleIndex];
		const position = interpolatePosition(selection.weights, triangle);
		const normal = interpolateNormal(selection.weights, triangleNormalSet(triangle, this.mode));
		this.marker.position.copy(position).addScaledVector(normal, 0.015);
		this.selectedNormal.add(solidArrow(position, normal, 1.02, COLORS.selected, 3));
		this.marker.visible = state.showSelectedPoint;
		this.selectedNormal.visible = state.showSelectedNormal;
	}

	applyVisibility(state) {
		this.edges.visible = state.showEdges;
		this.labels.visible = state.showLabels;
		this.vertexNormals.visible = state.showVertexNormals;
		this.faceNormals.visible = state.showFaceNormals;
		this.interpolatedNormals.visible = state.showInterpolatedNormals;
		this.samplingLine.visible = state.showSamplingLine;
		this.samplingNormals.visible = state.showSamplingNormals;
		this.wireframe.visible = state.wireframe;
		if (this.marker) this.marker.visible = state.showSelectedPoint && this.marker.visible;
		if (this.selectedNormal) this.selectedNormal.visible = state.showSelectedNormal && this.selectedNormal.visible;
	}
}
