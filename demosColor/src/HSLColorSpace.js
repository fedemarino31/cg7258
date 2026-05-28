import * as THREE from 'three';
import { ColorSpace } from './ColorSpace.js';
import {
	createDirectionalArc,
	createAxis,
} from './GeometryUtils.js';
import { buildHSLVolume } from './HSLVolumeBuilder.js';
import { createHSLVolumeMaterial } from './HSLVolumeMaterial.js';
import { outlineEdgeThickness } from './constants.js';

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
		const axisExtensionFactor = 1.2;

		const axesGroup = new THREE.Group();
		axesGroup.name = 'axesGroup';

		// L-axis (vertical)
		createAxis(
			axesGroup,
			new THREE.Vector3(0, 0, 0),
			new THREE.Vector3(0, axisExtensionFactor, 0),
			'L',
			new THREE.Vector3(0, 0.1, 0),
			0xffffff,
			this.makeTextSprite.bind(this)
		);

		// S-axis (radial at L = 0.5)
		const s_axisLength = 0.5 * axisExtensionFactor;
		createAxis(
			axesGroup,
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

		const firstArc = createDirectionalArc(null, 0, 45, h_arcRadius, h_arcY, arrowMaterial);
		axesGroup.add(firstArc);

		const secondArc = firstArc.clone();
		secondArc.rotateY(Math.PI);
		axesGroup.add(secondArc);

		// H label
		axesGroup.add(this.makeTextSprite('H', { x: h_arcRadius + 0.15, y: h_arcY, z: 0 }));

		this.currentVisuals.add(axesGroup);
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

