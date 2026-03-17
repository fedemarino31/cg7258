import * as THREE from 'three';
import {
	hslToCartesian,
	degToRad,
	hueSubRanges,
	isFullHueRange,
} from './HSLVolumeMath.js';
import { buildParametricSurface } from './ParametricSurfaceBuilder.js';

/**
 * HSLVolumeBuilder — constructs the closed boundary of the HSL sub-volume
 * defined by the ranges [hMin, hMax], [sMin, sMax], [lMin, lMax].
 *
 * All hue arguments are in DEGREES.
 *
 * Returns a THREE.Group containing one Mesh per visible boundary face.
 */

// Grid resolution
const H_STEPS = 64; // angular subdivisions
const S_STEPS = 16; // saturation subdivisions
const L_STEPS = 32; // lightness subdivisions

// ────────────────────────────────────────────
// Sampling helpers
// ────────────────────────────────────────────

/**
 * Create a sampling record consumable by ParametricSurfaceBuilder.
 */
function sample(hRad, s, l) {
	const pos = hslToCartesian(hRad, s, l);
	return {
		position: pos,
		hueDir: { x: Math.cos(hRad), y: Math.sin(hRad) },
		sl: { x: s, y: l },
	};
}

// ────────────────────────────────────────────
// Face builders
// ────────────────────────────────────────────

/**
 * Face where H = constant.
 * Domain: u → S ∈ [sMin, sMax],  v → L ∈ [lMin, lMax]
 */
function buildHConstFace(hDeg, sMin, sMax, lMin, lMax, material) {
	const hRad = degToRad(hDeg);
	const geometry = buildParametricSurface(
		(u, v) => {
			const s = sMin + u * (sMax - sMin);
			const l = lMin + v * (lMax - lMin);
			return sample(hRad, s, l);
		},
		S_STEPS,
		L_STEPS
	);
	return new THREE.Mesh(geometry, material);
}

/**
 * Face where S = constant.
 * Domain: u → H ∈ sub-range,  v → L ∈ [lMin, lMax]
 * One mesh per hue sub-range (handles wrap-around).
 */
function buildSConstFaces(sDeg, hMinDeg, hMaxDeg, lMin, lMax, material) {
	const meshes = [];
	const ranges = hueSubRanges(hMinDeg, hMaxDeg);

	for (const range of ranges) {
		const { startRad, endRad } = range;
		const hSpan = endRad - startRad;
		if (hSpan < 1e-6) continue; // degenerate

		// Number of angular steps proportional to span
		const steps = Math.max(4, Math.round((hSpan / (Math.PI * 2)) * H_STEPS));

		const geometry = buildParametricSurface(
			(u, v) => {
				const hRad = startRad + u * hSpan;
				const s = sDeg; // "sDeg" is actually the S value, not degrees
				const l = lMin + v * (lMax - lMin);
				return sample(hRad, s, l);
			},
			steps,
			L_STEPS
		);
		meshes.push(new THREE.Mesh(geometry, material));
	}

	return meshes;
}

/**
 * Face where L = constant.
 * Domain: u → H ∈ sub-range,  v → S ∈ [sMin, sMax]
 * One mesh per hue sub-range (handles wrap-around).
 */
function buildLConstFaces(lVal, hMinDeg, hMaxDeg, sMin, sMax, material) {
	const meshes = [];
	const ranges = hueSubRanges(hMinDeg, hMaxDeg);

	for (const range of ranges) {
		const { startRad, endRad } = range;
		const hSpan = endRad - startRad;
		if (hSpan < 1e-6) continue;

		const steps = Math.max(4, Math.round((hSpan / (Math.PI * 2)) * H_STEPS));

		const geometry = buildParametricSurface(
			(u, v) => {
				const hRad = startRad + u * hSpan;
				const s = sMin + v * (sMax - sMin);
				const l = lVal;
				return sample(hRad, s, l);
			},
			steps,
			S_STEPS
		);
		meshes.push(new THREE.Mesh(geometry, material));
	}

	return meshes;
}

// ────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────

/**
 * Build the full set of boundary faces for the given HSL sub-volume.
 *
 * @param {number} hMinDeg  Hue min in degrees [0, 360]
 * @param {number} hMaxDeg  Hue max in degrees [0, 360]
 * @param {number} sMin     Saturation min [0, 1]
 * @param {number} sMax     Saturation max [0, 1]
 * @param {number} lMin     Lightness min [0, 1]
 * @param {number} lMax     Lightness max [0, 1]
 * @param {THREE.ShaderMaterial} material
 * @returns {THREE.Group}
 */
export function buildHSLVolume(hMinDeg, hMaxDeg, sMin, sMax, lMin, lMax, material) {
	const group = new THREE.Group();
	group.name = 'subspaceVolume';

	const fullHue = isFullHueRange(hMinDeg, hMaxDeg);

	// ── H-constant faces (pie-slice walls) ──
	if (!fullHue) {
		const meshMin = buildHConstFace(hMinDeg, sMin, sMax, lMin, lMax, material);
		meshMin.name = 'face_h_min';
		group.add(meshMin);

		const meshMax = buildHConstFace(hMaxDeg, sMin, sMax, lMin, lMax, material);
		meshMax.name = 'face_h_max';
		group.add(meshMax);
	}

	// ── S-constant faces ──
	// Outer shell (always present)
	const outerMeshes = buildSConstFaces(sMax, hMinDeg, hMaxDeg, lMin, lMax, material);
	outerMeshes.forEach((m, i) => {
		m.name = `face_s_max_${i}`;
		group.add(m);
	});

	// Inner shell (only if sMin > 0)
	if (sMin > 1e-4) {
		const innerMeshes = buildSConstFaces(sMin, hMinDeg, hMaxDeg, lMin, lMax, material);
		innerMeshes.forEach((m, i) => {
			m.name = `face_s_min_${i}`;
			group.add(m);
		});
	}

	// ── L-constant faces (top / bottom caps) ──
	// Bottom cap
	const bottomMeshes = buildLConstFaces(lMin, hMinDeg, hMaxDeg, sMin, sMax, material);
	bottomMeshes.forEach((m, i) => {
		m.name = `face_l_min_${i}`;
		group.add(m);
	});

	// Top cap
	const topMeshes = buildLConstFaces(lMax, hMinDeg, hMaxDeg, sMin, sMax, material);
	topMeshes.forEach((m, i) => {
		m.name = `face_l_max_${i}`;
		group.add(m);
	});

	return group;
}
