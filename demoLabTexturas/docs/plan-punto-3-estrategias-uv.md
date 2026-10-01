# Laboratorio de Texturas — Punto 3

## Estrategias para obtener coordenadas UV

## 1. Alcance e integración

Agregar esta sección a la aplicación existente, suponiendo que los puntos 1 y 2 ya están implementados y que pueden reutilizarse:

- la estructura general de navegación;
- el visor 3D;
- el visor del espacio UV;
- la selección sincronizada entre triángulos 3D y UV;
- el componente común de controles.

Esta sección no será un editor UV. No debe permitir mover vértices, transformar islas, crear costuras ni ejecutar un unwrap automático. Su propósito es comparar distintas maneras de **obtener o asignar** coordenadas UV.

## 2. Idea didáctica

Las coordenadas UV pueden aparecer de tres maneras generales:

1. **Surgen del algoritmo que genera la superficie.** La geometría se construye mediante dos parámetros y esos parámetros se escriben directamente como `u` y `v`.
2. **Se calculan mediante una regla de proyección.** La geometría ya existe y sus UV se obtienen a partir de la posición o de la orientación de sus vértices y triángulos.
3. **Son diseñadas mediante un unwrap.** La superficie se corta en islas que se organizan manualmente dentro de un atlas.

No existe una estrategia universalmente mejor. La elección depende de la forma del objeto, de cómo fue generado y de qué se quiere representar con la textura.

## 3. Interfaz general

Mantener la distribución utilizada en las secciones anteriores:

| Columna | Contenido | Prioridad de espacio |
|---|---|---:|
| Izquierda | Escena 3D | Alta |
| Central | Espacio UV | Alta |
| Derecha | Controles y explicación | Baja |

Las columnas 3D y UV deben ocupar la mayor parte de la pantalla. La columna de controles debe ser estrecha y plegable.

La barra superior tendrá cinco casos:

1. **UV de generación**
2. **Proyección planar**
3. **Proyección cilíndrica**
4. **Proyección tipo caja**
5. **Unwrap y atlas**

No se requiere ninguna animación que reconstruya progresivamente la geometría. Cada caso debe abrir directamente con el objeto terminado, su textura aplicada y su mapa UV real.

## 4. Comportamientos comunes

Todos los casos deben incluir:

- `OrbitControls` en la escena 3D;
- opción **Mostrar wireframe**;
- selector entre textura real y textura UV diagnóstica cuando corresponda;
- selección sincronizada de triángulos entre la escena 3D y el espacio UV;
- visualización numérica de los UV del triángulo seleccionado;
- botón **Restablecer cámara**.

El wireframe se superpondrá al material sin reemplazar la textura. Debe permitir reconocer claramente cómo la superficie está triangulada.

Al seleccionar un triángulo en cualquiera de las dos vistas:

1. se resaltará el triángulo en 3D;
2. se resaltará su equivalente en el espacio UV;
3. se mostrarán sus tres pares de coordenadas UV;
4. se indicará qué estrategia produjo esas coordenadas.

## 5. Caso 1: UV surgidos de la generación de la superficie

### 5.1. Objetivo

Mostrar geometrías cuyos UV son escritos por el mismo algoritmo que genera sus posiciones y triángulos.

El panel derecho incluirá solamente un selector de objeto y los controles comunes.

### 5.2. Objetos

#### A. Plano

Usar `THREE.PlaneGeometry`.

- `u` avanza sobre una dirección del plano;
- `v` avanza sobre la dirección perpendicular;
- el espacio UV es el cuadrado completo `[0,1] × [0,1]`.

Este es el ejemplo inicial y más simple.

#### B. Cilindro sin tapas

Usar `THREE.CylinderGeometry` con `openEnded: true`.

- `u` recorre el ángulo alrededor del cilindro;
- `v` recorre su altura;
- el espacio UV es una banda rectangular;
- debe señalarse la costura longitudinal donde `u` pasa de `1` a `0`.

La ausencia de tapas evita introducir otra estrategia de mapeo dentro del mismo objeto.

#### C. Botella como superficie de revolución

Generar un perfil lateral y utilizar `THREE.LatheGeometry`.

- `u` recorre el giro alrededor del eje;
- `v` recorre los puntos del perfil desde la base hasta la parte superior;
- el mapa UV es una banda que funciona como una etiqueta extendida sobre toda la botella.

Si la implementación de `LatheGeometry` distribuye `v` según el índice de los puntos del perfil, conservar ese resultado. Puede explicarse que utilizar longitud acumulada sería otra decisión posible, pero no es necesario implementarla en esta sección.

#### D. Esfera

Usar `THREE.SphereGeometry`.

- `u` recorre la longitud alrededor de la esfera;
- `v` recorre la latitud entre los polos;
- utilizar una textura equirectangular geográficamente correcta;
- mostrar la costura y la concentración de triángulos UV en los polos.

#### E. Superficie de barrido tubular

Usar `THREE.TubeGeometry`.

La curva central será una `THREE.CatmullRomCurve3` abierta con un recorrido tridimensional claramente zigzagueante. La sección transversal será circular.

- un eje UV avanza a lo largo de la curva;
- el otro recorre la circunferencia de la sección;
- el espacio UV resultante es una banda rectangular;
- aplicar una textura diagnóstica con bandas longitudinales y transversales para que pueda seguirse el recorrido.

Este ejemplo debe permitir relacionar directamente el mapeo con el algoritmo general de una superficie de barrido: un parámetro recorre la trayectoria y el otro recorre la forma.

### 5.3. Texto conceptual

> En estas geometrías, las coordenadas UV se escriben durante la generación de la superficie. No son inevitables, pero reutilizar los mismos parámetros del algoritmo suele ser la decisión más natural.

## 6. Caso 2: proyección planar

### 6.1. Objeto

Usar un terreno irregular construido como una malla de alturas.

Aunque el terreno pueda partir de una grilla, para esta demostración sus UV deben recalcularse explícitamente a partir de la posición local de cada vértice, sin reutilizar el atributo `uv` original:

```js
u = (x - minX) / (maxX - minX);
v = (z - minZ) / (maxZ - minZ);
```

Esto representa una proyección vertical desde arriba.

### 6.2. Visualización

- escena 3D: terreno con la textura cenital aplicada;
- espacio UV: rectángulo completo con la triangulación del terreno;
- opción de textura diagnóstica para observar la deformación;
- wireframe disponible.

Las pendientes pronunciadas deben mostrar el estiramiento propio de medir sobre el plano XZ en lugar de seguir la distancia real de la superficie.

No se incluirán controles para rotar o desplazar el proyector.

### 6.3. Texto conceptual

> La proyección planar no necesita saber cómo se generó la malla: calcula los UV proyectando las posiciones sobre un plano elegido por el diseñador.

## 7. Caso 3: proyección cilíndrica

### 7.1. Objeto

Usar una columna de piedra levemente irregular, generada proceduralmente. No debe ser un cilindro perfecto.

La geometría se crea primero y luego se descartan o reemplazan sus UV para calcular:

```js
u = ánguloAlrededorDelEje / (2 * Math.PI);
v = alturaNormalizada;
```

### 7.2. Visualización

- objeto texturado en 3D;
- cilindro virtual semitransparente opcional alrededor del objeto;
- eje vertical del cilindro;
- costura longitudinal resaltada;
- banda rectangular en el espacio UV;
- wireframe disponible.

No se necesitan controles para cambiar el eje, el radio o la posición del cilindro virtual.

### 7.3. Texto conceptual

> En este caso la forma cilíndrica no generó necesariamente los UV. El diseñador impone posteriormente un sistema de coordenadas cilíndrico sobre la malla.

## 8. Caso 4: proyección tipo caja

### 8.1. Objeto

Usar una roca o bloque irregular de proporciones aproximadamente cúbicas, con suficientes subdivisiones para incluir triángulos orientados en distintas direcciones.

### 8.2. Regla

Para cada triángulo:

1. calcular su normal en espacio local;
2. determinar cuál de `abs(normal.x)`, `abs(normal.y)` o `abs(normal.z)` es mayor;
3. elegir la proyección planar perpendicular al eje dominante;
4. ajustar la orientación para evitar inversiones evidentes entre las direcciones positiva y negativa.

Los triángulos se clasificarán como proyección X, Y o Z.

### 8.3. Visualización

- textura de roca aplicada al objeto;
- modo auxiliar que colorea los triángulos por proyección: X rojo, Y verde y Z azul;
- espacio UV con los triángulos reales, aunque existan solapamientos;
- filtro para mostrar en UV solamente el grupo X, Y o Z;
- wireframe disponible.

No se implementará triplanar blending. Este caso representa asignación UV por triángulo, no mezcla de texturas en el shader.

### 8.4. Texto conceptual

> El box mapping combina varias proyecciones planares. Cada triángulo elige una de ellas según la dirección predominante de su normal.

## 9. Caso 5: unwrap y atlas UV

### 9.1. Recursos provistos

El modelo no debe generarse por código. Se utilizarán dos archivos proporcionados posteriormente:

- `modelo-unwrap.glb`
- `modelo-unwrap-atlas.png`

El archivo GLB debe contener una geometría irregular con coordenadas UV ya desplegadas. La textura debe corresponder exactamente a ese unwrap.

La implementación debe mantener estos nombres y centralizar sus rutas para que los archivos definitivos puedan reemplazarse sin modificar la lógica del caso.

### 9.2. Visualización

- escena 3D con el modelo y su atlas aplicado;
- espacio UV con las islas extraídas del atributo `uv` real del modelo;
- costuras resaltadas sobre el modelo y sobre el mapa cuando puedan inferirse a partir de duplicaciones de vértices;
- selección sincronizada entre triángulos e islas;
- wireframe disponible.

No se permitirá editar, mover o regenerar las islas UV.

### 9.3. Texto conceptual

> En una geometría irregular, el diseñador puede cortar la superficie y organizar sus partes como islas dentro de un atlas. Los UV son parte de los datos provistos por el modelo.

## 10. Texturas y recursos

### 10.1. Texturas generadas por código

Crear mediante `CanvasTexture` para mantener líneas, números y orientación exactos:

- `uvDiagnosticTexture`: grilla, ejes U/V, números y flechas;
- `checkerTexture`: checkerboard de alto contraste;
- `sweepBandsTexture`: bandas transversales y longitudinales con colores diferenciados.

No deben almacenarse como imágenes externas.

### 10.2. Texturas incluidas con este plan

| Archivo | Uso |
|---|---|
| `assets/terrain-planar-topdown.png` | Proyección cenital sobre el terreno |
| `assets/piedra-cilindrica-seamless.png` | Proyección cilíndrica sobre la columna |
| `assets/roca-box-seamless.png` | Proyección tipo caja sobre la roca |

Estas imágenes son mapas de color. Configurarlas como texturas de color sRGB.

### 10.3. Recursos externos o provistos posteriormente

| Archivo | Condición |
|---|---|
| `earth-equirectangular.jpg` | Textura equirectangular real y geográficamente correcta. No generarla con IA. |
| `modelo-unwrap.glb` | Provisto por el usuario. |
| `modelo-unwrap-atlas.png` | Provisto por el usuario y correspondiente al GLB. |

## 11. Controles definitivos

La tercera columna contendrá solamente:

- selector de caso;
- selector de objeto dentro del caso 1;
- selector **Textura real / Textura diagnóstica**, cuando corresponda;
- `Mostrar wireframe`;
- `Mostrar costura`, cuando corresponda;
- `Mostrar referencia de proyección`, para los casos planar, cilíndrico y caja;
- filtro X/Y/Z en el caso de box mapping;
- `Restablecer cámara`.

No agregar parámetros continuos, gizmos de proyección ni herramientas de edición UV.

## 12. Criterios de aceptación

La sección estará completa cuando:

- se integre a la navegación de la aplicación existente;
- la escena 3D permanezca a la izquierda y el espacio UV en el centro;
- los cinco casos utilicen los UV que realmente consume el material;
- todos los objetos permitan activar wireframe;
- el caso 1 incluya plano, cilindro sin tapas, botella, esfera y `TubeGeometry`;
- el tubo muestre un eje UV sobre el recorrido y el otro alrededor de la sección circular;
- el terreno recalcule sus UV mediante una proyección XZ;
- la columna recalcule sus UV mediante una proyección cilíndrica;
- el box mapping seleccione una proyección según la normal de cada triángulo;
- el caso de unwrap cargue el modelo y la textura provistos sin intentar generarlos;
- la selección de un triángulo relacione correctamente las vistas 3D y UV;
- no se incluya ninguna animación de construcción ni herramienta de edición UV.

## 13. Cierre didáctico

> Las coordenadas UV pueden surgir del algoritmo que genera una superficie, calcularse posteriormente mediante una regla de proyección o venir diseñadas como parte de un unwrap. En todos los casos representan una decisión sobre cómo relacionar una superficie 3D con un espacio de textura 2D.
