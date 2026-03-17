import * as THREE from 'three';
import hsvVertexShader from './shaders/hsv/hsvVertex.glsl';
import hsvFragmentShader from './shaders/hsv/hsvFragment.glsl';

/**
 * HSVVolumeMaterial — creates the ShaderMaterial used by all HSV volume faces.
 *
 * The material expects BufferGeometry with custom attributes:
 *   - hsvHueDir  (vec2)  — cos(h), sin(h)
 *   - hsvVS      (vec2)  — value, saturation
 */
export function createHSVVolumeMaterial() {
	return new THREE.ShaderMaterial({
		vertexShader: hsvVertexShader,
		fragmentShader: hsvFragmentShader,
		side: THREE.DoubleSide,
	});
}
