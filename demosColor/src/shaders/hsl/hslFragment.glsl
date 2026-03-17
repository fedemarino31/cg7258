// HSL Fragment Shader — converts interpolated HSL attributes to RGB per fragment

varying vec2 v_hueDir;   // interpolated (cos h, sin h)
varying vec2 v_sl;       // interpolated (s, l)

const float PI  = 3.14159265359;
const float TAU = 6.28318530718;

// ── HSL → RGB conversion ──────────────────────────────

float hueChannel(float p, float q, float t) {
    if (t < 0.0) t += 1.0;
    if (t > 1.0) t -= 1.0;
    if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
    if (t < 0.5)        return q;
    if (t < 2.0 / 3.0)  return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
    return p;
}

vec3 hslToRgb(float h, float s, float l) {
    if (s < 0.001) {
        return vec3(l); // achromatic
    }
    float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
    float p = 2.0 * l - q;
    return vec3(
        hueChannel(p, q, h + 1.0 / 3.0),
        hueChannel(p, q, h),
        hueChannel(p, q, h - 1.0 / 3.0)
    );
}

// ── main ───────────────────────────────────────────────

void main() {
    // Reconstruct hue angle from interpolated direction vector.
    float hRad = atan(v_hueDir.y, v_hueDir.x);
    if (hRad < 0.0) hRad += TAU;
    float h = hRad / TAU;           // [0, 1)

    float s = clamp(v_sl.x, 0.0, 1.0);
    float l = clamp(v_sl.y, 0.0, 1.0);

    vec3 rgb = hslToRgb(h, s, l);
    gl_FragColor = vec4(rgb, 1.0);
}
