import * as THREE from 'three';
import { ColorSpace } from './ColorSpace.js';
import { createTubesFromEdges, createAxis, TUBE_RADIUS, TUBE_RADIAL_SEGMENTS } from './GeometryUtils.js';
import cmyVertexShader from './shaders/cmy/cmyVertex.glsl';
import cmyFragmentShader from './shaders/cmy/cmyFragment.glsl';
import { outlineEdgeThickness, arrowRadius, arrowLength, axisThickness } from './constants.js';

export class CMYColorSpace extends ColorSpace {
	constructor(scene) {
		super(scene);
		this.modelType = 'CMY';
	}

	_buildAxesAndLabels() {
		console.log('CMYColorSpace: Building axes and labels');
		
		// Extension factor for axes (20% longer for better visibility)
		const axisLength = 1.2;

		// Create C-axis (X-axis) with cyan color
		createAxis(
			this.currentVisuals,
			new THREE.Vector3(0, 0, 0),
			new THREE.Vector3(axisLength, 0, 0),
			'C',
			new THREE.Vector3(0.1, 0, 0),
			0x00ffff, // Cyan color
			this.makeTextSprite.bind(this)
		);

		// Create M-axis (Y-axis) with magenta color
		createAxis(
			this.currentVisuals,
			new THREE.Vector3(0, 0, 0),
			new THREE.Vector3(0, axisLength, 0),
			'M',
			new THREE.Vector3(0, 0.1, 0),
			0xff00ff, // Magenta color
			this.makeTextSprite.bind(this)
		);

		// Create Y-axis (Z-axis) with yellow color
		createAxis(
			this.currentVisuals,
			new THREE.Vector3(0, 0, 0),
			new THREE.Vector3(0, 0, axisLength),
			'Y',
			new THREE.Vector3(0, 0, 0.1),
			0xffff00, // Yellow color
			this.makeTextSprite.bind(this)
		);
	}

	_buildFullSpaceOutlineObject() {
		console.log('CMYColorSpace: Building full space outline with tubes');

		const s = 1.0; // Size of the cube
		const offset = 0.0; // Assuming cube starts at origin (0,0,0) to (1,1,1)

		// Define the 8 vertices of the cube
		const v = [
			new THREE.Vector3(offset, offset, offset), // V0: 0,0,0
			new THREE.Vector3(offset + s, offset, offset), // V1: 1,0,0
			new THREE.Vector3(offset + s, offset + s, offset), // V2: 1,1,0
			new THREE.Vector3(offset, offset + s, offset), // V3: 0,1,0
			new THREE.Vector3(offset, offset, offset + s), // V4: 0,0,1
			new THREE.Vector3(offset + s, offset, offset + s), // V5: 1,0,1
			new THREE.Vector3(offset + s, offset + s, offset + s), // V6: 1,1,1
			new THREE.Vector3(offset, offset + s, offset + s), // V7: 0,1,1
		];

		// Define the 12 edges of the cube
		const edges = [
			// Bottom face
			{ start: v[0], end: v[1] },
			{ start: v[1], end: v[2] },
			{ start: v[2], end: v[3] },
			{ start: v[3], end: v[0] },
			// Top face
			{ start: v[4], end: v[5] },
			{ start: v[5], end: v[6] },
			{ start: v[6], end: v[7] },
			{ start: v[7], end: v[4] },
			// Vertical edges
			{ start: v[0], end: v[4] },
			{ start: v[1], end: v[5] },
			{ start: v[2], end: v[6] },
			{ start: v[3], end: v[7] },
		];

		const tubeGeometry = createTubesFromEdges(edges, TUBE_RADIUS, TUBE_RADIAL_SEGMENTS);

		if (!tubeGeometry) {
			console.warn('CMYColorSpace: Tube geometry for outline could not be created.');
			return new THREE.Group(); // Return an empty group or null
		}

		const tubeMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff }); // White outline
		const outlineObject = new THREE.Mesh(tubeGeometry, tubeMaterial);
		// Vertices are 0->1, so effective center is (0.5,0.5,0.5) for s=1, offset=0.
		return outlineObject;
	}

	_updateSubSpaceVolume(limits) {
		console.log('CMYColorSpace: Updating subspace volume with limits:', limits);

		const cMin = limits && limits.c && typeof limits.c.min === 'number' ? limits.c.min : 0;
		const cMax = limits && limits.c && typeof limits.c.max === 'number' ? limits.c.max : 1;
		const mMin = limits && limits.m && typeof limits.m.min === 'number' ? limits.m.min : 0;
		const mMax = limits && limits.m && typeof limits.m.max === 'number' ? limits.m.max : 1;
		const yMin = limits && limits.y && typeof limits.y.min === 'number' ? limits.y.min : 0;
		const yMax = limits && limits.y && typeof limits.y.max === 'number' ? limits.y.max : 1;

		if (!limits || !limits.c || !limits.m || !limits.y) {
			console.warn('CMY limits structure not fully defined. Using defaults for missing parts.');
		}

		const width = cMax - cMin;
		const height = mMax - mMin;
		const depth = yMax - yMin;

		if (width <= 0 || height <= 0 || depth <= 0) {
			console.log('CMY Subspace volume has zero or negative dimension, not rendering.');
			return;
		}

		const subBoxGeo = new THREE.BoxGeometry(width, height, depth);
		subBoxGeo.translate(cMin + width / 2, mMin + height / 2, yMin + depth / 2);

		const cmyShaderMaterial = new THREE.ShaderMaterial({
			vertexShader: cmyVertexShader,
			fragmentShader: cmyFragmentShader,
			side: THREE.DoubleSide,
		});

		const subBoxMeshCMY = new THREE.Mesh(subBoxGeo, cmyShaderMaterial);
		subBoxMeshCMY.name = 'subspaceVolume';
		this.currentVisuals.add(subBoxMeshCMY);
	}
}
