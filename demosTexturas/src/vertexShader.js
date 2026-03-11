export const vertexShader = `    
    precision highp float;

    // Atributos de los vértices
    attribute vec3 position; 	// Posición del vértice
    attribute vec2 uv;		 	// Coordenadas de textura

    // Uniforms
    uniform mat4 modelMatrix;		// Matriz de transformación del objeto
    uniform mat4 viewMatrix;		// Matriz de transformación de la cámara
    uniform mat4 projectionMatrix;	//	Matriz de proyección de la cámara

    // Varying
    varying vec2 vUv;	// Coordenadas de textura que se pasan al fragment shader

    void main() {
        
        // Lee la posición del vértice desde los atributos

        vec3 pos = position;	

        // Se calcula la posición final del vértice
        // Se aplica la transformación del objeto, la de la cámara y la de proyección

        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(pos, 1.0);

        // Se pasan las coordenadas de textura al fragment shader
        vUv = uv;
    }
`;
