import * as THREE from 'three';
import {
	hsvToCartesian,
	degToRad,
	hueSubRanges,
	isFullHueRange,
} from './HSVVolumeMath.js';

/**
 * HSVVolumeBuilder — constructs the closed boundary of the HSV sub-volume
 * defined by the ranges [hMin, hMax], [sMin, sMax], [vMin, vMax].
 *
 * The HSV solid is a CONE: apex at V=0 (black), base disk at V=1.
 * rMax(V) = V  →  r(V,S) = S · V · MAX_VISUAL_RADIUS
 *
 * All hue arguments are in DEGREES.
 *
 * Returns a THREE.Group containing one Mesh per visible boundary face.
 */

// Grid resolution
const H_STEPS = 64; // angular subdivisions
const S_STEPS = 16; // saturation subdivisions
const V_STEPS = 32; // value subdivisions

// ────────────────────────────────────────────
// Parametric surface builder (HSV attributes)
// ────────────────────────────────────────────

/**
 * Build a parametric surface with HSV-specific vertex attributes.
 *
 * The sampling function must return, for every (u, v):
 *   {
 *     position : { x, y, z },
 *     hueDir   : { x, y },   // cos(h), sin(h)  — robust hue interpolation
 *     vs       : { x, y },   // v (value), s (saturation)
 *   }
 *
 * Generated attributes:
 *   - "position"    vec3
 *   - "hsvHueDir"   vec2   — (cos h, sin h)
 *   - "hsvVS"       vec2   — (value, saturation)
 */
function buildParametricSurfaceHSV(fn, uSteps, vSteps) {
	const vertexCount = (uSteps + 1) * (vSteps + 1);

	const positions = new Float32Array(vertexCount * 3);
	const hueDirs = new Float32Array(vertexCount * 2);
	const vs = new Float32Array(vertexCount * 2);

	let idx = 0;
	for (let iv = 0; iv <= vSteps; iv++) {
		const v = iv / vSteps;
		for (let iu = 0; iu <= uSteps; iu++) {
			const u = iu / uSteps;

			const s = fn(u, v);

			const i3 = idx * 3;
			positions[i3] = s.position.x;
			positions[i3 + 1] = s.position.y;
			positions[i3 + 2] = s.position.z;

			const i2 = idx * 2;
			hueDirs[i2] = s.hueDir.x;
			hueDirs[i2 + 1] = s.hueDir.y;

			vs[i2] = s.vs.x; // value
			vs[i2 + 1] = s.vs.y; // saturation

			idx++;
		}
	}

	// Index buffer (two triangles per quad)
	const indexCount = uSteps * vSteps * 6;
	const indices = indexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);

	let ii = 0;
	for (let iv = 0; iv < vSteps; iv++) {
		for (let iu = 0; iu < uSteps; iu++) {
			const a = iv * (uSteps + 1) + iu;
			const b = a + 1;
			const c = a + (uSteps + 1);
			const d = c + 1;

			indices[ii++] = a;
			indices[ii++] = c;
			indices[ii++] = b;

			indices[ii++] = b;
			indices[ii++] = c;
			indices[ii++] = d;
		}
	}

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
	geometry.setAttribute('hsvHueDir', new THREE.BufferAttribute(hueDirs, 2));
	geometry.setAttribute('hsvVS', new THREE.BufferAttribute(vs, 2));
	geometry.setIndex(new THREE.BufferAttribute(indices, 1));

	geometry.computeVertexNormals();

	return geometry;
}

// ────────────────────────────────────────────
// Sampling helper
// ────────────────────────────────────────────

function sample(hRad, s, v) {
	return {
		position: hsvToCartesian(hRad, s, v),
		hueDir: { x: Math.cos(hRad), y: Math.sin(hRad) },
		vs: { x: v, y: s },
	};
}

// ────────────────────────────────────────────
// Face builders
// ────────────────────────────────────────────

/**
 * Face where H = constant.
 * Domain: u → S ∈ [sMin, sMax],  v → V ∈ [vMin, vMax]
 *
 * This is a flat radial "pie-slice" wall in the plane containing the V axis
 * and the direction hDeg. At V=0 all S values collapse to the apex, producing
 * a triangle fan naturally (no special handling needed).
 */
function buildHConstFace(hDeg, sMin, sMax, vMin, vMax, material) {
	const hRad = degToRad(hDeg);
	const geometry = buildParametricSurfaceHSV(
		(u, v) => {
			const s = sMin + u * (sMax - sMin);
			const val = vMin + v * (vMax - vMin);
			return sample(hRad, s, val);
		},
		S_STEPS,
		V_STEPS
	);
	return new THREE.Mesh(geometry, material);
}

/**
 * Face where S = constant.
 * Domain: u → H ∈ sub-range,  v → V ∈ [vMin, vMax]
 *
 * This is a conical shell (a scaled cone surface).
 * One mesh per hue sub-range (handles wrap-around).
 */
function buildSConstFaces(sVal, hMinDeg, hMaxDeg, vMin, vMax, material) {
	const meshes = [];
	const ranges = hueSubRanges(hMinDeg, hMaxDeg);

	for (const { startRad, endRad } of ranges) {
		const hSpan = endRad - startRad;
		if (hSpan < 1e-6) continue;

		const steps = Math.max(4, Math.round((hSpan / (Math.PI * 2)) * H_STEPS));

		const geometry = buildParametricSurfaceHSV(
			(u, v) => {
				const hRad = startRad + u * hSpan;
				const val = vMin + v * (vMax - vMin);
				return sample(hRad, sVal, val);
			},
			steps,
			V_STEPS
		);
		meshes.push(new THREE.Mesh(geometry, material));
	}

	return meshes;
}

/**
 * Face where V = constant.
 * Domain: u → H ∈ sub-range,  v → S ∈ [sMin, sMax]
 *
 * This is a horizontal disk or annular sector at height vVal.
 * At V=0 this face degenerates to a single point and must not be built.
 * One mesh per hue sub-range (handles wrap-around).
 */
function buildVConstFaces(vVal, hMinDeg, hMaxDeg, sMin, sMax, material) {
	const meshes = [];
	const ranges = hueSubRanges(hMinDeg, hMaxDeg);

	for (const { startRad, endRad } of ranges) {
		const hSpan = endRad - startRad;
		if (hSpan < 1e-6) continue;

		const steps = Math.max(4, Math.round((hSpan / (Math.PI * 2)) * H_STEPS));

		const geometry = buildParametricSurfaceHSV(
			(u, v) => {
				const hRad = startRad + u * hSpan;
				const s = sMin + v * (sMax - sMin);
				return sample(hRad, s, vVal);
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
 * Build the full set of boundary faces for the given HSV sub-volume.
 *
 * @param {number} hMinDeg  Hue min in degrees [0, 360]
 * @param {number} hMaxDeg  Hue max in degrees [0, 360]
 * @param {number} sMin     Saturation min [0, 1]
 * @param {number} sMax     Saturation max [0, 1]
 * @param {number} vMin     Value min [0, 1]
 * @param {number} vMax     Value max [0, 1]
 * @param {THREE.ShaderMaterial} material
 * @returns {THREE.Group}
 */
export function buildHSVVolume(hMinDeg, hMaxDeg, sMin, sMax, vMin, vMax, material) {
	const group = new THREE.Group();
	group.name = 'subspaceVolume';

	const fullHue = isFullHueRange(hMinDeg, hMaxDeg);

	// ── H-constant faces (pie-slice walls) ──
	// Built even when vMin=0 (the bottom edge collapses to the apex naturally).
	if (!fullHue) {
		const meshMin = buildHConstFace(hMinDeg, sMin, sMax, vMin, vMax, material);
		meshMin.name = 'face_h_min';
		group.add(meshMin);

		const meshMax = buildHConstFace(hMaxDeg, sMin, sMax, vMin, vMax, material);
		meshMax.name = 'face_h_max';
		group.add(meshMax);
	}

	// ── S-constant faces (conical shells) ──
	// Outer shell (S = sMax), always present.
	buildSConstFaces(sMax, hMinDeg, hMaxDeg, vMin, vMax, material).forEach((m, i) => {
		m.name = `face_s_max_${i}`;
		group.add(m);
	});

	// Inner shell (S = sMin), only if sMin > 0.
	// At S=0 all radii are on the V axis (a line, not a surface) — skip.
	if (sMin > 1e-4) {
		buildSConstFaces(sMin, hMinDeg, hMaxDeg, vMin, vMax, material).forEach((m, i) => {
			m.name = `face_s_min_${i}`;
			group.add(m);
		});
	}

	// ── V-constant faces (top / bottom caps) ──
	// Bottom cap: skip if vMin = 0 because at V=0 all points collapse to the apex (a point, not a surface).
	if (vMin > 1e-4) {
		buildVConstFaces(vMin, hMinDeg, hMaxDeg, sMin, sMax, material).forEach((m, i) => {
			m.name = `face_v_min_${i}`;
			group.add(m);
		});
	}

	// Top cap (V = vMax), always present.
	buildVConstFaces(vMax, hMinDeg, hMaxDeg, sMin, sMax, material).forEach((m, i) => {
		m.name = `face_v_max_${i}`;
		group.add(m);
	});

	return group;
}
