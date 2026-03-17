## Guión para Presentación PowerPoint

### Estructura propuesta: 15 diapositivas

---

#### Diapositiva 1 — Portada

**Título:** "Construyendo una Ciudad 3D con Three.js" **Subtítulo:** "Cómo usar Grupos para crear escenas complejas a partir de piezas simples" **Imagen:** Screenshot de la ciudad generada (vista nocturna con luces)

---

#### Diapositiva 2 — ¿Qué vamos a aprender?

**Contenido:**

* Concepto de **escena jerárquica** en 3D
* Qué es un `THREE.Group` y para qué sirve
* Cómo crear piezas reutilizables de complejidad creciente
* Cómo clonar y transformar (posición, rotación, escala) objetos
* Optimización: merge de geometrías

**Imagen:** Diagrama de la jerarquía de la escena (árbol de nodos)

---

#### Diapositiva 3 — La estructura de una app Three.js

**Contenido:**

* Escena (![](vscode-file://vscode-app/c:/Programas/Dev/Antigravity/resources/app/extensions/theme-symbols/src/icons/files/js.svg)

  Scene), Cámara (`Camera`), Renderer
* El loop de animación (`requestAnimationFrame`)
* Controles de cámara (`OrbitControls`)

**Imagen:** Diagrama de flujo: Setup → Build → Animate → Render

---

#### Diapositiva 4 — El archivo ![](vscode-file://vscode-app/c:/Programas/Dev/Antigravity/resources/app/extensions/theme-symbols/src/icons/files/js.svg)

main.js

**Contenido:**

* Inicialización del renderer y la escena
* Creación de la cámara en perspectiva
* Resize responsive
* Llamada al ![](vscode-file://vscode-app/c:/Programas/Dev/Antigravity/resources/app/extensions/theme-symbols/src/icons/files/js.svg)

  CityGenerator

**Imagen:** Código simplificado de

![](vscode-file://vscode-app/c:/Programas/Dev/Antigravity/resources/app/extensions/theme-symbols/src/icons/files/js.svg)

main.js con anotaciones visuales

---

#### Diapositiva 5 — Geometrías primitivas en Three.js

**Contenido:**

* `BoxGeometry`, `CylinderGeometry`, `SphereGeometry`, `PlaneGeometry`
* Concepto de **Mesh = Geometría + Material**
* Los materiales usados en la demo (`MeshPhongMaterial`)

**Imagen:** Ilustración de las 4 primitivas con wireframe y solid

---

#### Diapositiva 6 — NIVEL 1: Pieza elemental — El Árbol 🌳

**Contenido:**

* Un `Group` con 2 meshes: tronco (cilindro) + copa (esfera)
* Cómo se posiciona la copa sobre el tronco
* Parámetros: alto, diámetro
* Función ![](vscode-file://vscode-app/c:/Programas/Dev/Antigravity/resources/app/extensions/theme-symbols/src/icons/files/js.svg)

  createTree(height, diameter)

**Imagen:** Diagrama del árbol descompuesto (cilindro + esfera → árbol) + árbol 3D

---

#### Diapositiva 7 — NIVEL 1: Pieza elemental — El Poste de Luz 💡

**Contenido:**

* Un `Group` con 3 elementos: poste (cilindro) + lámpara (esfera) + luz puntual
* Materiales emisivos para la lámpara
* `PointLight` para iluminación real

**Imagen:** Diagrama del poste descompuesto + poste 3D con cono de luz

---

#### Diapositiva 8 — NIVEL 2: Pieza compuesta — La Casa 🏠

**Contenido:**

* Un `Group` más complejo con sub-componentes repetidos
* Cuerpo del edificio (box) clonado por cada piso → **clone()**
* Ventanas (box) posicionadas con offset
* Techo y puerta
* Parámetros: cantidad de pisos, ancho de frente

**Imagen:** Casa explotada (cada componente separado) + casa armada

---

#### Diapositiva 9 — El poder de `clone()` y las transformaciones

**Contenido:**

* `mesh.clone()` → crea una copia que comparte geometría y material
* Transformaciones: `position.set()`, `rotation.set()`, `scale.set()`
* Cómo se repite el piso en un bucle `for`

**Imagen:** Animación visual: un cubo se clona y apila formando los pisos

---

#### Diapositiva 10 — NIVEL 3: Composición — El Lote (City Block) 🏘️

**Contenido:**

* Un `Group` que contiene: 1 casa + 1 parque + N postes + N árboles
* Generación procedural: alturas y tamaños aleatorios
* Función ![](vscode-file://vscode-app/c:/Programas/Dev/Antigravity/resources/app/extensions/theme-symbols/src/icons/files/js.svg)

  createLot()

**Imagen:** Vista superior del lote con sus componentes señalados

---

#### Diapositiva 11 — NIVEL 4: Repetición — El Barrio 🌆

**Contenido:**

* ![](vscode-file://vscode-app/c:/Programas/Dev/Antigravity/resources/app/extensions/theme-symbols/src/icons/files/js.svg)

  buildNeighborhood(): repite ![](vscode-file://vscode-app/c:/Programas/Dev/Antigravity/resources/app/extensions/theme-symbols/src/icons/files/js.svg)

  createLot() a lo largo de una calle
* Dos filas enfrentadas (rotación 180°)
* Cada lote con variaciones aleatorias = ciudad orgánica
* **Concepto clave:** transformación de posición + rotación

**Imagen:** Vista aérea de la calle con 16 lotes

---

#### Diapositiva 12 — La jerarquía completa

**Contenido:**

* Diagrama de árbol completo: Scene → CityContainer → Lots → Houses/Trees/LampPosts → Meshes
* Concepto: cada nivel **encapsula** complejidad

**Imagen:** Diagrama de árbol de nodos (como el mermaid del análisis)

---

#### Diapositiva 13 — Materiales, Luces y Ciclo Día/Noche 🌙

**Contenido:**

* Materiales compartidos (reutilización eficiente)
* `DirectionalLight` + `HemisphereLight` para el día
* `PointLight` en cada poste para la noche
* `lerp()` para interpolar colores del cielo
* `emissive` de las ventanas que cambia con el slider

**Imagen:** Comparación lado a lado: día vs noche

---

#### Diapositiva 14 — Optimización: Merge de Geometrías ⚡

**Contenido:**

* Problema: muchos objetos 3D = muchos draw calls = bajo FPS
* Solución: `BufferGeometryUtils.mergeGeometries()` — fusionar meshes por material
* Se pierde la jerarquía pero se gana rendimiento
* Cuándo usarlo y cuándo no

**Imagen:** Diagrama antes/después del merge (muchos objetos → pocos objetos)

---

#### Diapositiva 15 — Resumen y Próximos Pasos

**Contenido:**

* Recapitulación: Primitivas → Piezas → Composiciones → Escena
* Concepto clave: **Group como contenedor reutilizable**
* Ideas para extender: semáforos, autos, animaciones, texturas
* Recursos: documentación de Three.js, ejemplos

**Imagen:** La ciudad completa con anotaciones
