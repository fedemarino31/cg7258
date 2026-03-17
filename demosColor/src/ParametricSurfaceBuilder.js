import * as THREE from 'three';

/**
 * ParametricSurfaceBuilder — generates a BufferGeometry from a parametric
 * function sampled on a rectangular (u, v) grid.
 *
 * The sampling function must return, for every (u, v):
 *   {
 *     position : { x, y, z },
 *     hueDir   : { x, y },          // cos(h), sin(h)
 *     sl       : { x, y },          // s, l
 *   }
 *
 * The generated geometry has:
 *   - attribute  "position"    (vec3)
 *   - attribute  "hslHueDir"   (vec2)  — for robust angular interpolation
 *   - attribute  "hslSL"       (vec2)  — saturation, lightness
 *   - indexed triangulation  (two triangles per quad)
 *   - vertex normals via computeVertexNormals()
 */

/**
 * Build a parametric surface.
 *
 * @param {function(u: number, v: number): Object} fn
 *        Sampling function — see format above.
 * @param {number} uSteps  Number of subdivisions along u (≥ 1).
 * @param {number} vSteps  Number of subdivisions along v (≥ 1).
 * @returns {THREE.BufferGeometry}
 */
export function buildParametricSurface(fn, uSteps, vSteps) {
	const vertexCount = (uSteps + 1) * (vSteps + 1);

	const positions = new Float32Array(vertexCount * 3);
	const hueDirs = new Float32Array(vertexCount * 2);
	const sls = new Float32Array(vertexCount * 2);

	let idx = 0;
	for (let iv = 0; iv <= vSteps; iv++) {
		const v = iv / vSteps;
		for (let iu = 0; iu <= uSteps; iu++) {
			const u = iu / uSteps;

			const sample = fn(u, v);

			const i3 = idx * 3;
			positions[i3] = sample.position.x;
			positions[i3 + 1] = sample.position.y;
			positions[i3 + 2] = sample.position.z;

			const i2 = idx * 2;
			hueDirs[i2] = sample.hueDir.x;
			hueDirs[i2 + 1] = sample.hueDir.y;

			sls[i2] = sample.sl.x;
			sls[i2 + 1] = sample.sl.y;

			idx++;
		}
	}

	// Build index buffer (two triangles per quad)
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
	geometry.setAttribute('hslHueDir', new THREE.BufferAttribute(hueDirs, 2));
	geometry.setAttribute('hslSL', new THREE.BufferAttribute(sls, 2));
	geometry.setIndex(new THREE.BufferAttribute(indices, 1));

	geometry.computeVertexNormals();

	return geometry;
}
