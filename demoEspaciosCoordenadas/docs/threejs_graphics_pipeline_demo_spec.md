# Demo Three.js — Visualización interactiva del Pipeline Gráfico 3D

## 1. Descripción general

Desarrollar una aplicación web interactiva en **Three.js** orientada a la enseñanza del pipeline gráfico tradicional.

La demo debe permitir visualizar, de manera simultánea y dinámica, una escena 3D convencional y la representación de esa misma geometría en distintas etapas del pipeline:

1. **Model Space**
2. **World Space**
3. **View / Camera Space**
4. **Clip Space**
5. **NDC — Normalized Device Coordinates**
6. **Screen / Raster Space**

El objetivo principal es que el estudiante comprenda que un mismo vértice y una misma geometría atraviesan sucesivas transformaciones matemáticas antes de convertirse en píxeles de pantalla.

La aplicación debe privilegiar la **claridad didáctica** por encima del realismo gráfico.

---

# 2. Objetivo pedagógico

La demo debe permitir comprender visualmente:

- qué significa que un objeto tenga coordenadas locales;
- cómo una matriz de modelado coloca ese objeto dentro del mundo;
- cómo la cámara redefine el sistema de coordenadas mediante la matriz de vista;
- cómo la matriz de proyección transforma el volumen de visión;
- qué representa el espacio homogéneo de clipping;
- cómo funciona la división por `w`;
- qué significa NDC;
- qué geometría queda dentro o fuera del volumen visible;
- cómo finalmente las coordenadas se convierten en posiciones de pantalla;
- que las etapas del pipeline son transformaciones sucesivas sobre los mismos vértices.

La interacción principal debe reforzar esta idea:

> mover la cámara en la escena izquierda debe modificar inmediatamente la representación matemática y geométrica mostrada en el panel derecho.

---

# 3. Layout general

La aplicación ocupa toda la ventana del navegador.

Debe dividirse principalmente en **dos columnas verticales**.

```text
+---------------------------------------------------------------+
|                        HEADER / TABS                          |
+-------------------------------+-------------------------------+
|                               |                               |
|                               |                               |
|      PANEL IZQUIERDO          |       PANEL DERECHO           |
|                               |                               |
|      ESCENA 3D REAL           |     PIPELINE VISUALIZER       |
|                               |                               |
|                               |                               |
|                               |                               |
+-------------------------------+-------------------------------+
|                               | FOOTER DE COORDENADAS         |
|                               | DEL VÉRTICE                    |
+-------------------------------+-------------------------------+
```

Distribución sugerida:

- Panel izquierdo: aproximadamente 50%.
- Panel derecho: aproximadamente 50%.
- Header superior del panel derecho: tabs del pipeline.
- Footer inferior del panel derecho: información numérica del vértice observado.

La división exacta puede adaptarse según resolución, pero ambos paneles deben ser suficientemente grandes para comparar visualmente las representaciones.

---

# 4. Panel izquierdo — Escena 3D principal

El panel izquierdo representa una escena Three.js tradicional.

Debe funcionar como la **escena de referencia**.

## 4.1 Escena

Crear una pequeña escena low-poly, visualmente clara y fácilmente reconocible.

Debe evitarse una escena demasiado compleja.

Elementos sugeridos:

### Terreno

Un plano cuadrado grueso que represente una pequeña porción de terreno.

Por ejemplo:

- `BoxGeometry`
- dimensiones aproximadas: `12 x 0.4 x 12`
- color verde / pasto.

Puede incluir una grilla superpuesta o ligeramente elevada.

### Casa

Una pequeña casa low-poly compuesta por primitivas.

Por ejemplo:

- cuerpo: cubo;
- techo: prisma triangular o geometría simple;
- puerta;
- eventualmente una ventana.

Debe utilizar colores planos claramente distinguibles.

### Árbol

Composición simple:

- tronco: cilindro;
- copa: cono o esfera low-poly.

### Esfera

Una esfera de baja cantidad de segmentos.

### Tetera

Una tetera low-poly o equivalente.

Idealmente usar un modelo suficientemente conocido para explicar geometría y vértices.

La tetera puede utilizarse como objeto principal durante la etapa **Model Space**.

Si utilizar una Utah Teapot complica innecesariamente la implementación, se puede emplear inicialmente otro objeto reconocible con geometría suficientemente interesante.

---

# 5. Estilo visual

La escena debe ser:

- low-poly;
- limpia;
- didáctica;
- con colores planos;
- sin texturas complejas;
- sin iluminación físicamente realista;
- sin postprocesamiento.

Se recomienda:

- `MeshStandardMaterial` o `MeshLambertMaterial`;
- una luz ambiental suave;
- una luz direccional;
- fondo neutro;
- grilla claramente visible.

Los colores de los objetos deben mantenerse consistentes en todas las representaciones del pipeline.

Ejemplo:

- terreno: verde;
- casa: naranja / rojo;
- árbol: marrón + verde;
- esfera: azul;
- tetera: amarillo.

Esto permite identificar fácilmente qué geometría corresponde a cada objeto cuando aparece deformada en View Space, Clip Space o NDC.

---

# 6. Sistema de coordenadas del mundo

La escena izquierda debe mostrar:

- una `GridHelper`;
- un `AxesHelper` correspondiente al sistema de coordenadas global.

Los ejes deben seguir la convención visual habitual:

- X = rojo;
- Y = verde;
- Z = azul.

---

# 7. Cámara didáctica

Debe existir una cámara perspectiva que represente explícitamente la cámara utilizada por el pipeline.

Ejemplo:

```javascript
const teachingCamera = new THREE.PerspectiveCamera(
    45,
    aspect,
    0.5,
    12
);
```

Los valores concretos pueden modificarse.

La cámara debe apuntar inicialmente hacia el centro de la pequeña escena.

---

# 8. CameraHelper

La cámara debe estar acompañada por un:

```javascript
THREE.CameraHelper
```

El helper debe ser visualmente importante.

El estudiante debe poder identificar claramente:

- posición de la cámara;
- dirección;
- near plane;
- far plane;
- límites laterales del frustum;
- volumen visual completo.

El frustum debe estar dimensionado deliberadamente para que algunos objetos puedan quedar:

- completamente dentro;
- parcialmente atravesando un plano;
- o completamente fuera.

Esto es especialmente importante para demostrar clipping.

---

# 9. Navegación de la escena izquierda

Deben coexistir dos mecanismos de interacción.

## OrbitControls

Permiten mover la **cámara de observación del panel izquierdo**.

Esta cámara NO debe ser la cámara cuyo pipeline estamos estudiando.

Conceptualmente habrá:

### Observer Camera

La cámara con la que el usuario observa toda la escena desde afuera.

Se controla con:

```javascript
OrbitControls
```

### Teaching Camera

La cámara cuyo frustum y transformaciones queremos estudiar.

Se visualiza mediante `CameraHelper`.

---

# 10. TransformControls

La Teaching Camera debe poder seleccionarse y moverse mediante:

```javascript
TransformControls
```

Debe ser posible modificar:

- posición;
- rotación.

No es necesario permitir escala.

Cuando el usuario mueve o rota esta cámara:

- cambia la View Matrix;
- cambia el contenido del frustum;
- cambia la geometría visible;
- cambia el clipping;
- cambian las coordenadas del vértice observado;
- cambia inmediatamente todo el panel derecho.

Este comportamiento debe producirse **en tiempo real**.

---

# 11. Panel derecho — Pipeline Visualizer

El panel derecho representa distintas etapas del pipeline.

Debe tener una barra superior de navegación mediante tabs.

Tabs:

```text
MODEL
WORLD
VIEW
CLIP
NDC
SCREEN
```

Opcionalmente pueden mostrarse subtítulos:

```text
Model Space
World Space
Camera Space
Clip Space
Normalized Device Coordinates
Screen Space
```

Solo una etapa está activa simultáneamente.

---

# 12. Principio fundamental del panel derecho

La representación del panel derecho NO debe ser una simple captura de la escena izquierda.

Debe ser una reconstrucción geométrica de la escena utilizando las coordenadas correspondientes a la etapa seleccionada.

El programa debe calcular explícitamente las transformaciones del pipeline.

La arquitectura conceptual será:

```text
Original Geometry
      ↓
Model Matrix
      ↓
World Coordinates
      ↓
View Matrix
      ↓
Camera Coordinates
      ↓
Projection Matrix
      ↓
Clip Coordinates
      ↓
Clipping
      ↓
Perspective Divide
      ↓
NDC
      ↓
Viewport Transform
      ↓
Screen Coordinates
```

---

# 13. Matrices principales

Para cada vértice local:

```text
p_model = [x, y, z, 1]
```

## Model → World

```text
p_world = M_model × p_model
```

## World → View

```text
p_view = M_view × p_world
```

## View → Clip

```text
p_clip = M_projection × p_view
```

`p_clip` continúa siendo una coordenada homogénea:

```text
(xc, yc, zc, wc)
```

## Clip → NDC

Se realiza la división perspectiva:

```text
x_ndc = xc / wc
y_ndc = yc / wc
z_ndc = zc / wc
```

## NDC → Screen

Transformación del viewport.

Para un viewport de ancho `width` y alto `height`:

```text
x_screen = (x_ndc * 0.5 + 0.5) * width

y_screen = (1 - (y_ndc * 0.5 + 0.5)) * height
```

---

# 14. Tab MODEL

Objetivo:

mostrar claramente el concepto de **coordenadas locales**.

La vista debe centrarse inicialmente en un solo objeto, preferentemente la tetera.

Debe verse:

- geometría wireframe;
- sistema de coordenadas local;
- vértices;
- vértice de seguimiento destacado;
- origen del modelo.

La geometría debe aparecer antes de aplicar:

- posición;
- rotación;
- escala del objeto en la escena.

Es decir:

```text
Geometry.attributes.position
```

representada en el sistema local del mesh.

Podría mostrarse un pequeño texto:

```text
MODEL SPACE

Vertex coordinates are relative
to the object's local origin.
```

---

# 15. Tab WORLD

Aplicar la matriz:

```javascript
mesh.matrixWorld
```

a todos los vértices.

El panel debe reconstruir la escena completa en coordenadas de mundo.

Debe visualizarse:

- terreno;
- casa;
- árbol;
- esfera;
- tetera;
- sistema de coordenadas global;
- grilla.

Los objetos aparecen ahora ubicados respecto del mismo origen global.

El vértice seleccionado debe aparecer en su posición:

```text
p_world
```

---

# 16. Tab VIEW / CAMERA SPACE

Esta etapa es didácticamente muy importante.

Debe mostrarse la escena después de aplicar:

```text
ViewMatrix × WorldPosition
```

Matemáticamente:

```text
p_view = camera.matrixWorldInverse × p_world
```

En este espacio la cámara se encuentra conceptualmente en:

```text
position = (0, 0, 0)
rotation = identity
```

La escena completa se transforma en relación con ella.

El panel debe mostrar:

- origen de cámara;
- ejes de cámara;
- geometría transformada;
- frustum expresado en Camera Space.

Mover la Teaching Camera en la escena izquierda debe hacer que el mundo parezca desplazarse y rotar alrededor del origen en esta vista.

Este efecto es importante pedagógicamente.

---

# 17. Tab CLIP

Esta etapa requiere implementación explícita.

La geometría debe transformarse usando:

```text
p_clip = ProjectionMatrix × p_view
```

Todavía NO debe realizarse la división por `w`.

Cada vértice debe conservar:

```text
x
y
z
w
```

La representación visual debe ayudar a entender que estamos trabajando con coordenadas homogéneas.

---

# 18. Clipping

Three.js realiza clipping internamente durante el proceso de rasterización de WebGL, pero para esta demo necesitamos acceso a la geometría resultante.

Por eso, **no debe dependerse exclusivamente del clipping interno del renderer**.

Debe implementarse un clipping geométrico por software.

El objetivo es obtener explícitamente los triángulos resultantes luego de intersectar la geometría contra el volumen canónico de clipping.

---

# 19. Volumen de clipping

En OpenGL / WebGL el volumen homogéneo válido puede expresarse como:

```text
-w <= x <= w
-w <= y <= w
-w <= z <= w
```

Por lo tanto deben considerarse seis planos:

```text
x >= -w
x <=  w

y >= -w
y <=  w

z >= -w
z <=  w
```

Cada vértice todavía tiene cuatro componentes:

```text
(x, y, z, w)
```

---

# 20. Clipping de triángulos por software

La implementación recomendada es utilizar un algoritmo equivalente a:

**Sutherland–Hodgman polygon clipping**

adaptado a coordenadas homogéneas.

Cada triángulo original:

```text
v0
v1
v2
```

se procesa sucesivamente contra los seis planos del volumen de clipping.

Conceptualmente:

```javascript
polygon = [v0, v1, v2];

for (plane of clipPlanes) {
    polygon = clipPolygonAgainstPlane(polygon, plane);

    if (polygon.length === 0) {
        break;
    }
}
```

El resultado puede tener:

```text
0 vertices
3 vertices
4 vertices
5...
```

Si produce un polígono con más de tres vértices debe triangularse.

Ejemplo:

```text
v0 — v1
|    /
|   /
v3 — v2
```

puede convertirse en:

```text
triangle 1 = v0, v1, v2
triangle 2 = v0, v2, v3
```

---

# 21. Intersección con un plano de clipping

Al cruzar una arista entre:

```text
A
B
```

debe calcularse el punto de intersección.

El cálculo debe realizarse manteniendo las coordenadas homogéneas.

Para cada plano se define una función:

```text
f(v)
```

que determina si el punto está dentro o fuera.

Ejemplo para el plano derecho:

```text
x <= w
```

puede expresarse como:

```text
f(v) = w - x
```

El vértice está dentro cuando:

```text
f(v) >= 0
```

Si A y B están en lados diferentes del plano:

```text
t = f(A) / (f(A) - f(B))
```

y:

```text
intersection = A + t * (B - A)
```

Debe interpolarse:

```text
x
y
z
w
```

y cualquier atributo adicional que eventualmente interese visualizar.

Para esta demo probablemente alcanza con posiciones y color por objeto.

---

# 22. Por qué realizar clipping antes de dividir por W

Debe respetarse el pipeline real:

```text
View Space
    ↓
Projection
    ↓
Clip Space
    ↓
Clipping
    ↓
Perspective Divide
```

No conviene recortar los triángulos directamente en NDC después de dividir por `w`, ya que esto oculta parte del comportamiento matemático que se intenta enseñar.

La implementación debe mantener las coordenadas homogéneas hasta terminar el clipping.

---

# 23. Representación visual de Clip Space

Clip Space es un espacio 4D, por lo que no puede representarse literalmente como un volumen 3D sin tomar una decisión de visualización.

Para la demo se propone utilizar una representación pedagógica derivada:

- mostrar el volumen canónico que surgirá después de la división por `w`;
- representar los triángulos proyectados;
- permitir distinguir cuáles sobreviven al clipping;
- opcionalmente mostrar en otro estilo las porciones descartadas.

Debe quedar claro en la UI que:

```text
Clip coordinates todavía contienen W.
```

Un pequeño panel numérico puede mostrar:

```text
Clip coordinate:
(xc, yc, zc, wc)
```

---

# 24. Tab NDC

Después del clipping realizar:

```text
x /= w
y /= w
z /= w
```

La geometría pasa al espacio:

```text
[-1, 1]
```

Debe mostrarse dentro de un cubo canónico:

```text
x = [-1, 1]
y = [-1, 1]
z = [-1, 1]
```

Este cubo debe estar claramente dibujado.

Puede utilizarse:

- líneas;
- wireframe;
- ejes;
- marcas `-1`, `0`, `1`.

Dentro de este cubo aparecerá la geometría ya deformada por la proyección perspectiva.

Este es probablemente uno de los momentos visualmente más interesantes de la demo.

---

# 25. Conservación de Z

En NDC NO debe eliminarse la profundidad.

La representación debe conservar:

```text
x_ndc
y_ndc
z_ndc
```

Debe poder rotarse la visualización del panel derecho para entender cómo los triángulos ocupan el cubo tridimensional.

Esto permite explicar que la proyección perspectiva no convierte inmediatamente la escena en una imagen 2D.

La coordenada Z todavía existe y posteriormente se utiliza para:

- depth testing;
- z-buffer;
- visibilidad.

---

# 26. Tab SCREEN

Esta etapa representa el resultado final.

Debe mostrar una superficie 2D equivalente al viewport de la cámara.

La transformación conceptual:

```text
NDC → Viewport coordinates
```

produce:

```text
pixels
```

La vista puede ser representada mediante:

- un canvas 2D adicional;
- un renderer Three.js ortográfico;
- o geometría dibujada en un plano.

La opción más clara puede ser utilizar un canvas 2D.

---

# 27. Rasterización

Idealmente el tab SCREEN puede disponer de dos modos.

### Modo normal

Representación visual renderizada de la Teaching Camera.

### Modo didáctico

Representar claramente:

- triángulos;
- bordes;
- centros de píxel;
- eventualmente fragmentos.

No es obligatorio implementar un rasterizador completo por software en la primera versión.

Puede utilizarse WebGLRenderer para generar el resultado final y superponer información pedagógica.

---

# 28. Vértice de seguimiento

Debe existir desde la primera versión un **vértice preseleccionado**.

No es necesario implementar inicialmente selección interactiva.

El vértice puede pertenecer a la tetera.

Debe identificarse de manera estable mediante:

```text
mesh + vertexIndex
```

Por ejemplo:

```javascript
trackedVertex = {
    mesh: teapot,
    index: 42
};
```

El índice debe corresponder a un vértice visualmente reconocible.

---

# 29. Visualización del vértice

El vértice debe visualizarse mediante un marcador claramente visible.

Por ejemplo:

- círculo rojo;
- esfera pequeña roja;
- halo;
- `Sprite`;
- `Points`.

Debe mantenerse conceptualmente el mismo vértice durante todas las etapas.

---

# 30. Footer de coordenadas

En la parte inferior del panel derecho debe existir una sección fija.

Ejemplo:

```text
TRACKED VERTEX #42

MODEL
x: 0.430
y: 1.250
z: -0.180
w: 1.000
```

Al cambiar de tab debe mostrar el espacio correspondiente.

---

# 31. Información por etapa

## MODEL

```text
(x, y, z)
```

## WORLD

```text
(xw, yw, zw)
```

## VIEW

```text
(xv, yv, zv)
```

## CLIP

```text
(xc, yc, zc, wc)
```

## NDC

```text
(xc/wc, yc/wc, zc/wc)
```

## SCREEN

```text
(pixelX, pixelY, depth)
```

---

# 32. Visualización opcional de la ecuación

Sería recomendable agregar una línea que muestre la operación activa.

Ejemplo en WORLD:

```text
p_world = ModelMatrix × p_model
```

En VIEW:

```text
p_view = ViewMatrix × p_world
```

En CLIP:

```text
p_clip = ProjectionMatrix × p_view
```

En NDC:

```text
p_ndc = p_clip / w
```

En SCREEN:

```text
p_screen = ViewportTransform × p_ndc
```

No es necesario visualizar inicialmente matrices 4×4 completas.

Puede incorporarse posteriormente como modo avanzado.

---

# 33. Actualización dinámica

El sistema debe recalcularse cuando cambie:

- posición de Teaching Camera;
- rotación de Teaching Camera;
- FOV;
- aspect ratio;
- near plane;
- far plane;
- transformaciones de objetos;
- tamaño del viewport.

Pipeline de actualización sugerido:

```javascript
function updatePipeline() {

    updateMatrices();

    extractSceneTriangles();

    transformToWorld();

    transformToView();

    transformToClip();

    clipTriangles();

    perspectiveDivide();

    transformToScreen();

    updatePipelineVisualization();

    updateTrackedVertex();
}
```

No es obligatorio regenerar toda la geometría en cada frame.

Se recomienda detectar cambios y recalcular solamente cuando sea necesario.

---

# 34. Extracción de geometría

Cada mesh visible debe poder convertirse en una colección de triángulos.

Estructura sugerida:

```javascript
{
    objectId,
    materialColor,
    triangles: [
        {
            a: Vector4,
            b: Vector4,
            c: Vector4
        }
    ]
}
```

Debe soportar geometrías:

- indexadas;
- no indexadas.

Para geometría indexada utilizar:

```javascript
geometry.index
```

Para posiciones:

```javascript
geometry.attributes.position
```

---

# 35. Coordenadas homogéneas

Para evitar errores conceptuales se recomienda trabajar internamente con:

```javascript
THREE.Vector4
```

desde el momento en que los vértices ingresan al pipeline educativo.

Ejemplo:

```javascript
const p = new THREE.Vector4(x, y, z, 1);
```

Aplicación de matrices:

```javascript
p.applyMatrix4(matrix);
```

La división por `w` debe realizarse únicamente después del clipping.

---

# 36. Frustum y clipping dinámicos

El usuario puede mover la Teaching Camera libremente.

Esto significa que la geometría intersectada por el frustum cambia en tiempo real.

El sistema debe poder manejar correctamente:

- triángulo completamente visible;
- triángulo completamente invisible;
- triángulo atravesando near plane;
- triángulo atravesando far plane;
- triángulo atravesando planos laterales;
- triángulo atravesando múltiples planos.

El clipping NO debe depender de una posición hardcodeada del frustum.

Debe derivarse siempre de:

```text
ViewMatrix
ProjectionMatrix
```

actuales.

---

# 37. Caso didáctico especialmente importante: Near Plane

La escena debería estar configurada para que resulte fácil mover la cámara hasta atravesar un objeto con el near plane.

Esto permitirá observar cómo un triángulo puede:

```text
antes:
          /\
         /  \
        /____\

después del clipping:

        _____
       /     \
      /_______\
```

es decir, un triángulo original puede generar nuevos vértices.

Este fenómeno es importante para mostrar que clipping no significa simplemente:

> eliminar vértices que están afuera.

El algoritmo debe generar correctamente las intersecciones.

---

# 38. Panel derecho como escena independiente

Se recomienda utilizar un segundo:

```javascript
THREE.Scene
THREE.Camera
THREE.WebGLRenderer
```

o alternativamente dos canvas independientes.

Arquitectura sugerida:

```text
App
│
├── ReferenceScene
│   ├── scene
│   ├── observerCamera
│   ├── teachingCamera
│   ├── OrbitControls
│   └── TransformControls
│
├── PipelineEngine
│   ├── extractGeometry()
│   ├── modelTransform()
│   ├── viewTransform()
│   ├── projectionTransform()
│   ├── clip()
│   ├── perspectiveDivide()
│   └── viewportTransform()
│
├── PipelineVisualizer
│   ├── ModelView
│   ├── WorldView
│   ├── ViewSpaceView
│   ├── ClipSpaceView
│   ├── NDCView
│   └── ScreenView
│
└── UI
    ├── Tabs
    ├── VertexInspector
    └── CameraControls
```

---

# 39. Cámara del panel derecho

Las etapas MODEL, WORLD, VIEW, CLIP y NDC necesitan poder observarse desde afuera.

Por eso el panel derecho debe utilizar una cámara de visualización independiente.

Puede disponer de:

```javascript
OrbitControls
```

para que el usuario rote estas representaciones.

Esta cámara es puramente didáctica y NO forma parte del pipeline analizado.

Debe evitarse cualquier confusión visual entre:

- Observer Camera izquierda;
- Teaching Camera;
- Pipeline Viewer Camera derecha.

---

# 40. Nomenclatura sugerida en código

Para evitar confusión:

```javascript
observerCamera
teachingCamera
pipelineCamera

referenceScene
pipelineScene

modelMatrix
viewMatrix
projectionMatrix

trackedVertex
```

No utilizar simplemente nombres ambiguos como:

```text
camera1
camera2
scene2
```

---

# 41. Controles de cámara adicionales

Además de TransformControls, sería útil disponer de pequeños sliders:

```text
FOV
Near
Far
```

Ejemplo:

```text
FOV  [----|------] 45°

NEAR [--|--------] 0.5

FAR  [-------|---] 12
```

Al modificarlos debe cambiar:

- CameraHelper;
- Projection Matrix;
- Clip Space;
- clipping;
- NDC;
- resultado final.

Esto puede ser extremadamente útil durante la explicación docente.

---

# 42. Indicador de etapa

El panel derecho debe mostrar claramente el nombre de la etapa activa.

Ejemplo:

```text
03 — VIEW SPACE
```

o:

```text
WORLD SPACE
```

No depender solamente del tab seleccionado.

---

# 43. Explicación contextual

Puede mostrarse una explicación breve de máximo 2 o 3 líneas.

Ejemplo:

### MODEL

> Coordinates are relative to the object's local origin.

### WORLD

> The Model Matrix places every object inside a common coordinate system.

### VIEW

> The View Matrix transforms the world so the camera becomes the origin.

### CLIP

> The Projection Matrix creates homogeneous clip coordinates `(x, y, z, w)`.

### NDC

> Dividing by `w` maps visible geometry to the canonical cube.

### SCREEN

> Viewport transformation converts NDC coordinates into pixels.

El idioma final de UI puede ser español.

---

# 44. Wireframe

En las etapas geométricas debe favorecerse wireframe.

Especialmente:

- MODEL;
- VIEW;
- CLIP;
- NDC.

Puede combinarse:

```text
superficie translúcida
+
wireframe
```

para visualizar claramente triángulos.

---

# 45. Triángulos

Es importante que la topología sea visible.

Puede crearse un `LineSegments` con los bordes de cada triángulo.

No utilizar solamente:

```javascript
WireframeGeometry
```

si éste elimina o modifica aristas que resulten importantes pedagógicamente.

Si fuera necesario, generar explícitamente:

```text
a → b
b → c
c → a
```

para cada triángulo.

---

# 46. Colores y continuidad visual

El mismo objeto debe mantener el mismo color en todas las etapas.

Esto permite seguir visualmente:

```text
Casa naranja
→ World
→ View
→ Clip
→ NDC
→ Screen
```

El vértice de seguimiento siempre debe ser rojo.

Los sistemas de coordenadas deben conservar:

```text
X rojo
Y verde
Z azul
```

---

# 47. Estado inicial recomendado

Al iniciar la aplicación:

- cámara observadora en perspectiva elevada;
- escena vista en 3/4;
- Teaching Camera visible desde afuera;
- CameraHelper visible;
- todos los objetos dentro o parcialmente dentro del frustum;
- tab inicial: `WORLD` o `MODEL`.

Para una explicación docente puede resultar útil comenzar en:

```text
MODEL
```

y avanzar secuencialmente.

---

# 48. Orden pedagógico sugerido

El profesor debería poder recorrer:

```text
MODEL
   ↓
WORLD
   ↓
VIEW
   ↓
CLIP
   ↓
NDC
   ↓
SCREEN
```

La interfaz debe favorecer esta lectura izquierda → derecha.

Opcional:

botones:

```text
← Previous
Next →
```

además de tabs.

---

# 49. Feature futuro — Selección interactiva de vértices

NO forma parte obligatoria de la primera versión.

En una segunda etapa se podrá incorporar una herramienta:

```text
Cursor / Select Vertex
```

representada mediante un icono de cursor.

Cuando está activa:

1. el usuario hace click sobre un objeto;
2. se realiza raycasting;
3. se determina el triángulo intersectado;
4. se elige el vértice más cercano al punto de intersección;
5. ese vértice pasa a ser `trackedVertex`.

El mismo vértice se resalta automáticamente en todas las etapas.

---

# 50. Feature futuro — Mostrar matrices

Modo avanzado:

```text
Show Matrices
```

Podría desplegar:

### Model Matrix

```text
| ... |
| ... |
| ... |
| ... |
```

### View Matrix

### Projection Matrix

Y eventualmente:

```text
MVP = Projection × View × Model
```

---

# 51. Feature futuro — Mostrar pipeline completo simultáneamente

Otra posible extensión:

en lugar de un único panel derecho con tabs, disponer un modo:

```text
PIPELINE OVERVIEW
```

que muestre miniaturas:

```text
MODEL → WORLD → VIEW → CLIP → NDC → SCREEN
```

Esto no es prioritario para la primera versión.

---

# 52. Feature futuro — Animación paso a paso

Puede existir un botón:

```text
PLAY PIPELINE
```

que anime el vértice observado atravesando conceptualmente cada espacio.

La transición puede mostrar:

```text
Model
→ World
→ View
→ Clip
→ NDC
→ Screen
```

No es necesario interpolar matemáticamente entre espacios; puede utilizarse como recurso visual.

---

# 53. Feature futuro — Visualización del W

Puede incorporarse una visualización dedicada a:

```text
w
```

por ejemplo:

- color;
- tamaño del punto;
- gráfico;
- valor numérico.

Esto ayudaría a explicar la división perspectiva.

---

# 54. Consideraciones de rendimiento

La escena debe mantenerse deliberadamente low-poly.

Objetivo aproximado:

```text
< 5.000 triángulos
```

Idealmente mucho menos:

```text
500–2.000 triángulos
```

Esto permitirá recalcular el pipeline por JavaScript sin problemas.

No se necesita optimización GPU sofisticada.

La prioridad es:

```text
claridad > rendimiento extremo
```

---

# 55. Recalcular solamente cuando sea necesario

Puede existir una bandera:

```javascript
pipelineDirty = true;
```

Activada cuando:

- cambia Teaching Camera;
- cambia objeto;
- cambia FOV;
- cambia near;
- cambia far;
- cambia tamaño de ventana.

Luego:

```javascript
if (pipelineDirty) {
    rebuildPipeline();
    pipelineDirty = false;
}
```

El render visual puede continuar a 60 FPS sin recalcular necesariamente toda la geometría cada frame.

---

# 56. Precisión

Para valores mostrados en UI:

```text
3 decimales
```

es suficiente.

Ejemplo:

```text
X:  0.426
Y:  1.237
Z: -0.182
W:  2.731
```

Internamente deben mantenerse los valores completos de coma flotante.

---

# 57. Arquitectura de datos sugerida

Una estructura posible:

```javascript
class PipelineVertex {

    constructor(modelPosition) {

        this.model = new THREE.Vector4();
        this.world = new THREE.Vector4();
        this.view  = new THREE.Vector4();
        this.clip  = new THREE.Vector4();

        this.ndc = new THREE.Vector3();
        this.screen = new THREE.Vector3();

    }

}
```

Para los triángulos:

```javascript
class PipelineTriangle {

    constructor(a, b, c, sourceObject) {

        this.vertices = [a, b, c];

        this.sourceObject = sourceObject;

        this.color = sourceObject.material.color.clone();

    }

}
```

El clipping puede generar nuevos vértices que no existían originalmente.

Por lo tanto conviene diferenciar:

```text
source vertices
```

de:

```text
generated clip vertices
```

---

# 58. Importante: vértices generados por clipping

Un vértice creado por clipping no corresponde a un índice original de la geometría.

Debe marcarse:

```javascript
{
    generatedByClipping: true
}
```

Esto puede ser útil posteriormente para resaltarlos.

Incluso podría existir un modo didáctico donde:

- vértices originales = blancos;
- vértices creados por clipping = magenta.

Esto haría extremadamente evidente qué hace el algoritmo.

---

# 59. Profundidad y Z-buffer

En SCREEN puede mostrarse opcionalmente:

```text
Depth: 0.653
```

del vértice observado.

No es necesario implementar un Z-buffer por software en la primera versión.

Three.js/WebGL puede resolver la visibilidad final.

Sin embargo la demo debería explicar que:

```text
Z no desaparece después de la proyección.
```

Se utiliza para decidir qué fragmento está delante.

---

# 60. Renderer y configuración técnica

Tecnología principal:

```text
JavaScript
Three.js
WebGLRenderer
```

No es necesario utilizar React.

Para fines educativos y simplicidad puede desarrollarse como aplicación JavaScript modular.

Estructura sugerida:

```text
/src

    main.js

    scene/
        createReferenceScene.js
        createTeachingCamera.js

    pipeline/
        PipelineEngine.js
        GeometryExtractor.js
        HomogeneousClipper.js
        ViewportTransform.js

    visualization/
        ModelVisualizer.js
        WorldVisualizer.js
        ViewVisualizer.js
        ClipVisualizer.js
        NDCVisualizer.js
        ScreenVisualizer.js

    ui/
        PipelineTabs.js
        VertexInspector.js
        CameraParameters.js

    styles/
        main.css
```

---

# 61. Clase central sugerida

```javascript
class PipelineEngine {

    constructor(teachingCamera) {
        this.camera = teachingCamera;
    }

    processScene(objects, viewport) {

        const worldGeometry = this.toWorld(objects);

        const viewGeometry =
            this.toView(worldGeometry);

        const clipGeometry =
            this.toClip(viewGeometry);

        const clippedGeometry =
            this.clipGeometry(clipGeometry);

        const ndcGeometry =
            this.toNDC(clippedGeometry);

        const screenGeometry =
            this.toScreen(ndcGeometry, viewport);

        return {
            worldGeometry,
            viewGeometry,
            clipGeometry,
            clippedGeometry,
            ndcGeometry,
            screenGeometry
        };
    }
}
```

---

# 62. Importante — No modificar la geometría original

El pipeline educativo debe trabajar sobre copias de los vértices.

No modificar:

```javascript
geometry.attributes.position
```

directamente.

La escena izquierda debe permanecer como escena Three.js convencional.

El PipelineEngine funciona como una representación paralela.

---

# 63. Validación matemática

Debe verificarse que la transformación manual coincida con Three.js.

Por ejemplo, para un vértice:

```javascript
manualWorld
```

debe coincidir con:

```javascript
local.clone().applyMatrix4(mesh.matrixWorld)
```

View:

```javascript
world.clone()
     .applyMatrix4(teachingCamera.matrixWorldInverse)
```

Clip:

```javascript
view.clone()
    .applyMatrix4(teachingCamera.projectionMatrix)
```

NDC puede compararse con:

```javascript
Vector3.project(teachingCamera)
```

teniendo en cuenta que `project()` realiza internamente las etapas posteriores.

Esto puede utilizarse para tests.

---

# 64. Tests recomendados

Crear tests o escenas de comprobación para:

### Caso 1

Triángulo completamente dentro del frustum.

Resultado:

```text
1 triángulo
```

### Caso 2

Triángulo completamente fuera.

Resultado:

```text
0 triángulos
```

### Caso 3

Un vértice fuera.

Resultado típico:

```text
2 triángulos
```

después del recorte.

### Caso 4

Dos vértices fuera.

Resultado:

```text
1 triángulo reducido
```

### Caso 5

Triángulo atravesando near plane.

### Caso 6

Triángulo atravesando dos planos simultáneamente.

---

# 65. Prioridades de implementación

## Fase 1 — Base visual

- layout dos columnas;
- escena low-poly;
- Observer Camera;
- Teaching Camera;
- CameraHelper;
- OrbitControls;
- TransformControls;
- tabs UI.

## Fase 2 — Transformaciones

Implementar:

- Model;
- World;
- View.

## Fase 3 — Proyección

Implementar:

- Clip coordinates;
- perspectiva;
- NDC.

## Fase 4 — Clipping

Implementar:

- clipping homogéneo;
- reconstrucción de triángulos.

## Fase 5 — Screen

Implementar:

- viewport transform;
- representación final.

## Fase 6 — Vertex Inspector

Implementar:

- vértice hardcodeado;
- marcador rojo;
- coordenadas por etapa.

## Fase 7 — Pulido didáctico

- labels;
- textos;
- colores;
- transiciones;
- sliders FOV / near / far.

---

# 66. Criterio de éxito

La demo funciona correctamente cuando un usuario puede:

1. observar la escena completa desde afuera;
2. identificar claramente la Teaching Camera;
3. ver su frustum;
4. mover esa cámara;
5. seleccionar una etapa del pipeline;
6. observar inmediatamente cómo cambia la geometría del panel derecho;
7. seguir un mismo vértice desde Model Space hasta Screen Space;
8. ver sus coordenadas numéricas;
9. observar triángulos parcialmente cortados por el frustum;
10. comprender visualmente que cada etapa es una transformación matemática de la anterior.

---

# 67. Idea conceptual central

Toda la aplicación debe transmitir una única idea:

> **La escena no cambia. Lo que cambia es el sistema de coordenadas en el que estamos describiendo sus vértices.**

Y posteriormente:

> **La proyección y el clipping transforman ese conjunto de vértices hasta producir la imagen que finalmente aparece en pantalla.**

El usuario debe poder mover la cámara y observar este proceso completo en tiempo real.

---

# 68. Resumen visual del pipeline

```text
                 OBJECT

                   │
                   │ local coordinates
                   ▼

            ┌─────────────┐
            │ MODEL SPACE │
            └─────────────┘

                   │
                   │ Model Matrix
                   ▼

            ┌─────────────┐
            │ WORLD SPACE │
            └─────────────┘

                   │
                   │ View Matrix
                   ▼

            ┌─────────────┐
            │ VIEW SPACE  │
            └─────────────┘

                   │
                   │ Projection Matrix
                   ▼

            ┌─────────────┐
            │ CLIP SPACE  │
            │  x y z w    │
            └─────────────┘

                   │
                   │ Clipping
                   ▼

          ┌─────────────────┐
          │ CLIPPED GEOMETRY│
          └─────────────────┘

                   │
                   │ Divide by W
                   ▼

            ┌─────────────┐
            │  NDC SPACE  │
            │ [-1, 1]^3   │
            └─────────────┘

                   │
                   │ Viewport Transform
                   ▼

            ┌─────────────┐
            │SCREEN SPACE │
            │   pixels    │
            └─────────────┘
```

---

# 69. Nombre provisional

Opciones:

```text
Graphics Pipeline Explorer
```

```text
3D Transformation Pipeline
```

```text
From Vertex to Pixel
```

```text
Vertex Pipeline Visualizer
```

Para el curso podría utilizarse simplemente:

# From Vertex to Pixel

### Interactive Graphics Pipeline Visualizer

---

# 70. Alcance de la primera versión

La primera versión NO necesita:

- selección arbitraria de vértices;
- rasterizador completo por software;
- shaders personalizados complejos;
- cálculo manual del Z-buffer;
- texturas;
- sombras avanzadas;
- postprocesamiento;
- WebXR;
- física;
- animaciones complejas.

El foco debe mantenerse estrictamente en:

```text
MODEL
WORLD
VIEW
CLIP
NDC
SCREEN
```

y en hacer visibles y manipulables las transformaciones que conectan esos espacios.
