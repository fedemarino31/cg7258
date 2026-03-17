import * as THREE from 'three';
import hslVertexShader from './shaders/hsl/hslVertex.glsl';
import hslFragmentShader from './shaders/hsl/hslFragment.glsl';

/**
 * HSLVolumeMaterial — creates and manages the ShaderMaterial
 * used by all HSL volume boundary faces.
 *
 * The material expects BufferGeometry with custom attributes:
 *   - hslHueDir  (vec2)  — cos(h), sin(h)
 *   - hslSL      (vec2)  — saturation, lightness
 */

/**
 * Create a new HSL volume shader material.
 * @returns {THREE.ShaderMaterial}
 */
export function createHSLVolumeMaterial() {
	return new THREE.ShaderMaterial({
		vertexShader: hslVertexShader,
		fragmentShader: hslFragmentShader,
		side: THREE.DoubleSide,
		transparent: false,
	});
}
