import * as THREE from 'three';
import { ColorSpace } from './ColorSpace.js';
import { createTubesFromEdges, createAxis, TUBE_RADIUS, TUBE_RADIAL_SEGMENTS } from './GeometryUtils.js';
import rgbVertexShader from './shaders/rgb/rgbVertex.glsl';
import rgbFragmentShader from './shaders/rgb/rgbFragment.glsl';
import { outlineEdgeThickness, arrowRadius, arrowLength, axisThickness } from './constants.js';

// Cube is centered on XZ: X in [-0.5, 0.5], Y in [0, 1], Z in [-0.5, 0.5].
const CUBE_OFFSET_X = -0.5;
const CUBE_OFFSET_Z = -0.5;

export class RGBColorSpace extends ColorSpace {
	constructor(scene) {
		super(scene);
		this.modelType = 'RGB';
	}

	_buildAxesAndLabels() {
		const axisLength = 1.2;
		const ox = CUBE_OFFSET_X; // -0.5
		const oz = CUBE_OFFSET_Z; // -0.5

		const axesGroup = new THREE.Group();
		axesGroup.name = 'axesGroup';

		// R-axis along +X from the black corner
		createAxis(
			axesGroup,
			new THREE.Vector3(ox, 0, oz),
			new THREE.Vector3(ox + axisLength, 0, oz),
			'R',
			new THREE.Vector3(0.1, 0, 0),
			0xff0000,
			this.makeTextSprite.bind(this)
		);

		// G-axis along +Y
		createAxis(
			axesGroup,
			new THREE.Vector3(ox, 0, oz),
			new THREE.Vector3(ox, axisLength, oz),
			'G',
			new THREE.Vector3(0, 0.1, 0),
			0x00ff00,
			this.makeTextSprite.bind(this)
		);

		// B-axis along +Z
		createAxis(
			axesGroup,
			new THREE.Vector3(ox, 0, oz),
			new THREE.Vector3(ox, 0, oz + axisLength),
			'B',
			new THREE.Vector3(0, 0, 0.1),
			0x0000ff,
			this.makeTextSprite.bind(this)
		);

		this.currentVisuals.add(axesGroup);
	}

	_buildFullSpaceOutlineObject() {
		const ox = CUBE_OFFSET_X; // -0.5
		const oz = CUBE_OFFSET_Z; // -0.5

		const v = [
			new THREE.Vector3(ox,       0, oz      ), // V0: -0.5, 0, -0.5
			new THREE.Vector3(ox + 1,   0, oz      ), // V1:  0.5, 0, -0.5
			new THREE.Vector3(ox + 1,   1, oz      ), // V2:  0.5, 1, -0.5
			new THREE.Vector3(ox,       1, oz      ), // V3: -0.5, 1, -0.5
			new THREE.Vector3(ox,       0, oz + 1  ), // V4: -0.5, 0,  0.5
			new THREE.Vector3(ox + 1,   0, oz + 1  ), // V5:  0.5, 0,  0.5
			new THREE.Vector3(ox + 1,   1, oz + 1  ), // V6:  0.5, 1,  0.5
			new THREE.Vector3(ox,       1, oz + 1  ), // V7: -0.5, 1,  0.5
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
		const rMin = limits?.r?.min ?? 0;
		const rMax = limits?.r?.max ?? 1;
		const gMin = limits?.g?.min ?? 0;
		const gMax = limits?.g?.max ?? 1;
		const bMin = limits?.b?.min ?? 0;
		const bMax = limits?.b?.max ?? 1;

		const width  = rMax - rMin;
		const height = gMax - gMin;
		const depth  = bMax - bMin;

		if (width <= 0 || height <= 0 || depth <= 0) return;

		const subBoxGeo = new THREE.BoxGeometry(width, height, depth);
		// Center the box in XZ space: shift X and Z by CUBE_OFFSET
		subBoxGeo.translate(
			rMin + width  / 2 + CUBE_OFFSET_X,
			gMin + height / 2,
			bMin + depth  / 2 + CUBE_OFFSET_Z
		);

		const rgbShaderMaterial = new THREE.ShaderMaterial({
			vertexShader: rgbVertexShader,
			fragmentShader: rgbFragmentShader,
			side: THREE.DoubleSide,
		});

		const mesh = new THREE.Mesh(subBoxGeo, rgbShaderMaterial);
		mesh.name = 'subspaceVolume';
		this.currentVisuals.add(mesh);
	}
}
