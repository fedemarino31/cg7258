import * as THREE from 'three';
import { ColorSpace } from './ColorSpace.js';
import { createDirectionalArc, createAxis } from './GeometryUtils.js';
import { buildHSLVolume } from './HSLVolumeBuilder.js';
import { createHSLVolumeMaterial } from './HSLVolumeMaterial.js';
import { Y_SCALE } from './HSLVolumeMath.js';
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
		const axisExtensionFactor = 1.05;

		const axesGroup = new THREE.Group();
		axesGroup.name = 'axesGroup';

		// L-axis (vertical) — extend with the vertical stretch so the tip stays
		// visible above the elongated top vertex (which now sits at y = Y_SCALE).
		createAxis(
			axesGroup,
			new THREE.Vector3(0, 0, 0),
			new THREE.Vector3(0, axisExtensionFactor * Y_SCALE, 0),
			'L',
			new THREE.Vector3(0, 0.1, 0),
			0xffffff,
			this.makeTextSprite.bind(this)
		);

		// S-axis (radial at L = 0.5, the widest cross-section)
		const s_axisLength = 0.6 * axisExtensionFactor;
		const midY = 0.5 * Y_SCALE;
		createAxis(
			axesGroup,
			new THREE.Vector3(0, midY, 0),
			new THREE.Vector3(0, midY, s_axisLength),
			'S',
			new THREE.Vector3(0.1, 0, 0),
			0xffffff,
			this.makeTextSprite.bind(this)
		);

		// H arcs
		const h_arcRadius = s_axisLength + 0.1;
		const h_arcY = midY;
		const arrowMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });

		const firstArc = createDirectionalArc(null, 0, 45, h_arcRadius, h_arcY, arrowMaterial);
		axesGroup.add(firstArc);

		const secondArc = firstArc.clone();
		secondArc.rotateY(Math.PI);
		axesGroup.add(secondArc);

		// H labels (one at each arrow tip)
		axesGroup.add(this.makeTextSprite('H', { x: h_arcRadius + 0.15, y: midY, z: 0 }));
		axesGroup.add(this.makeTextSprite('H', { x: -(h_arcRadius + 0.15), y: midY, z: 0 }));

		this.currentVisuals.add(axesGroup);
	}

	_buildFullSpaceOutlineObject() {
		// No outline object needed for now
	}

	// The solid is stretched 2× in Y, so report real extents (y ∈ [0, Y_SCALE])
	// instead of the default unit cube — keeps camera framing and the L axis tip
	// inside the view.
	getCurrentSpaceBoundingBox() {
		const r = 0.5; // max radius at L = 0.5
		return new THREE.Box3(new THREE.Vector3(-r, 0, -r), new THREE.Vector3(r, Y_SCALE, r));
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
		const volumeGroup = buildHSLVolume(hMinDeg, hMaxDeg, sMin, sMax, lMin, lMax, material);

		this.currentVisuals.add(volumeGroup);
	}
}
