varying vec3 vLocalPosition;

void main() {
    // The vertex position IS the CMY value — no normalization within the sub-range.
    float c = vLocalPosition.x;
    float m = vLocalPosition.y;
    float y = vLocalPosition.z;

    // Convert CMY to RGB
    gl_FragColor = vec4(1.0 - c, 1.0 - m, 1.0 - y, 1.0);
}
