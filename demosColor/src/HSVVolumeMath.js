/**
 * HSVVolumeMath — Pure math utilities for the HSV conic model.
 *
 * Conventions:
 *   - H (hue)        is in RADIANS internally  (0 … 2π)
 *   - S (saturation) ∈ [0, 1]
 *   - V (value)      ∈ [0, 1]
 *   - The solid is a CONE with apex at V = 0 (black) and base at V = 1.
 *   - The visual model is scaled so the max radius at V = 1, S = 1 equals
 *     MAX_VISUAL_RADIUS (0.5), keeping the solid inside a ~1-unit space.
 *   - Y axis = Value, XZ plane = Hue / Saturation
 */

const TWO_PI = Math.PI * 2;
const MAX_VISUAL_RADIUS = 0.5; // radius at V=1, S=1

// ────────────────────────────────────────────
// Core formulas
// ────────────────────────────────────────────

/**
 * Maximum radius of the HSV cone at a given value (S = 1).
 * rMax(V) = V  — the cone narrows linearly to a point at V = 0.
 */
export function rMaxNorm(v) {
	return v;
}

/**
 * Radius in 3-D space for given V and S, with visual scaling applied.
 */
export function radius(v, s) {
	return s * rMaxNorm(v) * MAX_VISUAL_RADIUS;
}

/**
 * Convert HSV to Cartesian (x, y, z).
 * @param {number} hRad  Hue in radians
 * @param {number} s     Saturation [0, 1]
 * @param {number} v     Value      [0, 1]
 * @returns {{x: number, y: number, z: number}}
 */
export function hsvToCartesian(hRad, s, v) {
	const r = radius(v, s);
	return {
		x: r * Math.cos(hRad),
		y: v,
		z: r * Math.sin(hRad),
	};
}

// ────────────────────────────────────────────
// Angle helpers (identical to HSLVolumeMath)
// ────────────────────────────────────────────

export function degToRad(deg) {
	return (deg * Math.PI) / 180;
}

export function radToDeg(rad) {
	return (rad * 180) / Math.PI;
}

/**
 * Normalize an angle in radians to [0, 2π).
 */
export function normalizeRad(rad) {
	let r = rad % TWO_PI;
	if (r < 0) r += TWO_PI;
	return r;
}

/**
 * Given hMin and hMax in DEGREES, return an array of angular sub-ranges
 * (in radians) that avoid crossing the 0°/360° discontinuity.
 *
 * If hMin ≤ hMax  →  one range  [hMin, hMax]
 * If hMin > hMax  →  two ranges [hMin, 360) + [0, hMax]   (wrap-around)
 * If the range covers a full 360° → one range [0, 2π]
 *
 * Each sub-range: { startRad, endRad }
 */
export function hueSubRanges(hMinDeg, hMaxDeg) {
	if (hMaxDeg - hMinDeg >= 360 || (hMinDeg === 0 && hMaxDeg === 360)) {
		return [{ startRad: 0, endRad: TWO_PI }];
	}

	if (hMinDeg <= hMaxDeg) {
		return [{ startRad: degToRad(hMinDeg), endRad: degToRad(hMaxDeg) }];
	}

	// Wrap-around: e.g. 300° → 40°
	return [
		{ startRad: degToRad(hMinDeg), endRad: TWO_PI },
		{ startRad: 0, endRad: degToRad(hMaxDeg) },
	];
}

/**
 * Is the hue range a full 360°?
 */
export function isFullHueRange(hMinDeg, hMaxDeg) {
	return hMaxDeg - hMinDeg >= 360 || (hMinDeg === 0 && hMaxDeg === 360);
}

export { TWO_PI, MAX_VISUAL_RADIUS };
