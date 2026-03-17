// HSL Vertex Shader — attribute-based approach
//
// Receives per-vertex HSL data through custom attributes,
// NOT reverse-engineered from world position.

attribute vec2 hslHueDir;   // (cos(h), sin(h)) — robust angular interpolation
attribute vec2 hslSL;       // (saturation, lightness)

varying vec2 v_hueDir;      // interpolated hue direction
varying vec2 v_sl;          // interpolated (s, l)

void main() {
    v_hueDir = hslHueDir;
    v_sl     = hslSL;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
