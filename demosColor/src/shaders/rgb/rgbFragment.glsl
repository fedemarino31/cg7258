varying vec3 vLocalPosition;

void main() {
    // Cube is centered on XZ: X and Z range from -0.5 to 0.5, Y from 0 to 1.
    // Add 0.5 to X and Z to recover the [0,1] RGB values.
    vec3 color = vLocalPosition + vec3(0.5, 0.0, 0.5);
    gl_FragColor = vec4(color, 1.0);
}
