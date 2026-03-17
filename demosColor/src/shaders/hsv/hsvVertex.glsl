// HSV Vertex Shader — attribute-based approach (mirrors hslVertex.glsl)
//
// Receives per-vertex HSV data through custom attributes,
// NOT reverse-engineered from world position.

attribute vec2 hsvHueDir;  // (cos(h), sin(h)) — robust angular interpolation
attribute vec2 hsvVS;      // (value, saturation)

varying vec2 v_hueDir;     // interpolated hue direction
varying vec2 v_vs;         // interpolated (value, saturation)

void main() {
    v_hueDir = hsvHueDir;
    v_vs     = hsvVS;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
