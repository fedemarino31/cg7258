# Demo interactiva Three.js — Normales, Flat Shading y Smooth Shading

## 1. Objetivo

Implementar una demo didáctica en **Three.js** para explicar visualmente:

- que la GPU trabaja con **triángulos**, no con quads;
- qué normales están realmente definidas en los vértices;
- qué es una **normal de cara** y por qué es una magnitud derivada, no necesariamente un atributo almacenado en la malla;
- cómo se interpolan las normales dentro de cada triángulo;
- por qué el **flat shading** produce discontinuidades;
- por qué el **smooth shading** produce una transición continua;
- que la geometría puede ser exactamente la misma y cambiar solamente las normales utilizadas para la iluminación.

La demo debe ser muy clara visualmente y usable en una clase, evitando mostrar demasiada información al mismo tiempo.

---

# 2. Idea general

La pantalla se divide en dos viewports sincronizados:

- **Izquierda: FLAT SHADING**
- **Derecha: SMOOTH SHADING**

Ambas vistas deben mostrar exactamente:

- la misma geometría;
- la misma cámara;
- el mismo ángulo entre superficies;
- la misma iluminación;
- los mismos controles;
- el mismo punto de inspección;
- la misma línea de muestreo.

La única diferencia conceptual debe ser la forma en que se definen/utilizan las normales.

```text
┌──────────────────────────────┬──────────────────────────────┐
│        FLAT SHADING          │        SMOOTH SHADING        │
│                              │                              │
│            escena            │            escena            │
│                              │                              │
└──────────────────────────────┴──────────────────────────────┘

                                  ┌───────────────────────┐
                                  │ PANEL DE CONTROLES    │
                                  │ arriba a la derecha   │
                                  └───────────────────────┘
```

---

# 3. Tecnología

Usar:

- Three.js
- OrbitControls
- Raycaster
- un panel tipo **Tweakpane / Quick Pane / equivalente** ubicado arriba a la derecha
- JavaScript o TypeScript según la estructura del proyecto

Si el proyecto ya tiene una librería de panel similar instalada, reutilizarla.

No utilizar frameworks de UI pesados salvo que el proyecto ya los use.

---

# 4. Geometría

## 4.1 Superficie

Crear dos regiones planas contiguas:

- región **A**
- región **B**

Deben compartir una arista central y formar un ángulo configurable.

Cada región debe estar compuesta explícitamente por **dos triángulos**.

Total:

- A1
- A2
- B1
- B2

La triangulación debe ser visible.

Ejemplo conceptual:

```text
A1 / A2
┌────────────┐
│ \          │
│   \        │
│     \      │
└──────\─────┘
        \
         \  B1 / B2
          ┌────────────┐
          │ \          │
          │   \        │
          │     \      │
          └────────────┘
```

No presentar conceptualmente la estructura como dos "quads".  
La unidad visual y matemática principal debe ser el **triángulo**.

---

# 5. Apariencia de los triángulos

Cada triángulo debe poder distinguirse visualmente.

Usar cuatro tonalidades relacionadas:

- A1
- A2
- B1
- B2

No usar colores completamente diferentes que hagan parecer que son cuatro objetos sin relación.

Agregar opcionalmente etiquetas:

- `A1`
- `A2`
- `B1`
- `B2`

Las etiquetas deben poder ocultarse desde el panel.

---

# 6. Ángulo entre A y B

Agregar un slider:

```text
Ángulo entre superficies
0° ─────────────●──────────── 90°
```

Rango sugerido:

- mínimo: `0°`
- máximo: `100°`
- valor inicial: `45°`

El movimiento debe modificar simultáneamente ambas vistas.

La geometría de A permanece fija y B rota alrededor de la arista compartida.

Esto permite mostrar que:

- con ángulos pequeños, flat y smooth se parecen;
- al aumentar el ángulo, la diferencia se vuelve mucho más evidente.

---

# 7. Modos de normales

## 7.1 Flat shading

Cada triángulo posee una normal de cara.

Para representar conceptualmente flat shading, los vértices del triángulo deben utilizar la misma dirección normal.

Dos triángulos que comparten una posición espacial pueden tener normales diferentes.

Especialmente en la arista entre A y B debe verse claramente:

```text
normal asociada a A
normal asociada a B
```

aunque ambas correspondan espacialmente al mismo borde.

Si es necesario, desplazar mínimamente las flechas para que ambas puedan verse.

---

## 7.2 Smooth shading

Los vértices compartidos deben tener normales suavizadas.

En la arista A/B, la normal debe ser el resultado del promedio apropiado de las normales de las caras adyacentes.

La transición visual debe resultar continua.

---

# 8. Categorías visuales de normales

Es fundamental que cada tipo de normal tenga una representación diferente.

Debe ser imposible confundirlas.

## 8.1 Normales almacenadas en vértices

Representan datos reales del atributo:

```js
geometry.attributes.normal
```

Visual sugerido:

- flechas relativamente grandes;
- línea sólida;
- mismo estilo en ambas vistas;
- color específico y consistente.

Nombre en UI:

**Normales de vértices**

---

## 8.2 Normales interpoladas

Representan la normal que se obtiene dentro del triángulo mediante interpolación baricéntrica de las normales de sus tres vértices.

Visual sugerido:

- flechas más pequeñas;
- línea más fina;
- estilo claramente diferente;
- pueden distribuirse sobre una línea de muestreo.

Nombre en UI:

**Normales interpoladas**

Estas NO son atributos almacenados individualmente en la geometría.

---

## 8.3 Normal de cara / triángulo

Mostrar opcionalmente una normal perpendicular al plano de cada triángulo.

IMPORTANTE:

Debe quedar claro visualmente y en la interfaz que esta normal es una **magnitud calculada/derivada**, no necesariamente un atributo almacenado de la malla.

Nombre en UI:

**Normales de cara (calculadas)**

Visual sugerido:

- una flecha por triángulo;
- ubicada en el centroide;
- estilo punteado o discontinuo;
- diferente de las normales de vértices.

Agregar tooltip o pequeña leyenda:

> Normal geométrica calculada a partir de los vértices del triángulo.

---

# 9. Normal interactiva de inspección

Esta debe ser una de las herramientas principales de la demo.

## 9.1 Activación

Checkbox:

```text
☐ Modo inspección interactiva
```

Cuando está activo:

- el usuario puede hacer clic sobre la superficie;
- el usuario puede hacer click + drag;
- utilizar `Raycaster`;
- determinar exactamente sobre qué triángulo está el cursor;
- mover un punto de inspección sobre la superficie.

---

# 10. Punto de inspección

Representar el punto seleccionado con un marcador claramente visible.

Por ejemplo:

- pequeña esfera;
- pequeño disco;
- crosshair.

Debe proyectarse exactamente sobre la superficie.

---

# 11. Normal de inspección

En el punto interactivo dibujar una **normal grande**.

Debe ser visualmente distinta de todas las demás.

Nombre conceptual:

**Normal en el punto seleccionado**

Esta normal se calcula mediante interpolación baricéntrica dentro del triángulo seleccionado.

En smooth shading:

```text
N = normalize(
    w0 * N0 +
    w1 * N1 +
    w2 * N2
)
```

En flat shading:

los tres vértices del triángulo tienen la misma normal, por lo que el resultado permanece constante dentro del triángulo.

---

# 12. Interacción mediante Raycasting

Proceso:

1. obtener posición del mouse;
2. convertir a NDC;
3. raycast sobre la geometría correspondiente;
4. obtener:
   - punto 3D;
   - triángulo / face index;
   - coordenadas baricéntricas;
5. interpolar la normal;
6. actualizar marcador y flecha.

La interacción debe funcionar tanto con click como con drag.

Mientras se arrastra:

- actualizar continuamente el punto;
- actualizar continuamente la normal.

---

# 13. Comportamiento didáctico esperado

## Flat shading

Al arrastrar el punto:

- dentro de un mismo triángulo, la normal permanece igual;
- al atravesar una frontera con distinta normal, la flecha cambia abruptamente.

Debe verse claramente el salto.

## Smooth shading

Al arrastrar:

- la normal cambia progresivamente;
- la flecha rota suavemente;
- incluso cruzando la arista entre A y B debe observarse continuidad si las normales compartidas son iguales.

Este contraste es uno de los objetivos principales de la demo.

---

# 14. Línea de muestreo

Agregar una línea que atraviese transversalmente la superficie.

Debe poder moverse mediante un slider:

```text
Posición línea de muestreo
0 ─────────●───────── 1
```

Sobre esa línea dibujar varias normales interpoladas.

Cantidad sugerida:

```text
12
```

Configurable internamente.

---

# 15. Normales sobre la línea de muestreo

Para cada muestra:

1. localizar el triángulo que contiene el punto;
2. obtener sus coordenadas baricéntricas;
3. interpolar la normal;
4. normalizar;
5. dibujar una flecha pequeña.

Resultado esperado:

### Flat

```text
↑ ↑ ↑ ↑ ↑ ↑    ↗ ↗ ↗ ↗ ↗
```

Las normales aparecen constantes por región/triángulo y presentan cambios abruptos.

### Smooth

```text
↑  ↑  ↗  ↗  →  ↘
```

Las direcciones evolucionan progresivamente.

---

# 16. Coordenadas baricéntricas

Implementar explícitamente la interpolación.

Para un punto `P` dentro de un triángulo:

```text
P = w0 V0 + w1 V1 + w2 V2
```

con:

```text
w0 + w1 + w2 = 1
```

La normal:

```text
N = normalize(
    w0 N0 +
    w1 N1 +
    w2 N2
)
```

No depender únicamente del shading automático del material para explicar el concepto.

La aplicación debe calcular y visualizar estas normales explícitamente.

---

# 17. Panel de controles

Ubicado arriba a la derecha.

Organizarlo por secciones.

## GEOMETRÍA

```text
Ángulo A/B            [ slider ]

☑ Mostrar triángulos
☑ Mostrar aristas
☑ Mostrar etiquetas
```

## NORMALES

```text
☑ Normales de vértices
☐ Normales de cara (calculadas)
☑ Normales interpoladas
```

## INSPECCIÓN

```text
☑ Modo inspección interactiva
☑ Mostrar punto seleccionado
☑ Mostrar normal seleccionada
```

## MUESTREO

```text
☑ Mostrar línea de muestreo
☑ Mostrar normales de muestreo

Posición de línea      [ slider ]
Cantidad de muestras   [ slider ]
```

## RENDER

```text
☑ Iluminación
☑ Superficie sólida
☐ Wireframe
```

## CÁMARA

```text
[ Vista 3D ]
[ Vista lateral ]
[ Vista superior ]
[ Reset ]
```

---

# 18. Checkboxes

Todo elemento auxiliar debe poder ocultarse.

Como mínimo:

- triángulos;
- aristas;
- etiquetas;
- normales de vértices;
- normales de cara;
- normales interpoladas;
- línea de muestreo;
- normales de muestreo;
- punto de inspección;
- normal interactiva;
- superficie sólida;
- iluminación;
- wireframe.

---

# 19. Cámara

Usar `OrbitControls`.

Las dos cámaras deben permanecer sincronizadas.

Opciones posibles:

### Opción recomendada

Una única definición lógica de cámara:

```js
cameraState
```

y aplicar el mismo estado a ambos renders.

Sincronizar:

- position;
- quaternion;
- target.

---

# 20. Vistas predefinidas

Crear botones:

### Vista 3D

Vista perspectiva estándar.

### Vista lateral

Especialmente útil para ver:

- el ángulo A/B;
- la dirección de las normales;
- los cambios en la normal de inspección.

### Vista superior

Útil para:

- mostrar la triangulación;
- observar la línea de muestreo.

### Reset

Restaurar posición inicial.

---

# 21. Iluminación

Usar una iluminación simple.

Por ejemplo:

- `DirectionalLight`
- `AmbientLight` suave

Evitar sistemas complejos.

La iluminación debe permitir percibir claramente la diferencia visual entre flat y smooth.

---

# 22. Material

El material visual de la superficie debe permitir comparar el resultado de iluminación.

Puede utilizarse:

```js
MeshStandardMaterial
```

o:

```js
MeshLambertMaterial
```

No depender de texturas.

Debe existir un checkbox:

```text
☑ Iluminación
```

Cuando se desactiva, mostrar la geometría con un material neutro/unlit para estudiar únicamente:

- triángulos;
- normales;
- interpolación.

---

# 23. Muy importante: geometría idéntica

Ambos viewports deben usar exactamente las mismas posiciones de vértices.

No debe existir ninguna diferencia geométrica entre:

- flat;
- smooth.

La diferencia debe estar exclusivamente en:

- estructura de índices/vértices si fuese necesario para separar normales;
- atributo `normal`;
- modo en que se construyen las normales.

---

# 24. Implementación recomendada para Flat

Para representar correctamente una discontinuidad de normales en un mismo punto espacial, puede ser necesario duplicar vértices.

Por ejemplo:

```text
posición física compartida
       │
       ├── vértice perteneciente a triángulo A
       │      normal NA
       │
       └── vértice perteneciente a triángulo B
              normal NB
```

Visualmente ocupan el mismo lugar.

Conceptualmente son dos vértices distintos dentro del buffer.

Esto es importante para explicar por qué una arista dura requiere discontinuidad del atributo normal.

---

# 25. Implementación recomendada para Smooth

Los vértices de la arista compartida A/B deben utilizar una normal suavizada.

Ejemplo conceptual:

```text
Nshared = normalize(NA + NB)
```

Para una geometría más general, utilizar el promedio apropiado de las normales de caras adyacentes.

Para esta demo sencilla puede utilizarse un promedio directo normalizado.

---

# 26. Normales de los triángulos

Calcular:

```js
const edge1 = v1 - v0;
const edge2 = v2 - v0;

const faceNormal = normalize(
    cross(edge1, edge2)
);
```

Estas normales sirven para:

- construir flat shading;
- calcular las normales suavizadas;
- visualizar normales geométricas de cara.

No tratarlas visualmente como si fueran necesariamente un atributo separado almacenado en la malla.

---

# 27. Distinción visual obligatoria

Definir un lenguaje visual consistente.

Por ejemplo:

| Elemento | Tamaño | Línea | Ubicación |
|---|---:|---|---|
| Normal de vértice | grande | sólida | vértice |
| Normal interpolada de muestreo | pequeña | sólida/fina | línea |
| Normal de cara | mediana | punteada | centroide |
| Normal interactiva | muy grande | destacada | cursor |
| Aristas | finas | sólida | triángulos |

Los colores exactos pueden definirse según la estética general del proyecto.

Lo importante es que las cuatro categorías sean reconocibles inmediatamente.

---

# 28. Leyenda

Agregar una pequeña leyenda opcional.

Ejemplo:

```text
────▶ Normal de vértice

- - -▶ Normal de cara calculada

──▶ Normal interpolada

━━━━▶ Normal seleccionada
```

Checkbox:

```text
☑ Mostrar leyenda
```

---

# 29. Información contextual del punto seleccionado

Cuando el modo inspección está activo, mostrar un pequeño panel de información.

Por ejemplo:

```text
Triángulo: B1

Baricéntricas:
w0 = 0.18
w1 = 0.57
w2 = 0.25
```

Opcionalmente:

```text
N =
normalize(
0.18 N0 +
0.57 N1 +
0.25 N2
)
```

Checkbox:

```text
☐ Mostrar cálculo
```

Este panel debe ser secundario y no interferir con la visualización principal.

---

# 30. Interacción click + drag

Implementar:

```text
pointerdown
pointermove
pointerup
```

Cuando:

```text
inspectionMode === true
```

y ocurre `pointerdown` sobre la superficie:

```text
dragInspection = true
```

Durante `pointermove`:

- raycast;
- actualizar punto;
- actualizar normal;
- actualizar datos baricéntricos.

Al soltar:

```text
dragInspection = false
```

OrbitControls debe deshabilitarse temporalmente durante el drag sobre la superficie para evitar conflicto.

---

# 31. Diferenciar interacción de cámara e inspección

Cuando el modo inspección está apagado:

```text
drag = OrbitControls
```

Cuando está encendido:

```text
drag sobre superficie = mover normal
drag fuera de superficie = OrbitControls
```

Debe resultar intuitivo.

---

# 32. Arquitectura sugerida

Separar responsabilidades.

Ejemplo:

```text
src/
│
├── main.js
│
├── geometry/
│   ├── createBaseSurface.js
│   ├── createFlatGeometry.js
│   └── createSmoothGeometry.js
│
├── normals/
│   ├── computeFaceNormals.js
│   ├── computeSmoothNormals.js
│   ├── interpolateNormal.js
│   └── barycentric.js
│
├── helpers/
│   ├── VertexNormalHelpers.js
│   ├── FaceNormalHelpers.js
│   ├── SamplingNormals.js
│   └── InspectionNormal.js
│
├── interaction/
│   └── SurfaceInspector.js
│
├── ui/
│   └── controls.js
│
└── rendering/
    └── SplitRenderer.js
```

No es obligatorio mantener exactamente esta estructura si el proyecto existente utiliza otra organización.

---

# 33. Render dividido

Dos alternativas.

## Alternativa A — Dos canvas

Un canvas por viewport.

Ventaja:

- implementación sencilla;
- fácil separación.

## Alternativa B — Un canvas + scissor

Utilizar:

```js
renderer.setScissorTest(true)
```

y renderizar dos viewports.

Recomendado si se desea una demo compacta y eficiente.

---

# 34. Recomendación

Preferir:

**un solo WebGLRenderer + dos viewports usando viewport/scissor.**

Esto garantiza:

- mismo renderer;
- misma iluminación;
- fácil sincronización;
- mejor eficiencia;
- comparación visual consistente.

---

# 35. Etiquetas principales

Cada mitad debe tener una etiqueta visible:

```text
FLAT SHADING
```

y:

```text
SMOOTH SHADING
```

Agregar subtítulo opcional:

Flat:

```text
Normal constante por triángulo
```

Smooth:

```text
Normal interpolada entre vértices
```

---

# 36. Estado inicial recomendado

Al cargar:

```text
Ángulo A/B:             45°
Triángulos:             ON
Aristas:                ON
Etiquetas:              ON
Normales de vértices:   ON
Normales de cara:       OFF
Normales interpoladas:  ON
Línea de muestreo:      ON
Normal interactiva:     ON
Iluminación:            ON
Wireframe:              OFF
Leyenda:                ON
```

La escena inicial debe ser informativa pero no saturada.

---

# 37. Secuencia didáctica que debería permitir la demo

La aplicación debe ser útil para explicar en este orden:

## Paso 1

Mostrar solamente:

- geometría;
- aristas;
- A1/A2/B1/B2.

Mensaje:

> La GPU trabaja con triángulos.

---

## Paso 2

Activar:

- normales de vértices.

Mensaje:

> Cada vértice puede tener una normal asociada.

---

## Paso 3

Comparar flat vs smooth.

Mensaje:

> La geometría es idéntica. Lo que cambia son las normales.

---

## Paso 4

Activar:

- línea de muestreo;
- normales interpoladas.

Mensaje:

> Dentro de cada triángulo, la GPU interpola las normales de sus vértices.

---

## Paso 5

Activar modo inspección.

Arrastrar la normal sobre la superficie.

Mensaje:

> Esta es la normal que utilizaría la iluminación en este punto.

---

## Paso 6

Cruzar la frontera A/B.

Flat:

> Cambio abrupto.

Smooth:

> Cambio continuo.

---

## Paso 7

Activar iluminación.

Mensaje:

> La iluminación utiliza estas normales para calcular el aspecto de la superficie.

---

# 38. Criterios de éxito

La demo se considera correcta si permite comprender visualmente, sin mirar código, las siguientes ideas:

1. una superficie está compuesta por triángulos;
2. las normales de vértices son atributos de la geometría;
3. la normal geométrica de una cara se puede calcular a partir del triángulo;
4. la normal de un punto interior puede obtenerse interpolando las normales de vértices;
5. flat shading produce una normal constante dentro de una cara;
6. smooth shading produce una variación continua;
7. una arista dura requiere una discontinuidad de normales;
8. dos vértices pueden ocupar la misma posición espacial y contener normales diferentes;
9. smooth shading no modifica la geometría;
10. la iluminación responde a las normales, no a una geometría mágicamente "redondeada".

---

# 39. Restricciones

- No usar modelos externos.
- No usar texturas.
- No usar postprocesado.
- No agregar efectos decorativos innecesarios.
- No usar animaciones automáticas que distraigan.
- Mantener la escena limpia.
- Priorizar legibilidad.
- Mantener buen rendimiento.
- Mantener código modular y fácil de modificar.

---

# 40. Prioridades de implementación

## Fase 1 — Base

- split screen;
- geometría A/B;
- cuatro triángulos;
- cámara sincronizada;
- flat vs smooth;
- iluminación.

## Fase 2 — Visualización

- normales de vértices;
- normales de cara;
- aristas;
- etiquetas;
- checkboxes.

## Fase 3 — Interpolación

- coordenadas baricéntricas;
- línea de muestreo;
- normales interpoladas.

## Fase 4 — Inspector interactivo

- Raycaster;
- click;
- drag;
- punto;
- normal grande;
- panel de información.

## Fase 5 — UX

- vistas predefinidas;
- reset;
- leyenda;
- estilos finales;
- manejo correcto de resize.

---

# 41. Resultado esperado

La aplicación final debe funcionar como una **diapositiva interactiva**.

El usuario debe poder:

- orbitar la geometría;
- modificar el ángulo entre A y B;
- activar/desactivar capas de información;
- ver las normales reales de los vértices;
- ver normales de cara calculadas;
- observar normales interpoladas;
- arrastrar una normal sobre la superficie;
- cruzar fronteras entre triángulos;
- comparar simultáneamente flat y smooth shading;
- activar la iluminación para relacionar las normales con el resultado visual.

La prioridad absoluta es la claridad conceptual.

---

# 42. Concepto central a transmitir

> **Flat shading y smooth shading pueden utilizar exactamente la misma geometría.**
>
> La diferencia está en las normales asociadas a los vértices y en cómo esas normales se interpolan dentro de cada triángulo antes de utilizarse en el cálculo de iluminación.

