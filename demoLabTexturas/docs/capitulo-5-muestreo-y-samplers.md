# Capítulo 5 — Laboratorio de muestreo y samplers

## Propósito

Este capítulo debe explicar **qué hace un sampler** cuando hay que asignar un color a un píxel de pantalla a partir de una textura.

La idea no es volver a enseñar el mapeo UV en general, porque eso ya fue trabajado en capítulos anteriores, sino mostrar la relación entre:

**píxel de pantalla → región sobre la superficie → región en el espacio UV → color devuelto por el sampler**

El objetivo conceptual del capítulo es observar cómo una coordenada continua termina produciendo un valor a partir de texels discretos y cómo el filtro determina ese valor.

---

## Estructura general del capítulo

El capítulo tendrá **dos tabs principales**:

- **Huella de píxel**
- **Filtro del sampler**

No habrá más tabs ni una proliferación de ejemplos. La decisión pedagógica es trabajar **una misma escena base** y agregar complejidad de manera incremental.

La escena base estará formada por:

- un **viewport simulado** de baja resolución;
- una **escena 3D** con un plano texturado inclinado;
- una vista del **espacio UV / textura**;
- una columna derecha con **Idea principal** y controles.

El tema de **magnificación** y **minificación** no se mostrará como cajas explicativas independientes al pie, porque eso recarga la pantalla. Quedará implícito en la escena y en la explicación docente.

---

# Tab 1 — Huella de píxel

## Idea pedagógica

Este tab muestra que un píxel de pantalla **no corresponde directamente a un único texel**.

Un píxel define una cierta región sobre la superficie y esa región se transforma en otra región en el espacio UV.

Además, se quiere introducir una idea importante:

> **En teoría, dentro de un píxel hay una imagen continua, pero en la práctica el render debe decidir un único color final para ese píxel.**

---

## Layout

La pantalla mantiene la lógica general de la app, pero con una adaptación específica.

### Columna izquierda

Se divide en dos zonas internas.

#### 1. Viewport simulado

Una grilla de resolución baja, por ejemplo **16 × 12**, donde el usuario puede seleccionar un píxel.

#### 2. Vista ideal dentro del píxel

Debajo del viewport se muestra una ampliación conceptual de lo que “cae dentro” de ese píxel si la imagen tuviera resolución idealmente alta.

No es una vista discretizada en texels, sino una representación continua de la escena.

Esta vista existe para que el alumno entienda que el problema del sampler no nace porque “faltan UV”, sino porque al final hay que condensar toda esa información en un solo color.

---

### Columna central izquierda

## Escena 3D

Se muestra un plano inclinado, texturado, visto en perspectiva.

Debe verse la cámara y el frustum general de manera simple, pero sin recargar.

No hace falta hablar de “lanzar rayos”; ese lenguaje se elimina del texto visible.

Sobre el plano aparece el **footprint** correspondiente al píxel elegido: una pequeña región cuadrilateral o poligonal resaltada.

La vista debe comunicar visualmente:

- qué píxel fue elegido;
- qué región de la superficie corresponde a ese píxel.

---

### Columna central derecha

## Textura / UV

Se muestra la textura ampliada como una grilla de texels visibles, con ejes U y V.

Sobre esa textura aparece el **footprint en UV**, correspondiente a la región de superficie del panel 3D.

Este footprint debe cubrir una cierta cantidad de texels, de modo que el alumno vea claramente que un píxel puede abarcar una región pequeña o grande dentro del espacio UV.

---

### Columna derecha

Se mantiene la columna de controles con el mismo lenguaje visual de la app.

Debe incluir:

- caja **Idea principal**;
- resolución del viewport;
- posición de cámara;
- inclinación del plano;
- textura diagnóstica;
- toggles de visualización.

---

## Texto conceptual visible

La explicación textual de este tab debe evitar lenguaje demasiado técnico o interno al motor.

No se dirá:

> “cada píxel lanza rayos a la escena”.

La formulación correcta será del estilo:

- un píxel de pantalla genera un **footprint** en la superficie;
- ese footprint corresponde a una región en el espacio UV;
- esa región puede cubrir uno o varios texels.

---

## Controles

Los controles de este tab deben ser pocos:

- **Resolución viewport**  
  preset inicial: `16 × 12`
- **Posición de cámara**  
  preset inicial: `vista en ángulo`
- **Inclinación del plano**
- **Textura diagnóstica**
- **Mostrar footprint**
- **Mostrar cámara**
- **Mostrar texels**
- **Mostrar wireframe**
- **Restablecer vista**

No se agregan más herramientas en esta etapa.

---

## Interacción esperada

Cuando el usuario selecciona un píxel del viewport:

1. se actualiza la región resaltada en la escena 3D;
2. se actualiza el footprint correspondiente en la textura / UV;
3. se actualiza la vista ampliada ideal del contenido dentro del píxel.

Cuando cambia la cámara o la inclinación del plano, debe modificarse el tamaño y forma del footprint, tanto en 3D como en UV.

---

## Idea principal del tab

> Un píxel de pantalla no equivale siempre a un texel. Cada píxel corresponde a una región sobre la superficie y a una región en el espacio UV.

---

# Tab 2 — Filtro del sampler

## Idea pedagógica

Este tab parte de exactamente la misma escena conceptual que el anterior, pero ahora responde la pregunta:

> **Dada esa región en la textura, ¿qué color devuelve finalmente el sampler?**

La saturación visual del primer diseño se reduce reutilizando elementos y reorganizando el layout.

---

## Layout

Este tab no debe crear una pantalla completamente distinta; debe sentirse como una evolución del tab anterior.

### Zona central principal

Habrá una **barra secundaria de navegación** que permite elegir qué vista central se quiere priorizar:

- **Viewport**
- **Escena 3D**
- **Espacio UV**

Sólo una de estas vistas aparece grande en el panel principal a la vez.

La vista más importante por defecto será **Espacio UV**, porque en este tab el foco está en cómo se calcula el color a partir de texels.

Esto permite no apilar demasiadas ventanas pequeñas y, al mismo tiempo, conservar todos los elementos conceptuales de la escena.

---

### Parte inferior permanente

Debajo de la vista central debe permanecer fijo un bloque llamado:

## Cómo decide el sampler

Allí se muestran siempre:

- un esquema **Nearest**;
- un esquema **Linear**;
- el **Resultado del sampler**.

Este bloque es permanente porque representa la salida conceptual del capítulo.

No deben aparecer cajas separadas del tipo “Nearest: cambios bruscos” o “Linear: transición continua”; esa explicación puede quedar a cargo del docente o de la caja de Idea principal.

---

### Columna derecha

Se mantiene igual que en el primer tab, pero adaptada a este problema.

Debe incluir:

- **Idea principal**
- selector **Filtro**
- selector **Textura**
- toggles de visualización
- botón **Restablecer vista**

---

## Vista central en modo “Espacio UV”

Cuando está activa la vista UV, se muestra:

- la textura ampliada;
- el footprint en UV;
- el **centro del píxel** como coordenada UV;
- los cuatro texels vecinos A, B, C y D, cuando corresponda.

Esta vista es la más importante del tab.

---

## Bloque “Cómo decide el sampler”

### Modo Nearest

Se muestra que el sampler elige **un único texel**, el más cercano al punto de muestreo.

Visualmente:

- se resalta un texel;
- se muestra el color final asociado;
- el esquema debe ser muy sintético.

### Modo Linear

Se muestra que el sampler combina **cuatro texels vecinos**.

Visualmente:

- aparecen A, B, C y D;
- aparecen pesos o contribuciones;
- se muestra el color mezclado final.

No hace falta una formulación matemática extensa; basta con expresar visualmente que la mezcla depende de la posición del punto.

---

## Resultado permanente

El bloque de resultado debe mostrar en todo momento el color devuelto por el sampler.

Idealmente:

- un recuadro para **Color con Nearest**
- un recuadro para **Color con Linear**

Aunque el usuario tenga uno de los filtros como activo, mostrar ambos resultados simultáneamente puede ser útil como comparación directa.

Si esto complica demasiado la implementación o el espacio, puede mostrarse solamente el resultado del filtro actualmente seleccionado.

---

## Controles

Los controles mínimos de este tab serán:

- **Filtro**: `Nearest | Linear`
- **Textura**
- **Mostrar texels**
- **Mostrar etiquetas A-B-C-D**
- **Mostrar cálculo**
- **Mostrar footprint**
- **Restablecer vista**

No se agregan comentarios estáticos redundantes.

---

## Reutilización de escena

Es importante dejar explícito que el Tab 2 **no introduce una segunda escena pedagógica diferente**.

Reutiliza los mismos conceptos del Tab 1:

- viewport;
- superficie 3D;
- footprint;
- espacio UV.

La novedad es únicamente el paso final:

**cómo el sampler transforma una coordenada UV continua en un color discreto o interpolado**.

---

## Idea principal del tab

> El sampler transforma una coordenada UV continua en un color de la textura. Según el filtro, usa un solo texel o combina varios texels vecinos.

---

# Texturas diagnósticas

Para este capítulo se usarán muy pocas texturas, bien elegidas:

- **Texels de colores**  
  textura principal del Tab 2, ideal para nearest y linear.
- **Cuadrícula UV numerada**  
  útil en el Tab 1 para footprint y lectura espacial.
- opcionalmente una textura de checker / patrón simple para verificar legibilidad.

No se necesita un repertorio grande.

---

# Decisiones de diseño ya cerradas

Quedan fijadas las siguientes decisiones:

- el capítulo tendrá **2 tabs** y no más;
- el Tab 1 introduce **footprint** y relación píxel-superficie-UV;
- el Tab 2 muestra **qué devuelve el sampler**;
- el Tab 2 reutiliza la misma escena y reorganiza el layout con una **barra secundaria**;
- se elimina la explicación con lenguaje de “rayos” en el texto visible;
- se elimina la sobrecarga de cajas inferiores sobre magnificación/minificación;
- se eliminan las cajas fijas “Nearest: cambios bruscos” y “Linear: transición continua”;
- la explicación sobre magnificación y minificación queda integrada en la demo y en la explicación oral, no como bloques adicionales de UI.

---

# Criterio de cierre del capítulo

El capítulo estará bien resuelto si al usarlo un alumno puede entender estas dos ideas:

1. **un píxel de pantalla corresponde a una región en la superficie y en la textura, no necesariamente a un único texel**;
2. **el sampler debe condensar esa información en un color final, usando nearest o linear**.

Con esto, el capítulo 5 queda preparado para abrir el capítulo 6, donde aparece naturalmente la pregunta siguiente:

> **Si un píxel puede cubrir muchos texels, ¿qué problemas aparecen y cómo se corrigen?**

Ese punto enlaza directamente con aliasing, mipmaps y filtrado anisotrópico.
