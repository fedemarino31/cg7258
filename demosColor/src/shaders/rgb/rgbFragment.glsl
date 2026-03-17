varying vec3 vLocalPosition;

void main() {
    // The vertex position IS the RGB value — no normalization within the sub-range.
    // A point at (0.25, 0.1, 0.5) displays the color rgb(0.25, 0.1, 0.5).
    gl_FragColor = vec4(vLocalPosition, 1.0);
}
