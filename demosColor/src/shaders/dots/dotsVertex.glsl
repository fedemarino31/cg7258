attribute vec3 aInstanceColor;
varying vec3 vColor;

void main() {
    vColor = aInstanceColor;
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
}
