import * as THREE from 'three';
import { ColorSpace } from './ColorSpace.js';
import {
	createDirectionalArc,
	createAxis,
} from './GeometryUtils.js';
import { buildHSLVolume } from './HSLVolumeBuilder.js';
import { createHSLVolumeMaterial } from './HSLVolumeMaterial.js';
import {
	outlineEdgeThickness,
	arrowRadius,
	arrowLength,
	axisThickness,
} from './constants.js';

export class HSLColorSpace extends ColorSpace {
	constructor(scene) {
		super(scene);
		this.modelType = 'HSL';
		this.subSpaceLimits = {
			h: { min: 0, max: 1 },
			s: { min: 0, max: 1 },
			l: { min: 0, max: 1 },
		};
	}

	// ── Axes & labels (kept from original) ─────────────────────

	_buildAxesAndLabels() {
		this.clearCurrentVisuals();

		// Axes helper
		this.scene.add(new THREE.AxesHelper(1));

		const axisMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
		const axisExtensionFactor = 1.2;

		// L-axis (vertical)
		createAxis(
			this.currentVisuals,
			new THREE.Vector3(0, 0, 0),
			new THREE.Vector3(0, axisExtensionFactor, 0),
			'L',
			new THREE.Vector3(0, 0.1, 0),
			0xffffff,
			this.makeTextSprite.bind(this)
		);

		// H ring at L = 0.5
		const torusRadius = 0.5;
		const tubeRadius = outlineEdgeThickness;
		const torusGeometry = new THREE.TorusGeometry(
			torusRadius, tubeRadius, 16, 64, Math.PI * 2
		);
		const torusMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
		const torus = new THREE.Mesh(torusGeometry, torusMaterial);
		torus.position.set(0, 0.5, 0);
		torus.rotation.x = Math.PI / 2;
		//this.currentVisuals.add(torus);

		// S-axis (radial at L = 0.5)
		const s_axisLength = 0.5 * axisExtensionFactor;
		createAxis(
			this.currentVisuals,
			new THREE.Vector3(0, 0.5, 0),
			new THREE.Vector3(0, 0.5, s_axisLength),
			'S',
			new THREE.Vector3(0.1, 0, 0),
			0xffffff,
			this.makeTextSprite.bind(this)
		);

		// H arcs
		const h_arcRadius = s_axisLength + 0.1;
		const h_arcY = 0.5;
		const arrowMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });

		const firstArc = createDirectionalArc(
			null, 0, 45, h_arcRadius, h_arcY, arrowMaterial
		);
		this.currentVisuals.add(firstArc);

		const secondArc = firstArc.clone();
		secondArc.rotateY(Math.PI);
		this.currentVisuals.add(secondArc);

		// H label
		this.currentVisuals.add(
			this.makeTextSprite('H', { x: h_arcRadius + 0.15, y: h_arcY, z: 0 })
		);
	}

	_buildFullSpaceOutlineObject() {
		// No outline object needed for now
	}

	// ── Volume construction (NEW) ──────────────────────────────

	_updateSubSpaceVolume(limits) {
		// Convert normalized hue [0,1] → degrees [0,360]
		const hMinDeg = limits.h.min * 360;
		const hMaxDeg = limits.h.max * 360;
		const sMin = limits.s.min;
		const sMax = limits.s.max;
		const lMin = limits.l.min;
		const lMax = limits.l.max;

		// Create shared material
		const material = createHSLVolumeMaterial();

		// Build volume boundary faces
		const volumeGroup = buildHSLVolume(
			hMinDeg, hMaxDeg,
			sMin, sMax,
			lMin, lMax,
			material
		);

		this.currentVisuals.add(volumeGroup);
	}

}

