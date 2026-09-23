# Capítulo 6 — Aliasing, mipmaps y filtrado anisotrópico

## Propósito

Este capítulo debe continuar directamente el problema dejado abierto al final del Capítulo 5.

En el capítulo anterior el alumno ya vio que:

- un píxel de pantalla corresponde a una región sobre la superficie;
- esa región se transforma en un footprint en el espacio UV;
- ese footprint puede abarcar uno o muchos texels;
- `Nearest` y `Linear` utilizan una cantidad muy limitada de muestras para decidir el color final.

El Capítulo 6 parte de esa situación y responde dos preguntas:

1. **¿Qué ocurre cuando el footprint cubre mucha más información de la que el sampler está utilizando?**
2. **¿Cómo ayudan los mipmaps y el filtrado anisotrópico a reducir esos artefactos?**

La decisión de diseño es mantener **una sola escena pedagógica fuerte** y evitar una proliferación de tabs o experimentos independientes.

---

## Estructura general

El capítulo tendrá **dos tabs principales**:

- **Aliasing**
- **Mipmaps y anisotropía**

Ambos tabs reutilizan la misma escena base.

La escena principal será un **piso o plano texturado visto en perspectiva**, con una textura checker o patrón repetitivo de alta frecuencia.

La cámara se colocará de modo que:

- cerca de la cámara, la textura se vea relativamente estable;
- a media distancia comiencen a aparecer patrones falsos;
- al fondo se haga evidente el aliasing o moiré;
- con ángulos más oblicuos el footprint se vuelva alargado, preparando la explicación de anisotropía.

No se creará un laboratorio 1D independiente para Nyquist. Esa idea puede explicarse oralmente o con una anotación conceptual breve, pero no necesita una pestaña propia.

---

# Tab 1 — Aliasing

## Idea pedagógica

Este tab debe mostrar de manera directa que el aliasing aparece cuando un píxel de pantalla representa una región de textura demasiado grande o demasiado detallada para el modo de muestreo utilizado.

La intención es que el alumno vea el problema antes de introducir la solución.

---

## Escena principal

Se muestra un plano grande o piso extendido con una textura repetitiva de alto contraste, por ejemplo:

- checkerboard;
- líneas;
- patrón periódico;
- cuadrícula de alta frecuencia.

La cámara observa el plano en perspectiva.

La textura debe tener suficiente detalle para que el aliasing aparezca claramente hacia el fondo de la escena.

---

## Interacción

El usuario puede:

- mover ligeramente la cámara;
- variar la inclinación de la vista;
- seleccionar un píxel del viewport;
- inspeccionar su footprint;
- cambiar entre `Nearest` y `Linear`.

No hace falta una navegación libre compleja.

La manipulación debe estar acotada para que el fenómeno siga siendo evidente.

---

## Relación con el Capítulo 5

Se conserva la misma lógica de navegación secundaria que ya se introdujo:

- **Viewport**
- **Escena 3D**
- **Espacio UV**

Sólo una de estas vistas aparece grande a la vez.

Esto permite reutilizar mentalmente la estructura conocida y evita llenar la pantalla de ventanas pequeñas.

---

## Vista Viewport

El viewport simulado puede conservar una resolución baja o media para que el alumno pueda seleccionar un píxel.

Debe ser posible señalar un píxel en una zona cercana y otro en una zona lejana del piso.

La intención es comparar dos situaciones:

- footprint pequeño;
- footprint grande.

---

## Vista Escena 3D

La vista muestra:

- la cámara;
- el piso texturado;
- el píxel seleccionado;
- el footprint correspondiente sobre el piso.

El footprint debe crecer visualmente a medida que se seleccionan zonas más alejadas o vistas con mayor oblicuidad.

---

## Vista Espacio UV

Se muestra el footprint correspondiente en la textura.

En zonas cercanas, el footprint puede abarcar pocos texels.

En zonas lejanas puede abarcar muchos texels.

El objetivo es hacer visible la contradicción:

> el píxel representa una región grande de la textura, pero `Nearest` o `Linear` utilizan sólo una pequeña cantidad de muestras.

---

## Resultado visual

La escena debe permitir observar directamente:

- moiré;
- parpadeo;
- patrones falsos;
- cambios bruscos al mover ligeramente la cámara;
- pérdida de estabilidad en las zonas alejadas.

No hace falta agregar cajas explicativas estáticas para cada artefacto.

El propio render debe ser la demostración.

---

## Comparación de filtros

En este tab sólo se comparan:

- `Nearest`
- `Linear`

El objetivo no es presentar aún la solución completa, sino mostrar que el filtrado lineal puede suavizar parte del problema pero no eliminarlo cuando el footprint cubre demasiados texels.

---

## Idea principal del tab

> El aliasing aparece cuando un píxel representa más detalle de la textura del que el muestreo puede representar correctamente.

---

# Tab 2 — Mipmaps y anisotropía

## Idea pedagógica

Este tab reutiliza exactamente la misma escena.

La diferencia es que ahora se introducen técnicas que intentan resolver el problema observado:

- mipmaps;
- selección de nivel;
- filtrado anisotrópico.

La pantalla debe sentirse como una evolución del tab anterior, no como una nueva aplicación.

---

## Escena principal

Se mantiene:

- el mismo piso;
- la misma cámara;
- la misma textura;
- el mismo píxel seleccionable;
- el mismo footprint.

Esto permite comparar directamente el resultado antes y después de activar cada técnica.

---

## Controles principales

Los controles deben ser mínimos:

- **Sin mipmaps**
- **Con mipmaps**
- **Anisotropía**
- **Filtro**
- **Nivel MIP automático / forzado**
- **Mostrar footprint**
- **Mostrar nivel MIP**
- **Restablecer vista**

La anisotropía puede expresarse con un control simple, por ejemplo:

- `1×`
- `2×`
- `4×`
- `8×`
- `Máximo disponible`

No hace falta explicar toda la implementación interna del filtrado anisotrópico.

---

## Visualización de mipmaps

No se debe crear una pestaña separada para una “pirámide de mipmaps”.

La pirámide puede aparecer como una **visualización auxiliar integrada** cuando el usuario lo solicite.

Por ejemplo, en la vista UV puede mostrarse una pequeña columna lateral con:

- MIP 0
- MIP 1
- MIP 2
- MIP 3
- ...

El nivel utilizado actualmente debe quedar resaltado.

También puede mostrarse un rótulo compacto:

**Nivel seleccionado: MIP 3**

---

## Selección del nivel

El usuario puede seleccionar un píxel lejano del piso y observar que el sistema utiliza un nivel más reducido de la textura.

Si selecciona un píxel cercano, el nivel elegido debe aproximarse al original.

La conexión conceptual debe ser:

> footprint grande → nivel MIP más pequeño.

No hace falta mostrar derivadas ni fórmulas.

---

## Comparación visual

La escena debe permitir alternar en tiempo real:

- sin mipmaps;
- con mipmaps;
- con mipmaps + anisotropía.

La comparación tiene que ser inmediata.

La zona del fondo del piso debe mostrar claramente:

- inestabilidad sin mipmaps;
- mayor estabilidad con mipmaps;
- mayor nitidez en perspectiva oblicua al activar anisotropía.

---

## Anisotropía

La anisotropía debe introducirse únicamente cuando el footprint deja de ser aproximadamente cuadrado y se vuelve muy alargado.

Esto ocurre naturalmente al mirar el piso con un ángulo muy oblicuo.

La vista UV puede mostrar ese footprint estirado.

La explicación visual debe ser:

> cuando la región cubierta por un píxel tiene una forma muy alargada, un muestreo isotrópico pierde demasiado detalle en una dirección.

El filtrado anisotrópico mejora ese caso.

No hace falta mostrar el algoritmo interno.

---

## Idea principal del tab

> Los mipmaps reducen el aliasing usando versiones de menor resolución cuando el footprint es grande. La anisotropía mejora el muestreo cuando ese footprint es muy alargado.

---

# Layout general

Se mantiene el lenguaje visual del resto de la aplicación.

## Zona central

Una sola vista grande seleccionable mediante navegación secundaria:

- **Viewport**
- **Escena 3D**
- **Espacio UV**

Esta navegación secundaria se reutiliza del Capítulo 5 para mantener continuidad.

---

## Columna derecha

La columna derecha debe contener:

- **Idea principal**
- controles específicos del tab;
- toggles de visualización;
- botón **Restablecer vista**.

No deben agregarse paneles explicativos redundantes debajo de la escena.

---

# Texturas diagnósticas

Se utilizarán pocas texturas y con propósito claro:

- checkerboard de alta frecuencia;
- líneas periódicas;
- patrón cuadriculado fino.

La textura principal debe ser suficientemente repetitiva y contrastada como para generar aliasing visible.

No es necesario incluir fotografías.

---

# Decisiones de diseño cerradas

- el capítulo tendrá **2 tabs**;
- se utilizará **una sola escena base**;
- no habrá laboratorio 1D separado;
- no habrá pestaña exclusiva para Nyquist;
- no habrá una pestaña exclusiva para la pirámide de mipmaps;
- la navegación secundaria será **Viewport / Escena 3D / Espacio UV**;
- se reutiliza la misma lógica visual del Capítulo 5;
- el tab 1 presenta el problema;
- el tab 2 presenta las soluciones;
- la anisotropía se explica únicamente en el caso de footprints alargados;
- se evita llenar la pantalla de cajas explicativas permanentes.

---

# Criterio de cierre del capítulo

El capítulo estará correctamente resuelto si el alumno puede entender estas tres ideas:

1. **cuando un píxel representa una región muy grande de la textura, `Nearest` o `Linear` pueden producir aliasing;**
2. **los mipmaps reducen ese problema utilizando versiones de menor resolución de la textura;**
3. **la anisotropía mejora especialmente las superficies vistas en ángulos oblicuos, donde el footprint es muy alargado.**

La progresión conceptual completa queda así:

**Capítulo 5:** qué región representa un píxel y cómo decide un sampler.

**Capítulo 6:** qué ocurre cuando esa región contiene demasiado detalle y cómo se reduce el problema.
