# Especificación funcional — Laboratorio interactivo de texturas

## Alcance de esta versión

Esta especificación comprende únicamente las dos primeras secciones del laboratorio:

1. **Dimensiones y tipos de textura**
2. **Coordenadas UV: del triángulo a la malla**

La textura 1D queda excluida del proyecto. No debe aparecer en el menú, en las explicaciones ni como demostración secundaria.

La aplicación debe desarrollarse como una experiencia web interactiva con Three.js y una interfaz HTML/CSS superpuesta o integrada alrededor del canvas.

---

# 1. Objetivo general

El laboratorio debe permitir comprender visualmente:

- qué representa una textura 2D, una textura 3D y un cubemap;
- cómo una superficie 3D se relaciona con su espacio de textura;
- que cada vértice posee una posición 3D y, de manera independiente, coordenadas UV;
- cómo se interpola una coordenada UV dentro de un triángulo;
- cómo una modificación en el espacio UV cambia el aspecto del objeto sin modificar su geometría;
- cómo una modificación de la geometría no cambia necesariamente sus coordenadas UV.

La experiencia debe privilegiar la manipulación directa y la correspondencia visual entre ambos espacios. Las explicaciones textuales deben ser breves y funcionar como apoyo, no como contenido principal.

---

# 2. Estructura general de la aplicación

## 2.1. Pantalla inicial

La pantalla inicial debe mostrar solamente las dos secciones disponibles:

- **1. Dimensiones y tipos de textura**
- **2. Coordenadas UV**

Cada sección se representa mediante una tarjeta con:

- número;
- título;
- imagen o miniatura esquemática;
- descripción de una línea;
- botón o zona clickeable para ingresar.

No deben mostrarse tarjetas deshabilitadas correspondientes a capítulos futuros.

## 2.2. Barra superior común

Al ingresar en una sección se muestra una barra superior compacta con:

- botón **Inicio**;
- número y título de la sección;
- tabs propios de la sección;
- botón **Restablecer**;
- botón opcional **Ayuda**;
- botón opcional **Pantalla completa**.

La barra no debe ocupar más espacio vertical del necesario.

## 2.3. Regla de distribución espacial

Todas las demostraciones deben respetar el mismo orden de columnas:

1. **Columna izquierda: escena 3D**
2. **Columna central: espacio de textura UV o UVW**
3. **Columna derecha: controles**

Nunca debe invertirse el orden de las dos visualizaciones principales.

La escena 3D debe estar siempre a la izquierda y el espacio UV siempre a su derecha.

## 2.4. Proporciones de las columnas

Las dos primeras columnas deben aprovechar la mayor parte del ancho disponible.

Distribución recomendada en escritorio:

- escena 3D: **42 %**;
- espacio UV/UVW: **42 %**;
- controles: **16 %**.

Alternativamente puede utilizarse CSS Grid:

```css
grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(210px, 0.38fr);
```

Condiciones:

- las columnas de visualización deben tener el mismo ancho;
- el panel de controles debe ser angosto pero legible;
- el panel de controles puede desplazarse verticalmente si su contenido excede la altura;
- las dos visualizaciones no deben reducirse para evitar el scroll de los controles;
- los títulos y leyendas deben ocupar poco espacio;
- no debe existir una cuarta columna permanente.

## 2.5. Adaptación a pantallas angostas

En pantallas donde tres columnas no resulten legibles:

1. escena 3D;
2. espacio UV/UVW;
3. controles.

Los tres bloques deben apilarse en ese orden. En tablet horizontal puede conservarse la escena 3D y el espacio UV en dos columnas, colocando los controles debajo.

---

# 3. Convenciones visuales compartidas

## 3.1. Correspondencia entre espacios

Los mismos elementos deben conservar idéntico color en la escena 3D y en el espacio UV:

- vértice A: rojo;
- vértice B: verde;
- vértice C: azul;
- punto de muestreo o fragmento: amarillo;
- líneas auxiliares: gris claro o blanco semitransparente.

El color no debe ser el único identificador. Cada punto debe incluir también su letra o nombre.

## 3.2. Cámaras y navegación

La escena 3D debe usar `OrbitControls` con:

- rotación;
- zoom limitado;
- paneo opcional y limitado;
- botón para restablecer la cámara.

El espacio UV debe utilizar una cámara ortográfica 2D o una visualización HTML/SVG/canvas equivalente. No debe adoptar perspectiva.

## 3.3. Cuadrículas y ejes

La escena 3D puede mostrar:

- grilla de referencia opcional;
- ejes X, Y y Z opcionales;
- wireframe opcional.

El espacio UV debe mostrar:

- eje U horizontal;
- eje V vertical;
- marcas principales en 0 y 1;
- cuadrado `[0,1] × [0,1]` destacado;
- posibilidad de mostrar un dominio extendido cuando sea necesario.

## 3.4. Ayuda contextual

Cada tab debe incluir una frase fija titulada **Idea principal**. Debe ubicarse en el panel de controles o en una franja inferior compacta, sin superponerse a las visualizaciones.

---

# 4. Sección 1 — Dimensiones y tipos de textura

## 4.1. Objetivo didáctico

Mostrar que una textura es un conjunto organizado de datos y que la cantidad de coordenadas necesarias para consultarla depende de su dimensionalidad.

La sección debe incluir tres tabs:

1. **Textura 2D**
2. **Textura 3D**
3. **Cubemap**

Aunque el panel central se denomine de manera general **Espacio de textura**, debe mantener la posición reservada al espacio UV:

- textura 2D: espacio UV;
- textura 3D: espacio UVW;
- cubemap: despliegue de las seis caras y dirección de consulta.

## 4.2. Tab “Textura 2D”

### Columna izquierda — Escena 3D

Mostrar un objeto 3D texturado. Se recomienda utilizar una tetera, una esfera UV o ambas mediante un selector.

La escena debe permitir:

- orbitar alrededor del objeto;
- acercar y alejar la cámara;
- señalar un punto de la superficie;
- mostrar un marcador sobre la superficie seleccionada;
- visualizar el wireframe opcionalmente;
- alternar entre material iluminado y material sin iluminación.

Cuando el usuario mueve el puntero sobre la superficie o hace clic:

- se obtiene la intersección mediante raycasting;
- se recuperan sus coordenadas UV interpoladas;
- el punto equivalente se resalta en el espacio UV de la columna central;
- se muestran los valores numéricos `u` y `v`.

### Columna central — Espacio UV

Mostrar la textura completa dentro del cuadrado `[0,1] × [0,1]`.

Debe incluir:

- imagen de textura;
- ejes U y V;
- cuadrícula opcional;
- cursor que marque la coordenada correspondiente al punto señalado sobre el objeto;
- indicador numérico `(u,v)`;
- opción de mostrar los texels individuales cuando el zoom sea suficiente.

El usuario también debe poder mover un cursor dentro de la textura. Al hacerlo, la escena 3D debe resaltar una o más zonas de la superficie que utilicen esa región UV.

Para que esta correspondencia sea clara, se deben ofrecer al menos tres texturas:

- cuadrícula UV numerada;
- patrón checkerboard;
- imagen reconocible con orientación clara.

### Columna derecha — Controles

- selector de geometría: tetera / esfera;
- selector de textura;
- checkbox **Mostrar wireframe**;
- checkbox **Mostrar ejes UV**;
- checkbox **Mostrar valores UV**;
- checkbox **Material iluminado**;
- botón **Restablecer punto**;
- bloque **Idea principal**.

Texto sugerido para **Idea principal**:

> Una textura 2D se consulta mediante dos coordenadas, U y V. La superficie 3D y la imagen son espacios diferentes relacionados por los atributos UV de la geometría.

## 4.3. Tab “Textura 3D”

### Columna izquierda — Escena 3D

Mostrar una malla embebida en un volumen cúbico semitransparente. La malla puede ser una esfera deformada, una tetera simplificada o una superficie orgánica.

La escena debe mostrar:

- cubo que representa el dominio de la textura 3D;
- objeto contenido dentro del cubo;
- plano de corte opcional;
- color de la superficie obtenido desde la textura volumétrica;
- ejes o indicadores U, V y W.

El usuario debe poder:

- rotar la cámara;
- mover el plano de corte;
- mover, rotar y escalar la malla dentro del volumen;
- señalar un punto de la superficie;
- ver su coordenada `(u,v,w)`.

Al transformar la malla dentro del volumen, debe cambiar el patrón visible sobre su superficie. La textura permanece fija en el espacio UVW.

### Columna central — Espacio UVW

Representar el volumen de textura mediante una visualización 3D independiente, pero ubicada siempre en la columna central reservada al espacio de textura.

Debe mostrar:

- cubo UVW;
- cortes internos de la textura;
- posición del punto consultado;
- plano de corte sincronizado con la escena 3D;
- valores U, V y W;
- opción de visualizar voxels o una grilla volumétrica simplificada.

Se recomienda que el plano de corte pueda verse de frente dentro de esta columna para inspeccionar con claridad el contenido 2D de una capa del volumen.

### Columna derecha — Controles

- selector de volumen: bandas / ruido / celdas / volumen sintético;
- slider **Corte W**;
- selector de transformación activa: mover / rotar / escalar objeto;
- checkbox **Mostrar cubo UVW**;
- checkbox **Mostrar plano de corte**;
- checkbox **Mostrar punto de consulta**;
- checkbox **Mostrar voxels**;
- botón **Centrar objeto**;
- bloque **Idea principal**.

Texto sugerido:

> Una textura 3D contiene datos en un volumen. Cada punto de la superficie consulta el volumen usando tres coordenadas: U, V y W.

## 4.4. Tab “Cubemap”

### Columna izquierda — Escena 3D

Mostrar un objeto reflectante dentro de un entorno y, opcionalmente, una cámara en el centro de un cubo transparente.

La escena debe permitir:

- orbitar la cámara;
- alternar entre esfera, objeto rugoso y objeto cromado;
- seleccionar un punto del objeto;
- visualizar el vector de reflexión o la dirección usada para consultar el cubemap;
- ocultar o mostrar el cubo que representa el entorno.

### Columna central — Espacio de textura del cubemap

Mostrar las seis caras desplegadas en forma de cruz:

- +X;
- -X;
- +Y;
- -Y;
- +Z;
- -Z.

La dirección calculada en la escena 3D debe señalar:

- qué cara se consulta;
- qué posición dentro de esa cara corresponde a la muestra;
- el color devuelto.

Cuando el usuario orbita la cámara o selecciona otro punto del objeto, el marcador debe actualizarse en tiempo real.

### Columna derecha — Controles

- selector de objeto;
- selector de entorno;
- slider **Roughness**;
- slider **Metalness**;
- checkbox **Mostrar dirección de consulta**;
- checkbox **Mostrar cubo de entorno**;
- checkbox **Mostrar nombre de las caras**;
- bloque **Idea principal**.

Texto sugerido:

> Un cubemap se consulta con una dirección 3D. Esa dirección determina cuál de las seis caras se utiliza y en qué punto se obtiene el color.

## 4.5. Criterios de aceptación de la sección 1

- No existe ningún tab o referencia a texturas 1D.
- En los tres tabs la escena 3D permanece a la izquierda.
- El espacio de textura permanece en la columna central.
- Los controles permanecen en la columna derecha.
- Las selecciones realizadas en la escena se reflejan inmediatamente en el espacio de textura.
- Las selecciones realizadas en el espacio UV 2D se reflejan en la escena cuando la correspondencia es técnicamente posible.
- Textura 2D utiliza coordenadas UV.
- Textura 3D utiliza coordenadas UVW.
- Cubemap utiliza una dirección 3D y muestra la cara seleccionada.
- Cada tab posee una conclusión didáctica visible y breve.

---

# 5. Sección 2 — Coordenadas UV: del triángulo a la malla

## 5.1. Objetivo didáctico

Mostrar que:

- la posición de un vértice y su coordenada UV son atributos independientes;
- los UV de los vértices determinan qué parte de la textura se aplica sobre un triángulo;
- dentro del triángulo, las coordenadas UV se interpolan;
- una malla completa se representa en UV mediante múltiples triángulos e islas;
- las costuras y deformaciones son consecuencias de la estrategia de desplegado.

La sección debe incluir tres tabs:

1. **Un triángulo**
2. **Interpolación UV**
3. **Malla completa**

## 5.2. Tab “Un triángulo”

### Columna izquierda — Escena 3D

Mostrar un único triángulo con vértices A, B y C.

Cada vértice debe incluir:

- marcador de color;
- etiqueta A, B o C;
- posición 3D opcional;
- líneas del triángulo claramente visibles.

El usuario debe poder mover los vértices del triángulo en el espacio 3D mediante gizmos o arrastre restringido.

Al mover un vértice 3D:

- cambia la forma del triángulo;
- no cambian automáticamente sus coordenadas UV;
- el panel UV conserva la posición de A, B y C.

### Columna central — Espacio UV

Mostrar la textura y el triángulo UV superpuesto.

Los puntos A, B y C deben ser arrastrables dentro y fuera del rango `[0,1]`.

Al mover un punto UV:

- la geometría 3D permanece inmóvil;
- la textura sobre el triángulo cambia en tiempo real;
- se actualizan los valores numéricos del vértice;
- si un UV sale de `[0,1]`, debe verse el efecto del wrapping seleccionado.

### Columna derecha — Controles

- selector de textura;
- selector de wrapping: Clamp / Repeat / Mirrored Repeat;
- checkbox **Mostrar posiciones XYZ**;
- checkbox **Mostrar coordenadas UV**;
- checkbox **Mostrar wireframe**;
- botón **UV predeterminados**;
- botón **Triángulo predeterminado**;
- bloque **Idea principal**.

Texto sugerido:

> Cada vértice almacena una posición 3D y una coordenada UV. Modificar un atributo no modifica automáticamente el otro.

## 5.3. Tab “Interpolación UV”

### Columna izquierda — Escena 3D

Mantener el triángulo y agregar un punto P desplazable sobre su superficie.

El punto P debe poder moverse mediante:

- clic;
- arrastre;
- animación automática opcional sobre un recorrido.

La escena debe mostrar:

- punto P;
- líneas desde P hacia A, B y C, opcionales;
- pesos baricéntricos `α`, `β` y `γ`;
- coordenada UV interpolada resultante;
- color final leído de la textura.

### Columna central — Espacio UV

Mostrar:

- triángulo UV;
- punto P' correspondiente a P;
- movimiento sincronizado de P';
- coordenadas `(u,v)`;
- color de la textura en ese punto;
- texel o texels utilizados por el sampler.

Debe existir un modo **Paso a paso** con esta secuencia:

1. seleccionar un punto P sobre el triángulo 3D;
2. calcular sus pesos respecto de A, B y C;
3. interpolar los UV de los tres vértices;
4. localizar P' en la textura;
5. consultar el sampler;
6. devolver el color al fragmento.

No es necesario mostrar toda la matemática de manera permanente. Las fórmulas pueden aparecer en el modo Paso a paso o en una ayuda desplegable.

### Columna derecha — Controles

- selector de modo: mover P / recorrido automático / paso a paso;
- selector de filtro: Nearest / Linear;
- slider de velocidad de animación;
- checkbox **Mostrar pesos baricéntricos**;
- checkbox **Mostrar texels utilizados**;
- checkbox **Mostrar líneas auxiliares**;
- botones **Anterior** y **Siguiente** para el modo Paso a paso;
- bloque **Idea principal**.

Texto sugerido:

> Dentro del triángulo, las coordenadas UV se obtienen interpolando los UV de sus tres vértices. El sampler utiliza ese resultado para consultar la textura.

## 5.4. Tab “Malla completa”

### Columna izquierda — Escena 3D

Mostrar una malla completa con varias regiones y costuras visibles. Se recomienda comenzar con un cubo redondeado, una cabeza simplificada o una tetera de baja resolución.

La escena debe permitir:

- orbitar y hacer zoom;
- seleccionar una cara o triángulo;
- resaltar una isla UV completa;
- mostrar u ocultar wireframe;
- mostrar u ocultar costuras;
- alternar entre vista texturada y visualización por islas.

Al seleccionar un triángulo o isla:

- el elemento se resalta en la escena 3D;
- se resalta simultáneamente en el espacio UV;
- los demás elementos reducen levemente su contraste, sin desaparecer.

### Columna central — Espacio UV

Mostrar el UV map completo sobre una textura de prueba.

Debe incluir:

- todos los triángulos UV;
- costuras diferenciadas;
- islas UV identificables;
- resaltado sincronizado con la escena;
- posibilidad de seleccionar desde el propio UV map;
- opción de mostrar una cuadrícula de densidad de texels.

La selección debe funcionar en ambos sentidos:

- 3D → UV;
- UV → 3D.

### Columna derecha — Controles

- selector de malla;
- selector de textura;
- modo de selección: triángulo / isla;
- checkbox **Mostrar wireframe**;
- checkbox **Mostrar costuras**;
- checkbox **Colorear islas**;
- checkbox **Mostrar densidad de texels**;
- botón **Limpiar selección**;
- bloque **Idea principal**.

Texto sugerido:

> El UV map de una malla está formado por sus triángulos desplegados. Las costuras permiten separar la superficie en islas, pero pueden introducir discontinuidades visibles.

## 5.5. Criterios de aceptación de la sección 2

- La escena 3D siempre aparece a la izquierda.
- El espacio UV siempre aparece a la derecha de la escena y antes de los controles.
- Los controles están contenidos en la tercera columna.
- A, B y C mantienen su identidad visual en ambos espacios.
- El usuario puede modificar posiciones 3D sin alterar automáticamente los UV.
- El usuario puede modificar UV sin alterar la geometría.
- El punto interpolado se actualiza de manera continua y coherente en ambos espacios.
- El modo Paso a paso explica el recorrido desde el fragmento hasta el color devuelto por el sampler.
- La selección de triángulos e islas funciona en ambos sentidos.
- Todos los estados pueden restablecerse.

---

# 6. Comportamientos compartidos

## 6.1. Sincronización

Todas las vistas deben compartir un estado centralizado. La interfaz no debe mantener copias independientes de:

- geometría seleccionada;
- vértice seleccionado;
- coordenadas UV/UVW;
- punto de muestreo;
- textura activa;
- filtro activo;
- opciones de visualización.

Una modificación debe actualizar ambas visualizaciones dentro del mismo frame o ciclo de render.

## 6.2. Manipulación directa

Priorizar:

- clic y arrastre;
- raycasting;
- gizmos simples;
- resaltado al pasar el puntero;
- respuesta visual inmediata.

Evitar depender exclusivamente de sliders para acciones que pueden expresarse manipulando directamente la escena.

## 6.3. Restablecimiento

El botón **Restablecer** debe restaurar solamente el tab activo:

- cámara;
- geometría;
- coordenadas;
- textura;
- controles;
- selecciones.

No debe cambiar de sección ni de tab.

## 6.4. Persistencia opcional

No es obligatorio guardar cambios entre sesiones. Como mejora posterior, el estado de sección y tab puede representarse en la URL para permitir enlaces directos.

---

# 7. Requisitos técnicos sugeridos

- Three.js con módulos ES.
- Un único `WebGLRenderer` compartido o dos vistas renderizadas mediante `setViewport` y `setScissor` cuando ambas columnas necesiten contenido WebGL.
- La vista UV 2D puede implementarse con una segunda escena ortográfica, SVG o canvas 2D, según la interacción requerida.
- `OrbitControls` solamente en la escena 3D.
- `Raycaster` para seleccionar superficies y recuperar UV interpoladas.
- `TransformControls` o manipuladores propios para mover geometría y puntos.
- Geometrías con atributos `position` y `uv` accesibles.
- Shaders propios para la textura 3D y para visualizaciones didácticas que no puedan expresarse con materiales estándar.
- Diseño responsive mediante CSS Grid.
- Render bajo demanda cuando la escena esté estática, salvo en animaciones o manipulaciones continuas.

## 7.1. Organización sugerida

```text
src/
  app/
    AppState.js
    Router.js
  layout/
    LabLayout.js
    TopBar.js
    ControlPanel.js
  sections/
    textureDimensions/
      Texture2DLab.js
      Texture3DLab.js
      CubemapLab.js
    uvCoordinates/
      TriangleUVLab.js
      UVInterpolationLab.js
      FullMeshUVLab.js
  shared/
    Scene3DView.js
    TextureSpaceView.js
    SelectionSync.js
    labels/
    shaders/
    textures/
```

La estructura exacta puede adaptarse a la plantilla existente, pero cada demostración debe poder activarse y destruirse sin dejar listeners, geometrías, materiales o texturas en memoria.

---

# 8. Rendimiento y calidad

- Mantener interacción fluida en equipos de escritorio de gama media.
- Limitar el pixel ratio a un valor razonable, por ejemplo `Math.min(devicePixelRatio, 2)`.
- Reutilizar geometrías y materiales cuando sea posible.
- Ejecutar `dispose()` al abandonar un tab.
- Evitar modelos externos pesados; preferir geometrías procedurales o modelos livianos incluidos localmente.
- Las etiquetas deben permanecer legibles sin cubrir la geometría.
- Las líneas y puntos de selección deben seguir siendo visibles sobre texturas claras y oscuras.

---

# 9. Accesibilidad y usabilidad

- Todos los controles deben tener etiquetas visibles.
- Los botones deben mostrar estados activos y deshabilitados.
- Los colores de A, B y C deben complementarse con letras.
- Los valores numéricos deben poder consultarse sin depender del hover.
- Los controles deben poder operarse con teclado cuando sea razonable.
- El usuario debe poder distinguir claramente qué elementos son arrastrables.
- Las explicaciones deben usar terminología consistente: vértice, coordenada UV, texel, textura, sampler, interpolación e isla UV.

---

# 10. Resultado esperado

Al finalizar estas dos secciones, el usuario debe poder explicar que:

1. una textura 2D se consulta con UV;
2. una textura 3D se consulta con UVW;
3. un cubemap se consulta mediante una dirección;
4. la geometría 3D y el espacio UV son representaciones diferentes relacionadas por atributos;
5. los UV se almacenan en los vértices y se interpolan en el interior de cada triángulo;
6. una malla completa puede dividirse en islas UV separadas por costuras.

