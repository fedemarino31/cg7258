# Laboratorio de Texturas — Fase 4

## Wrapping y transformaciones de textura

## 1. Objetivo de la fase

Construir el capítulo dedicado a explicar qué ocurre cuando las coordenadas UV salen del dominio unitario `[0,1] × [0,1]` y cómo distintos modos de wrapping y transformaciones de textura modifican la forma en que se consulta una textura.

La fase debe conservar el lenguaje visual y de interacción de los capítulos ya implementados:

- escena 3D en la columna izquierda;
- visualización conceptual del espacio UV en la columna central;
- controles mínimos y explicación breve en la columna derecha;
- subpestañas superiores para separar experimentos;
- sincronización entre la vista 3D y la vista UV;
- botón de restablecer estado;
- opción `Mostrar wireframe` cuando haya una malla relevante.

La prioridad es que el efecto sea visible y pedagógico, evitando paneles o controles que no aporten a la comprensión.

---

## 2. Idea principal

> El wrapping define qué ocurre cuando las coordenadas UV salen del rango `[0,1]`, mientras que `offset`, `repeat`, `rotation` y `center` transforman las coordenadas antes de consultar la textura.

---

## 3. Principio didáctico fundamental

Para que `RepeatWrapping`, `MirroredRepeatWrapping` y `ClampToEdgeWrapping` puedan observarse claramente, las coordenadas UV de la geometría deben cubrir un rango mayor que el cuadrado unitario.

No alcanza con aplicar una textura a una geometría cuyos UV permanezcan siempre entre `0` y `1`.

En los presets de esta fase, los UV deben extenderse deliberadamente fuera de ese rango. Por ejemplo:

- `u ∈ [-2, 3]`
- `v ∈ [-2, 3]`

La vista UV central debe mostrar explícitamente ese dominio extendido y destacar el cuadrado original `[0,1] × [0,1]`.

---

## 4. Estructura del capítulo

Se propone dividir la fase en cuatro subpestañas:

1. **Modos de wrapping**
2. **Offset y Repeat**
3. **Rotación y centro**
4. **Comparación libre**

La primera subpestaña es el núcleo conceptual del capítulo. Las restantes muestran cómo Three.js transforma las coordenadas de textura antes del muestreo.

---

# 5. Subpestaña 1 — Modos de wrapping

## Objetivo

Comparar directamente:

- `THREE.ClampToEdgeWrapping`
- `THREE.RepeatWrapping`
- `THREE.MirroredRepeatWrapping`

Los efectos deben poder configurarse independientemente en los ejes `S/U` y `T/V`.

## Vista 3D

Mostrar una geometría cuyos UV excedan claramente `[0,1]`.

### Geometrías disponibles

Usar pocos casos, seleccionables desde un control simple:

- **Plano**
- **Cilindro sin tapas**
- **Cubo o caja rectangular**

Opcionalmente puede incluirse una cuarta geometría solo si aporta algo visualmente distinto.

### Plano

Es el caso más importante y debe ser el preset inicial.

Debe tener UV escalados para cubrir varias unidades, por ejemplo:

```text
u: -2 → 3
v: -1 → 2
```

Esto permite observar inmediatamente qué ocurre fuera del dominio unitario.

### Cilindro

Debe utilizar UV que excedan al menos el rango horizontal.

Puede servir para observar:

- repetición alrededor del perímetro;
- inversión alternada con mirrored repeat;
- extensión del borde de la textura con clamp.

### Caja rectangular

Permite comprobar el mismo efecto sobre varias caras y con cambios de orientación espacial.

No debe convertirse en una demostración de unwrap; el objetivo sigue siendo exclusivamente el wrapping.

---

## Vista central — espacio UV extendido

Mostrar un dominio aproximado:

```text
U: -2 → 3
V: -2 → 3
```

Debe incluir:

- ejes `u` y `v`;
- cuadrícula por unidades enteras;
- cuadrado `[0,1] × [0,1]` claramente destacado;
- textura original dentro del cuadrado base;
- resultado conceptual fuera del dominio según el modo de wrapping activo.

### ClampToEdgeWrapping

Fuera del dominio `[0,1]`, visualizar cómo se extienden los texels del borde.

Debe quedar especialmente evidente en las cuatro direcciones.

### RepeatWrapping

Mostrar la textura repetida idénticamente en cada celda entera del espacio UV.

### MirroredRepeatWrapping

Mostrar alternancia de orientación entre celdas consecutivas.

La textura elegida debe permitir distinguir claramente cuándo una repetición está reflejada.

---

## Controles

Mantener el panel reducido.

### Geometría

- Plano
- Cilindro
- Caja

### Textura

- Patrón numerado
- Motivo central
- Flechas direccionales

### Wrapping U

- Clamp
- Repeat
- Mirrored Repeat

### Wrapping V

- Clamp
- Repeat
- Mirrored Repeat

### Opcionales

- Mostrar wireframe
- Mostrar cuadrado UV base
- Restablecer

No agregar controles avanzados en esta subpestaña.

---

# 6. Texturas de prueba

La fase debe incluir tres texturas diseñadas específicamente para que cada modo de wrapping sea fácil de leer.

## Textura A — Patrón numerado

Una cuadrícula de celdas con números, letras o símbolos grandes.

Ejemplo conceptual:

```text
A1 | A2 | A3
B1 | B2 | B3
C1 | C2 | C3
```

Características:

- orientación inequívoca;
- colores contrastantes;
- borde claramente visible;
- no debe ser seamless.

Sirve para:

- identificar repetición;
- detectar reflejo;
- detectar orientación;
- reconocer costuras.

---

## Textura B — Motivo central con bordes planos

Diseñar una imagen con:

- fondo blanco o color uniforme;
- un motivo grande en el centro;
- borde exterior también uniforme.

Por ejemplo:

- un cuadrado de color en el centro;
- un círculo;
- una letra grande;
- una figura geométrica simple.

Esta textura es particularmente útil para `ClampToEdgeWrapping` porque, fuera de `[0,1]`, los píxeles del borde se prolongan sobre la superficie.

El resultado debe ser claramente distinto de una repetición.

---

## Textura C — Flechas direccionales

Una textura con una o más flechas muy visibles indicando, por ejemplo:

```text
→
```

o una combinación de flechas horizontales y verticales.

Debe ser fuertemente asimétrica.

Sirve especialmente para demostrar `MirroredRepeatWrapping`, ya que cada repetición alterna su orientación.

---

# 7. Presets didácticos

Además de permitir selección libre de geometría y textura, conviene ofrecer tres presets iniciales que garanticen un resultado pedagógico claro.

## Preset 1 — Repeat

- geometría: plano;
- textura: patrón numerado;
- UV: varias repeticiones en U y V;
- `wrapS = RepeatWrapping`;
- `wrapT = RepeatWrapping`.

Resultado esperado: mosaico visible tanto en UV como sobre la geometría.

## Preset 2 — Clamp

- geometría: plano ancho;
- textura: motivo central con borde blanco;
- UV: rango mayor que `[0,1]`;
- `wrapS = ClampToEdgeWrapping`;
- `wrapT = ClampToEdgeWrapping`.

Resultado esperado: el motivo aparece una sola vez y los texels exteriores se extienden sobre el resto de la superficie.

## Preset 3 — Mirrored Repeat

- geometría: plano o cilindro;
- textura: flechas direccionales;
- UV: varias unidades;
- `wrapS = MirroredRepeatWrapping`;
- `wrapT = MirroredRepeatWrapping`.

Resultado esperado: orientación alternada entre repeticiones consecutivas.

---

# 8. Subpestaña 2 — Offset y Repeat

## Objetivo

Mostrar que `offset` y `repeat` modifican las coordenadas utilizadas para consultar la textura.

No deben explicarse solo como propiedades abstractas de `THREE.Texture`; la transformación debe verse simultáneamente en el espacio UV y en la geometría.

## Vista 3D

Usar inicialmente un plano amplio con textura de patrón numerado.

El usuario debe poder mover y escalar la textura mediante los controles.

## Vista UV

Mostrar:

- dominio UV original de la geometría;
- textura o dominio transformado;
- referencia visual del cuadrado `[0,1]`;
- cambio producido por `offset` y `repeat`.

Puede mostrarse un rectángulo superpuesto que represente la región de textura consultada después de la transformación.

## Controles

### Offset

- `offset.x`
- `offset.y`

### Repeat

- `repeat.x`
- `repeat.y`

Valores iniciales:

```text
offset = (0, 0)
repeat = (1, 1)
```

Rangos sugeridos:

```text
offset: -2 → 2
repeat: 0.25 → 6
```

Agregar:

- preset `1 × 1`;
- preset `2 × 2`;
- preset `4 × 4`;
- Restablecer.

---

# 9. Subpestaña 3 — Rotación y centro

## Objetivo

Mostrar el efecto de:

- `texture.rotation`
- `texture.center`

La prioridad es explicar que la rotación se realiza alrededor de un centro configurable en el espacio UV.

## Vista 3D

Utilizar un plano con una textura claramente orientada, preferentemente la textura de flechas.

## Vista UV

Representar:

- cuadrado UV;
- centro de rotación como punto visible;
- textura o región de consulta antes de rotar;
- textura transformada;
- arco o indicador angular sencillo.

## Controles

- rotación: `-180° → 180°`;
- `center.x`: `0 → 1`;
- `center.y`: `0 → 1`;
- presets para centro:
  - `(0,0)`;
  - `(0.5,0.5)`;
  - `(1,1)`.

El preset inicial debe usar:

```text
center = (0.5, 0.5)
```

para que el comportamiento resulte intuitivo.

---

# 10. Subpestaña 4 — Comparación libre

## Objetivo

Permitir combinar en un único espacio todas las propiedades vistas en el capítulo sin agregar nuevos conceptos.

Debe funcionar como un pequeño laboratorio de exploración.

## Controles disponibles

- geometría;
- textura;
- `wrapS`;
- `wrapT`;
- `offset.x`;
- `offset.y`;
- `repeat.x`;
- `repeat.y`;
- `rotation`;
- `center.x`;
- `center.y`;
- wireframe;
- restablecer.

Esta subpestaña puede tener más controles que las anteriores porque su propósito es integrar lo aprendido.

No agregar nuevos parámetros fuera de los definidos para el capítulo.

---

# 11. Sincronización entre las dos vistas

La sincronización debe ser uno de los aspectos centrales de la implementación.

Al modificar cualquier propiedad:

1. se actualiza inmediatamente la textura en la geometría 3D;
2. se actualiza simultáneamente la representación del dominio UV;
3. ambas vistas deben representar exactamente el mismo estado.

Cuando sea posible, mostrar también un punto UV de prueba.

Por ejemplo:

```text
uv original      = (1.35, -0.40)
uv transformado  = (...)
uv luego wrapping = (...)
```

No hace falta convertir esto en un inspector numérico complejo. Puede mostrarse solo como una pequeña lectura junto al punto seleccionado.

---

# 12. Orden conceptual de la transformación

La aplicación debe dejar clara la diferencia entre:

1. UV almacenado en la geometría;
2. transformación de textura;
3. aplicación del wrapping;
4. consulta final al sampler.

Representación conceptual:

```text
UV de la malla
    ↓
offset / repeat / rotation / center
    ↓
UV transformado
    ↓
wrapS / wrapT
    ↓
coordenada final de textura
    ↓
sampler
```

No es necesario introducir todavía filtrado `Nearest` o `Linear`; eso corresponde al capítulo siguiente.

---

# 13. Implementación en Three.js

Usar las propiedades estándar de `THREE.Texture`:

```js
texture.wrapS
texture.wrapT
texture.offset
texture.repeat
texture.rotation
texture.center
```

Modos:

```js
THREE.ClampToEdgeWrapping
THREE.RepeatWrapping
THREE.MirroredRepeatWrapping
```

Al cambiar `wrapS` o `wrapT`, asegurar la actualización adecuada de la textura.

No implementar un sistema propio de wrapping en shader salvo que sea necesario únicamente para la visualización conceptual de la columna UV.

La vista 3D debe utilizar el comportamiento real de Three.js.

---

# 14. Generación o modificación de UV

Para las geometrías de demostración, generar o modificar los UV de forma explícita para garantizar que excedan `[0,1]`.

Ejemplo conceptual para un plano:

```js
u *= 4.0;
v *= 3.0;
```

O desplazarlos para incluir valores negativos:

```js
u = u * 4.0 - 1.5;
v = v * 3.0 - 1.0;
```

La geometría utilizada en esta fase debe permitir inspeccionar claramente estos valores.

Evitar esconder el efecto utilizando solamente `texture.repeat`; el objetivo del primer experimento es demostrar wrapping sobre UV realmente exteriores al dominio `[0,1]`.

---

# 15. Diseño visual de la vista UV

Mantener el estilo visual de los capítulos anteriores.

Elementos recomendados:

- fondo neutro;
- grilla fina;
- líneas más fuertes para coordenadas enteras;
- eje `u` horizontal;
- eje `v` vertical;
- cuadrado `[0,1]` destacado;
- textura claramente visible;
- valores enteros alrededor del dominio extendido;
- sin elementos decorativos innecesarios.

La representación debe poder entenderse de un vistazo.

---

# 16. Qué no debe incluir esta fase

No incorporar todavía:

- `NearestFilter`;
- `LinearFilter`;
- minification;
- magnification;
- mipmaps;
- anisotropía;
- cálculo de huella de píxel;
- PBR;
- normal maps;
- cálculo de memoria.

Esos conceptos corresponden a capítulos posteriores.

Tampoco convertir este capítulo en una demostración de unwrap o atlas; esos conceptos ya fueron tratados en las fases anteriores.

---

# 17. Criterios de finalización

La fase puede considerarse terminada cuando:

- los tres modos de wrapping se distinguen claramente en la vista 3D;
- la geometría utiliza UV fuera de `[0,1]`;
- la vista central muestra el dominio UV extendido y el comportamiento fuera del cuadrado unitario;
- `wrapS` y `wrapT` pueden configurarse independientemente;
- las tres texturas de prueba permiten identificar claramente repeat, clamp y mirror;
- `offset` y `repeat` se visualizan tanto en 3D como en UV;
- `rotation` y `center` se visualizan en ambas vistas;
- existe una pestaña final de comparación libre;
- la interfaz conserva la estética y estructura de los capítulos 1–3;
- los controles siguen siendo mínimos y orientados a la demostración.

---

# 18. Resultado esperado

Al terminar la fase, el usuario debe poder comprender visualmente que una textura no termina necesariamente en el borde del cuadrado `[0,1]`.

Debe poder observar que una coordenada UV exterior puede:

- quedar fijada al borde;
- repetirse periódicamente;
- repetirse alternando reflexión;

y que, antes de ese proceso, las coordenadas pueden desplazarse, escalarse y rotarse mediante las propiedades de la textura.

La experiencia debe preparar directamente el capítulo siguiente: **muestreo y samplers**, donde la pregunta dejará de ser “¿qué coordenada de textura consultamos?” para pasar a ser “¿cómo obtiene la GPU un valor a partir de esa coordenada?”.
