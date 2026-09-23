# Especificación para Codex — Capítulo 4
## Nuevo tab final: Ajuste de texturas en una casa

## Contexto

Agregar un nuevo tab al **Capítulo 4 — Wrapping y transformaciones de textura**.

Este tab debe ubicarse **después del tab existente “Animación con sprite sheet”** y funcionar como **ejercicio/demostración de cierre del capítulo**.

No debe reemplazar ni modificar los tabs existentes. Debe reutilizar el lenguaje visual, estructura de navegación y componentes de interfaz ya utilizados en el capítulo 4.

Las texturas necesarias para esta demo **ya existen en el proyecto** dentro de la carpeta `Maps/` y deben reutilizarse tal cual. No generar recursos gráficos nuevos para este tab.

Nombre sugerido del nuevo tab:

**Ajuste de texturas**

---

# Objetivo pedagógico

El ejercicio debe permitir aplicar de forma práctica lo aprendido sobre `repeat` y `offset`.

La escena debe partir de una situación en la que varias texturas tienen valores incorrectos y se ven visualmente mal. El usuario debe corregirlos hasta lograr una apariencia razonable.

La idea principal es:

> Una misma textura puede verse correcta o incorrecta según cómo se ajusten sus parámetros de repetición. En texturas no periódicas, como una puerta, también puede ser necesario ajustar el offset.

El foco principal será:

- `repeat` para texturas seamless;
- `repeat + offset` para la textura de la puerta.

No debe convertirse en un ejercicio de UV mapping ni en un editor de materiales complejo.

---

# Escena 3D

La escena debe mostrar una casa simple construida con geometrías básicas.

Debe incluir:

## 1. Suelo de pasto

Un plano grande horizontal alrededor de la casa.

Textura:

- pasto;
- seamless;
- debe repetirse varias veces.

Estado inicial:

- `repeat` incorrecto;
- por ejemplo, pasto demasiado grande o demasiado pequeño.

## 2. Plataforma o base de piedra

Una plataforma rectangular ligeramente elevada sobre el pasto.

Debe tener poco espesor, suficiente para generar un pequeño escalón visible.

Textura:

- piedra irregular / empedrado;
- seamless.

Estado inicial:

- escala visual incorrecta;
- por ejemplo, piedras demasiado grandes.

## 3. Cuerpo de la casa

Una casa muy simple, sin detalles innecesarios.

Geometría:

- volumen rectangular;
- cuatro paredes;
- sin ventanas;
- sin molduras;
- sin elementos decorativos adicionales.

Textura de paredes:

- ladrillo;
- seamless.

Estado inicial:

- `repeat` incorrecto;
- por ejemplo, ladrillos gigantes.

## 4. Techo a dos aguas

Techo simple a dos aguas, claramente visible.

Textura:

- tejas;
- seamless.

Estado inicial:

- `repeat` incorrecto;
- por ejemplo, pocas tejas enormes.

## 5. Puerta

Plano o geometría muy delgada colocada sobre la pared frontal.

Textura:

- imagen frontal de una puerta de madera rústica;
- no seamless;
- debe incluir vetas, paneles o divisiones típicas de una puerta;
- puede incluir el espacio visual de cerradura;
- evitar un picaporte 3D dibujado en la textura que genere una lectura confusa.

Estado inicial:

- repetición incorrecta;
- desplazamiento incorrecto;
- la puerta puede aparecer repetida varias veces o mal encuadrada.

En este caso el usuario debe ajustar:

- `repeat.x`;
- `repeat.y`;
- `offset.x`;
- `offset.y`.

---

# Layout

Mantener la estructura general de la aplicación.

## Columna izquierda — Escena 3D

Debe ocupar la mayor parte del área principal.

Mostrar:

- casa completa;
- pasto;
- plataforma;
- paredes;
- techo;
- puerta.

La cámara debe permitir orbitar y hacer zoom.

Incluir:

- `Restablecer cámara`;
- opcionalmente `Mostrar wireframe`, si ya existe como patrón general del capítulo.

La escena debe comenzar con las texturas deliberadamente mal ajustadas.

El usuario debe poder ver inmediatamente que algo está mal.

## Columna central — Textura activa

No mostrar un UV unwrap completo de la casa.

La columna central debe funcionar como una **vista auxiliar de la textura correspondiente al material seleccionado**.

Cuando el usuario cambia el material activo, mostrar:

- la textura original;
- el dominio `[0,1] × [0,1]`;
- una representación simple de cómo se aplica el `repeat`;
- en el caso de la puerta, también el efecto del `offset`.

La visualización debe ser sencilla.

No intentar representar todas las caras de la casa ni todas las repeticiones UV de la escena al mismo tiempo.

Título sugerido:

**TEXTURA ACTIVA**

o

**ESPACIO DE TEXTURA · MATERIAL ACTIVO**

## Columna derecha — Controles

Mantener el estilo actual del Capítulo 4.

### IDEA PRINCIPAL

> Las texturas seamless se ajustan principalmente mediante repeat para controlar su escala visual. Una textura no periódica, como una puerta, también puede necesitar offset para ubicar correctamente la imagen.

### Consigna

> Ajustá las texturas de la escena hasta que el tamaño visual del pasto, las piedras, los ladrillos y las tejas resulte coherente. En la puerta, corregí además su posición para que aparezca una sola vez y quede bien encuadrada.

---

# Selector de material

Agregar un selector:

**Material activo**

Opciones:

- Pasto
- Piedra
- Ladrillos
- Tejas
- Puerta

Al cambiar el material:

- actualizar los sliders visibles;
- actualizar la textura mostrada en la columna central;
- mantener la cámara y el resto de la escena sin cambios.

---

# Controles por material

## Pasto

Mostrar:

- `repeat U`
- `repeat V`

No mostrar offset como control principal.

## Piedra

Mostrar:

- `repeat U`
- `repeat V`

No mostrar offset como control principal.

## Ladrillos

Mostrar:

- `repeat U`
- `repeat V`

No mostrar offset como control principal.

## Tejas

Mostrar:

- `repeat U`
- `repeat V`

No mostrar offset como control principal.

## Puerta

Mostrar:

- `repeat U`
- `repeat V`
- `offset U`
- `offset V`

La puerta es el único material donde el offset forma parte del desafío.

---

# Sliders

Los rangos deben estar pensados para que:

- el estado inicial sea claramente incorrecto;
- el valor correcto esté dentro de un rango relativamente fácil de encontrar;
- no sea necesario realizar ajustes de precisión extrema.

Evitar rangos excesivamente grandes.

Ejemplo orientativo:

```text
repeat U: 0.25 → 12
repeat V: 0.25 → 12
offset U: -1 → 1
offset V: -1 → 1
```

Estos valores son orientativos. Ajustarlos a la geometría real de la escena.

Los sliders deben mostrar también el valor numérico actual.

---

# Valores iniciales y valores objetivo

Definir internamente un conjunto de valores:

- `initialState`
- `targetState`

Ejemplo conceptual:

```js
const initialState = {
  grass:   { repeat: [1, 1] },
  stone:   { repeat: [1, 1] },
  brick:   { repeat: [1, 1] },
  roof:    { repeat: [1, 1] },
  door:    { repeat: [3, 2], offset: [0.25, -0.2] }
}
```

Los valores objetivo deben elegirse visualmente una vez construida la escena.

No usar estos valores de ejemplo literalmente si no producen un resultado correcto.

---

# Evaluación visual

Este ejercicio no debe convertirse en un puzzle numérico estricto.

El objetivo principal es visual.

No exigir que el usuario encuentre exactamente un número específico para considerar la escena “correcta”.

Sin embargo, se puede implementar una tolerancia para permitir una verificación opcional.

Por ejemplo:

```js
Math.abs(current - target) < tolerance
```

Usar tolerancias amplias.

---

# Botón de comprobación

Agregar un botón:

**Comprobar ajuste**

Al presionarlo:

- si los valores están dentro de las tolerancias:
  - mostrar un mensaje positivo;
- si todavía hay materiales muy alejados:
  - indicar qué materiales conviene revisar;
  - no revelar automáticamente los valores correctos.

Ejemplo:

> Casi listo. Revisá la escala de los ladrillos y el encuadre de la puerta.

Evitar puntuaciones o temporizadores.

---

# Referencia opcional

Puede agregarse:

**Ver referencia**

Al activarlo, mostrar una pequeña miniatura de la casa correctamente texturizada.

No debe reemplazar la escena principal.

Puede funcionar como ayuda si el usuario no sabe qué escala visual buscar.

También puede implementarse como toggle:

**Mostrar referencia**

---

# Restablecer

Agregar:

**Restablecer ejercicio**

Debe devolver:

- todos los repeats;
- offsets de puerta;
- selector de material;
- estado de comprobación;

a sus valores iniciales.

No necesariamente debe restablecer la cámara si ya existe un botón separado para eso.

---

# Comportamiento de las texturas

Para los materiales seamless:

```js
texture.wrapS = THREE.RepeatWrapping;
texture.wrapT = THREE.RepeatWrapping;
```

Actualizar:

```js
texture.repeat.set(u, v);
```

Para la puerta, utilizar también:

```js
texture.offset.set(u, v);
```

Asegurarse de que los cambios se reflejen inmediatamente.

---

# Texturas existentes en el proyecto

Las cinco texturas **ya están creadas** y forman parte del proyecto.

No generar, reemplazar ni buscar nuevas imágenes.

Codex debe cargar y utilizar directamente los archivos existentes dentro de la carpeta:

`Maps/`

Archivos:

1. `Maps/pasto.png`
   - textura de pasto;
   - seamless;
   - utilizar para el suelo exterior.

2. `Maps/piedras.png`
   - textura de piedra / empedrado irregular;
   - seamless;
   - utilizar para la plataforma elevada.

3. `Maps/ladrillos.png`
   - textura de ladrillos;
   - seamless;
   - utilizar para las paredes de la casa.

4. `Maps/tejas.png`
   - textura de tejas;
   - seamless;
   - utilizar para el techo a dos aguas.

5. `Maps/puerta.png`
   - textura frontal de una puerta de madera;
   - no seamless;
   - utilizar exclusivamente para la puerta.

Mantener estos nombres y rutas. No renombrar ni mover los archivos salvo que la estructura existente del proyecto lo requiera explícitamente.

Las texturas seamless deben configurarse con `THREE.RepeatWrapping` en los ejes necesarios.

La textura `puerta.png` no debe tratarse como textura seamless. Su ejercicio consiste precisamente en ajustar `repeat` y `offset` para obtener una única puerta correctamente encuadrada.

---

# Cámara inicial

Configurar una vista 3/4 ligeramente elevada desde la que se vean simultáneamente:

- fachada con puerta;
- una pared lateral;
- techo;
- plataforma;
- pasto.

La casa debe ocupar la mayor parte de la columna izquierda.

---

# Geometría

Mantener la geometría deliberadamente simple.

No agregar:

- ventanas;
- chimenea;
- mobiliario;
- vegetación;
- cercos;
- iluminación compleja;
- objetos decorativos.

El foco es exclusivamente la relación entre la superficie y la escala/posición de la textura.

---

# Iluminación

Usar iluminación neutra y suficiente para leer claramente las texturas.

Evitar:

- sombras demasiado fuertes;
- iluminación dramática;
- reflejos que oculten las texturas.

El material puede ser `MeshStandardMaterial` si encaja con la arquitectura actual.

---

# Navegación

El tab debe agregarse como último tab del Capítulo 4.

Orden esperado:

1. Modos de wrapping
2. Offset y Repeat
3. Rotación y centro
4. Comparación libre
5. Animación con sprite sheet
6. **Ajuste de texturas**

No modificar el funcionamiento de los tabs anteriores.

---

# Nombre y textos sugeridos

## Tab

**Ajuste de texturas**

## Encabezado de escena

**ESCENA 3D · CASA TEXTURADA**

## Encabezado de vista central

**TEXTURA ACTIVA**

## Idea principal

> Las texturas seamless se ajustan principalmente mediante repeat para controlar su escala visual. Una textura no periódica, como una puerta, también puede necesitar offset para ubicar correctamente la imagen.

## Consigna

> Ajustá las texturas hasta que la casa tenga una escala visual coherente. Corregí el repeat del pasto, la piedra, los ladrillos y las tejas, y ajustá repeat y offset en la puerta.

---

# Criterios de aceptación

La implementación se considera completa cuando:

- aparece un nuevo tab final en el Capítulo 4;
- se muestra la casa completa con cinco materiales;
- cada material utiliza su propia textura;
- el estado inicial muestra errores visuales evidentes de escala o posición;
- el usuario puede seleccionar un material;
- pasto, piedra, ladrillos y tejas permiten modificar `repeat U/V`;
- la puerta permite modificar `repeat U/V` y `offset U/V`;
- la escena responde en tiempo real;
- la columna central muestra la textura activa;
- existe una consigna clara;
- existe `Restablecer ejercicio`;
- existe una comprobación opcional sin exigir precisión excesiva;
- la UI mantiene el estilo actual del Capítulo 4;
- no se modifica el comportamiento de los tabs existentes.

---

# Prioridad de implementación

Priorizar, en este orden:

1. escena y geometría;
2. aplicación correcta de las cinco texturas;
3. selector de material;
4. controles de repeat;
5. controles de offset de puerta;
6. vista de textura activa;
7. restablecer;
8. comprobación;
9. referencia visual opcional.

No dedicar tiempo a decoraciones o sistemas adicionales antes de que esta interacción principal funcione correctamente.
