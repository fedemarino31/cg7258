import * as THREE from 'three';
import { ColorSpace } from './ColorSpace.js';
import { createTubesFromEdges, createAxis, TUBE_RADIUS, TUBE_RADIAL_SEGMENTS } from './GeometryUtils.js';
import cmyVertexShader from './shaders/cmy/cmyVertex.glsl';
import cmyFragmentShader from './shaders/cmy/cmyFragment.glsl';
import { outlineEdgeThickness, arrowRadius, arrowLength, axisThickness } from './constants.js';

// Cube is centered on XZ: X in [-0.5, 0.5], Y in [0, 1], Z in [-0.5, 0.5].
const CUBE_OFFSET_X = -0.5;
const CUBE_OFFSET_Z = -0.5;

export class CMYColorSpace extends ColorSpace {
	constructor(scene) {
		super(scene);
		this.modelType = 'CMY';
	}

	_buildAxesAndLabels() {
		const axisLength = 1.2;
		const ox = CUBE_OFFSET_X; // -0.5
		const oz = CUBE_OFFSET_Z; // -0.5

		const axesGroup = new THREE.Group();
		axesGroup.name = 'axesGroup';

		// C-axis along +X
		createAxis(
			axesGroup,
			new THREE.Vector3(ox, 0, oz),
			new THREE.Vector3(ox + axisLength, 0, oz),
			'C',
			new THREE.Vector3(0.1, 0, 0),
			0x00ffff,
			this.makeTextSprite.bind(this)
		);

		// M-axis along +Y
		createAxis(
			axesGroup,
			new THREE.Vector3(ox, 0, oz),
			new THREE.Vector3(ox, axisLength, oz),
			'M',
			new THREE.Vector3(0, 0.1, 0),
			0xff00ff,
			this.makeTextSprite.bind(this)
		);

		// Y-axis along +Z
		createAxis(
			axesGroup,
			new THREE.Vector3(ox, 0, oz),
			new THREE.Vector3(ox, 0, oz + axisLength),
			'Y',
			new THREE.Vector3(0, 0, 0.1),
			0xffff00,
			this.makeTextSprite.bind(this)
		);

		this.currentVisuals.add(axesGroup);
	}

	_buildFullSpaceOutlineObject() {
		const ox = CUBE_OFFSET_X; // -0.5
		const oz = CUBE_OFFSET_Z; // -0.5

		const v = [
			new THREE.Vector3(ox,       0, oz      ),
			new THREE.Vector3(ox + 1,   0, oz      ),
			new THREE.Vector3(ox + 1,   1, oz      ),
			new THREE.Vector3(ox,       1, oz      ),
			new THREE.Vector3(ox,       0, oz + 1  ),
			new THREE.Vector3(ox + 1,   0, oz + 1  ),
			new THREE.Vector3(ox + 1,   1, oz + 1  ),
			new THREE.Vector3(ox,       1, oz + 1  ),
		];

		const edges = [
			{ start: v[0], end: v[1] }, { start: v[1], end: v[2] },
			{ start: v[2], end: v[3] }, { start: v[3], end: v[0] },
			{ start: v[4], end: v[5] }, { start: v[5], end: v[6] },
			{ start: v[6], end: v[7] }, { start: v[7], end: v[4] },
			{ start: v[0], end: v[4] }, { start: v[1], end: v[5] },
			{ start: v[2], end: v[6] }, { start: v[3], end: v[7] },
		];

		const tubeGeometry = createTubesFromEdges(edges, TUBE_RADIUS, TUBE_RADIAL_SEGMENTS);
		if (!tubeGeometry) return new THREE.Group();

		const tubeMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
		return new THREE.Mesh(tubeGeometry, tubeMaterial);
	}

	_updateSubSpaceVolume(limits) {
		const cMin = limits?.c?.min ?? 0;
		const cMax = limits?.c?.max ?? 1;
		const mMin = limits?.m?.min ?? 0;
		const mMax = limits?.m?.max ?? 1;
		const yMin = limits?.y?.min ?? 0;
		const yMax = limits?.y?.max ?? 1;

		const width  = cMax - cMin;
		const height = mMax - mMin;
		const depth  = yMax - yMin;

		if (width <= 0 || height <= 0 || depth <= 0) return;

		const subBoxGeo = new THREE.BoxGeometry(width, height, depth);
		subBoxGeo.translate(
			cMin + width  / 2 + CUBE_OFFSET_X,
			mMin + height / 2,
			yMin + depth  / 2 + CUBE_OFFSET_Z
		);

		const cmyShaderMaterial = new THREE.ShaderMaterial({
			vertexShader: cmyVertexShader,
			fragmentShader: cmyFragmentShader,
			side: THREE.DoubleSide,
		});

		const mesh = new THREE.Mesh(subBoxGeo, cmyShaderMaterial);
		mesh.name = 'subspaceVolume';
		this.currentVisuals.add(mesh);
	}
}
