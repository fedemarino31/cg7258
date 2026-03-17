// HSV Fragment Shader — converts interpolated HSV attributes to RGB per fragment

varying vec2 v_hueDir;  // interpolated (cos h, sin h)
varying vec2 v_vs;      // interpolated (value, saturation)

const float TAU = 6.28318530718;

// ── HSV → RGB conversion ──────────────────────────────
// Standard compact form. h ∈ [0, 1), s ∈ [0, 1], v ∈ [0, 1].

vec3 hsvToRgb(float h, float s, float v) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(h + K.xyz) * 6.0 - K.www);
    return v * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), s);
}

// ── main ───────────────────────────────────────────────

void main() {
    // Reconstruct hue angle from interpolated direction vector.
    // atan(y, x) is robust across the 0°/360° boundary.
    float hRad = atan(v_hueDir.y, v_hueDir.x);
    if (hRad < 0.0) hRad += TAU;
    float h = hRad / TAU;  // [0, 1)

    float val = clamp(v_vs.x, 0.0, 1.0);  // V
    float s   = clamp(v_vs.y, 0.0, 1.0);  // S

    vec3 rgb = hsvToRgb(h, s, val);
    gl_FragColor = vec4(rgb, 1.0);
}
