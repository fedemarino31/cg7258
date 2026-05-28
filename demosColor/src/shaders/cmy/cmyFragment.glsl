varying vec3 vLocalPosition;

void main() {
    // Cube is centered on XZ: X and Z range from -0.5 to 0.5, Y from 0 to 1.
    // Add 0.5 to X and Z to recover the [0,1] CMY values.
    float c = vLocalPosition.x + 0.5;
    float m = vLocalPosition.y;
    float y = vLocalPosition.z + 0.5;

    // Convert CMY to RGB
    gl_FragColor = vec4(1.0 - c, 1.0 - m, 1.0 - y, 1.0);
}
