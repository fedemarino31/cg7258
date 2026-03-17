# Proyecto: Visualizador Interactivo de Espacios de Color 3D

**Objetivo Principal:** Crear una aplicación web 3D interactiva que permita visualizar y explorar los espacios de color RGB, CMY, HSV y HSL. Se controlará mediante una interfaz gráfica `lil-gui` para seleccionar el modelo de color, ajustar los límites del subespacio visible y controlar la cámara.

---

**Tecnologías Principales:**

-   **Three.js:** Para la renderización y manipulación de la escena 3D.
-   **lil-gui:** Para la creación del menú de controles interactivos.
-   **HTML/CSS/JavaScript:** Para la estructura de la aplicación y la lógica.

---

**Estructura Modular Sugerida:**

Se recomienda la siguiente estructura de clases para organizar el código:

1.  **`UIManager.js`**: Responsable de crear y gestionar todos los elementos de la interfaz de usuario con `lil-gui`.
2.  **`SceneManager.js`**: Encargado de la configuración inicial de la escena de Three.js y de orquestar la visualización.
3.  **`ColorSpace.js`**: (Anteriormente `SpaceBuilder`) Responsable de generar y actualizar todas las geometrías y materiales para los espacios de color.

---

**1. Configuración Inicial (`main.js` o similar):**

-   Inicializar la escena de Three.js (renderer, cámara con `OrbitControls`, iluminación).
-   Instanciar `UIManager`, `SceneManager`, y `ColorSpace`.
-   Establecer el modelo de color inicial (por ejemplo, RGB) y renderizarlo.
-   Iniciar el bucle de animación/renderizado.

---

**2. Gestor de Interfaz de Usuario (`UIManager.js`):**

-   **Inicialización:**
    -   Crear una instancia de `lil-gui`.
-   **Menú Principal:**
    -   **Selector de Modelo de Color:**
        -   Control: Desplegable.
        -   Opciones: "RGB", "CMY", "HSV", "HSL".
        -   Acción:
            1.  Notificar a `SceneManager` para actualizar la visualización al nuevo modelo.
            2.  **Importante:** Resetear los valores de los sliders de límites a sus rangos completos para el nuevo modelo seleccionado.
            3.  Actualizar la visibilidad de los sliders en la carpeta "Límites" para mostrar solo los correspondientes al nuevo modelo.
    -   **Carpeta "Límites":**
        -   **Visibilidad Dinámica:** Solo se mostrarán los sliders correspondientes al modelo de color actualmente seleccionado.
        -   **RGB:**
            -   `rMin`, `rMax` (rango \[0, 1], step 0.01)
            -   `gMin`, `gMax` (rango \[0, 1], step 0.01)
            -   `bMin`, `bMax` (rango \[0, 1], step 0.01)
        -   **CMY:**
            -   `cMin`, `cMax` (rango \[0, 1], step 0.01)
            -   `mMin`, `mMax` (rango \[0, 1], step 0.01)
            -   `yMin`, `yMax` (rango \[0, 1], step 0.01)
        -   **HSV:**
            -   `hMin`, `hMax` (rango \[0, 360], step 1)
            -   `sMin`, `sMax` (rango \[0, 1], step 0.01)
            -   `vMin`, `vMax` (rango \[0, 1], step 0.01)
        -   **HSL:**
            -   `hMin`, `hMax` (rango \[0, 360], step 1)
            -   `sMin`, `sMax` (rango \[0, 1], step 0.01)
            -   `lMin`, `lMax` (rango \[0, 1], step 0.01)
        -   **Acción de Sliders:** Al cambiar un valor, se notificará para actualizar el subespacio de color.
            -   **Debounce:** Implementar un debounce de 500ms. La actualización de la geometría del subespacio solo se disparará si han pasado 500ms desde el último cambio.
    -   **Carpeta "Comandos":**
        -   **Botón "Reset Límites":**
            -   Acción: Restablecerá los sliders de límites del modelo actual a sus rangos completos. Disparará la actualización del subespacio.
        -   **Botón "Ajustar Vista":**
            -   Acción: Notificará a `SceneManager` para que ajuste la cámara de modo que el espacio de color completo actual sea visible y ocupe la mayor parte de la pantalla sin recortes.
-   **Funcionalidad:**
    -   Gestionar la visibilidad y valores de los sliders.
    -   Almacenar los valores actuales de los límites.

---

**3. Gestor de Escena (`SceneManager.js`):**

-   **Responsabilidades:**
    -   Contener la instancia de la escena, cámara y renderer.
    -   Manejar el cambio de modelo de color:
        -   Limpiar los objetos 3D del modelo anterior (llamando a `ColorSpace`).
        -   Solicitar a `ColorSpace` que construya los nuevos elementos 3D.
        -   Informar a `UIManager` para actualizar la UI y resetear límites.
    -   Recibir notificaciones de `UIManager` sobre cambios en los límites y transmitirlas a `ColorSpace`.
    -   **Ajustar Cámara a la Vista:**
        -   Implementar un método `fitCameraToCurrentSpace()` que:
            1.  Obtenga el objeto o bounding box del contorno del espacio de color completo actual desde `ColorSpace`.
            2.  Ajuste la posición de la cámara (y/o `zoom` si es ortográfica, o `fov` y distancia si es perspectiva) para encuadrar dicho objeto/bounding box en la pantalla. `THREE.Box3().setFromObject(object)` y `OrbitControls.target` pueden ser útiles aquí, así como cálculos basados en el `fov` y el tamaño del objeto.

---

**4. Constructor de Espacios de Color (`ColorSpace.js`):**

-   **A. Ejes y Etiquetas:**
    -   **Ejes:** Segmentos de línea blancos (`LineSegments` con `LineBasicMaterial`).
    -   **Etiquetas:** `Sprite` con texto blanco sobre fondo transparente, siempre mirando a la cámara. Nombres: "R", "G", "B"; "C", "M", "Y"; "H", "S", "V"; "H", "S", "L".
-   **B. Representación del Espacio de Color Completo (Contornos):**
    -   **RGB y CMY:** Cubo de 1x1x1 (`BoxLineGeometry` o `EdgesGeometry`) con `LineBasicMaterial` blanco.
    -   **HSV:** Cono (`ConeGeometry`) con `MeshBasicMaterial` o `MeshStandardMaterial` blanco, translúcido (`transparent: true`, `opacity: <valor_bajo>`), `side: THREE.DoubleSide`. Vértice en origen, base en Z=1 (o Y=1).
    -   **HSL:** Doble cono (dos `ConeGeometry` o `CylinderGeometry` adaptada) con material similar a HSV. Vértices en L=0 y L=1, base común en L=0.5.
-   **C. Representación del Subespacio de Color (Sólido y con Shader):**
    -   **Actualización Dinámica:** Geometría regenerada con debounce de 500ms.
    -   **Material Común:** `ShaderMaterial`.
        -   **Vertex Shader:** Pasa `vLocalPosition` (posición local del vértice, mapeada si es necesario) al fragment shader.
        -   **Fragment Shader:** Determina `gl_FragColor` a partir de `vLocalPosition` y los límites actuales.
    -   **Específico por Modelo:**
        -   **RGB:**
            -   Geometría: `BoxGeometry` dimensionada y posicionada por `rMin/Max`, etc.
            -   Shader: `color = vLocalPosition` (asumiendo `vLocalPosition` ya representa R,G,B normalizado dentro del sub-cubo).
        -   **CMY:**
            -   Geometría: `BoxGeometry` (usando `cMin/Max`, etc.).
            -   Shader: `rgb = vec3(1.0 - cmy.x, 1.0 - cmy.y, 1.0 - cmy.z)`.
        -   **HSV:**
            -   Geometría: Segmento de cono (complejo, `BufferGeometry` personalizada o `CylinderGeometry` adaptada).
            -   Shader: `hsv.x = hsv.x / 360.0; rgb = hsvToRgb(hsv)`.
        -   **HSL:**
            -   Geometría: Segmento de doble cono (complejo).
            -   Shader: `hsl.x = hsl.x / 360.0; rgb = hslToRgb(hsl)`.
-   **Métodos Públicos Sugeridos:**
    -   `displaySpace(modelType, limits)`
    -   `clearCurrentVisuals()`
    -   `buildAxesAndLabels(modelType)`
    -   `buildFullSpaceOutline(modelType)`: Debe devolver el objeto 3D del contorno o su BoundingBox.
    -   `updateSubSpaceVolume(modelType, limits)`
    -   `getCurrentSpaceBoundingBox()`: Devuelve el `THREE.Box3` del contorno del espacio completo actual.

---

**5. Funciones de Conversión de Color (GLSL):**

-   Implementaciones estándar de `hsvToRgb` y `hslToRgb` en los fragment shaders.

---

--

**Flujo de Implementación Sugerido:**

1.  **Base:** HTML, CSS, escena Three.js básica con `OrbitControls`.
2.  **RGB:** Implementar `UIManager` (selector, sliders RGB), `ColorSpace` (ejes, etiquetas, contorno cubo, sub-cubo con shader RGB). Conectar UI (sliders, reset límites, ajustar vista).
3.  **CMY:** Añadir a `UIManager` y `ColorSpace`.
4.  **HSV:** Añadir a `UIManager` y `ColorSpace` (geometría de cono, shader HSV->RGB).
5.  **HSL:** Añadir a `UIManager` y `ColorSpace` (geometría doble cono, shader HSL->RGB).
6.  **Refinamiento:** Lógica de `SceneManager` para cambios de modelo, limpieza, y la función de ajuste de cámara.
