import * as THREE from 'three';
import { ColorSpace } from './ColorSpace.js';
import { createDirectionalArc, createAxis } from './GeometryUtils.js';
import { buildHSVVolume } from './HSVVolumeBuilder.js';
import { createHSVVolumeMaterial } from './HSVVolumeMaterial.js';
import { outlineEdgeThickness } from './constants.js';
import { MAX_VISUAL_RADIUS } from './HSVVolumeMath.js';

export class HSVColorSpace extends ColorSpace {
	constructor(scene) {
		super(scene);
		this.modelType = 'HSV';
	}

	// ── Axes & labels ──────────────────────────────────────────

	_buildAxesAndLabels() {
		this.clearCurrentVisuals();

		const axisExtensionFactor = 1.2;

		// V-axis (vertical): apex at origin, tip at top
		createAxis(
			this.currentVisuals,
			new THREE.Vector3(0, 0, 0),
			new THREE.Vector3(0, axisExtensionFactor, 0),
			'V',
			new THREE.Vector3(0, 0.1, 0),
			0xffffff,
			this.makeTextSprite.bind(this)
		);

		// H ring at V = 1 (base of the full cone, radius = MAX_VISUAL_RADIUS)
		const torusGeometry = new THREE.TorusGeometry(
			MAX_VISUAL_RADIUS,
			outlineEdgeThickness,
			16,
			64,
			Math.PI * 2
		);
		const torusMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
		const torus = new THREE.Mesh(torusGeometry, torusMaterial);
		torus.position.set(0, 1, 0);
		torus.rotation.x = Math.PI / 2;
		//this.currentVisuals.add(torus);

		// S-axis (radial at V = 1)
		const s_axisLength = MAX_VISUAL_RADIUS * axisExtensionFactor;
		createAxis(
			this.currentVisuals,
			new THREE.Vector3(0, 1, 0),
			new THREE.Vector3(0, 1, s_axisLength),
			'S',
			new THREE.Vector3(0.1, 0, 0),
			0xffffff,
			this.makeTextSprite.bind(this)
		);

		// H arcs at V = 1, just outside the ring
		const h_arcRadius = s_axisLength + 0.1;
		const arrowMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });

		const firstArc = createDirectionalArc(null, 0, 45, h_arcRadius, 1, arrowMaterial);
		this.currentVisuals.add(firstArc);

		const secondArc = firstArc.clone();
		secondArc.rotateY(Math.PI);
		this.currentVisuals.add(secondArc);

		// H label
		this.currentVisuals.add(
			this.makeTextSprite('H', { x: h_arcRadius + 0.15, y: 1, z: 0 })
		);
	}

	_buildFullSpaceOutlineObject() {
		// Visual reference: ring at V=1 showing the base of the full cone (S=1, V=1).
		// No separate geometry returned — axes already provide the reference.
		// Return null so base class doesn't attempt to add a missing object.
		return null;
	}

	// ── Volume construction ────────────────────────────────────

	_updateSubSpaceVolume(limits) {
		// Hue arrives normalized [0,1] from UIManager → convert to degrees
		const hMinDeg = limits.h.min * 360;
		const hMaxDeg = limits.h.max * 360;
		const sMin = limits.s.min;
		const sMax = limits.s.max;
		const vMin = limits.v.min;
		const vMax = limits.v.max;

		const material = createHSVVolumeMaterial();

		const volumeGroup = buildHSVVolume(
			hMinDeg, hMaxDeg,
			sMin, sMax,
			vMin, vMax,
			material
		);

		this.currentVisuals.add(volumeGroup);
	}
}
