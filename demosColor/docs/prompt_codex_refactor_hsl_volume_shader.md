# Prompt para Codex — refactor total de la construcción geométrica y preservación del shading HSL correcto

## Contexto

Este proyecto es una demo en **Three.js** para visualizar el espacio de color **HSL** como un sólido 3D interactivo con controles de rango para:

- `H` = Hue / Tono
- `S` = Saturation / Saturación
- `L` = Lightness / Luminosidad

La demo **funciona parcialmente**.
Actualmente tiene:

- cámara y navegación funcionando
- UI de controles ya armada
- helpers visuales / ejes / flechas / referencias gráficas del espacio HSL
- un **shader custom** que intenta colorear correctamente las superficies usando interpolación de valores HSL
- una lógica de construcción geométrica que **está mal resuelta**

El problema principal no es de UI ni de escena general.
El problema principal es que **la construcción de la malla del volumen recortado de HSL está mal planteada**, y eso contamina el resultado visual.

## Instrucción principal

Quiero que **mantengas la esencia visual y funcional de la demo actual**, pero que **no quedes condicionado por la implementación geométrica existente**.

### Quiero que asumas explícitamente esto:

- la parte actual de construcción del volumen puede estar conceptualmente mal
- si hace falta, **tirala a la basura por completo**
- no intentes “parchar” la geometría actual
- no intentes rescatar una estrategia mala solo porque ya existe
- si el shader actual también está demasiado atado a una estructura incorrecta, **rehacelo también**
- el objetivo es llegar a una solución correcta, limpia y robusta

En resumen:

> Conservá la escena, los controles, el espíritu de la demo, las ayudas visuales y el resultado final buscado.
> Pero rehacé desde cero toda la lógica de generación geométrica y, si hace falta, también la forma en que el shader recibe los datos.

---

# Objetivo final

La demo debe mostrar correctamente el volumen del espacio HSL recortado por rangos:

- `hMin .. hMax`
- `sMin .. sMax`
- `lMin .. lMax`

Y debe hacerlo cumpliendo **dos requisitos simultáneos**:

## A. Geometría correcta

El sólido debe construirse correctamente como un volumen cerrado o semicie rrado según los límites, usando las superficies apropiadas.

## B. Coloración correcta por interpolación HSL

Cada píxel visible de cada cara debe pintarse con el color que le corresponde según sus coordenadas HSL reales dentro del volumen, usando interpolación correcta desde atributos de vértice y/o reconstrucción matemática en shader.

Este segundo punto es **muy importante**.

No quiero una textura “horneada”, ni colores arbitrarios por cara.
Quiero que el color que se ve sobre la superficie corresponda al valor HSL real de cada punto de esa superficie.

---

# Idea conceptual obligatoria

La solución geométrica debe basarse en esta idea:

> El volumen recortado de HSL no se obtiene recortando una malla previa con heurísticas, sino construyendo explícitamente la frontera de la región paramétrica definida por los límites de H, S y L.

La frontera del volumen está compuesta por hasta **seis caras límite**:

1. `H = hMin`
2. `H = hMax`
3. `S = sMin`
4. `S = sMax`
5. `L = lMin`
6. `L = lMax`

La nueva implementación debe construirse a partir de esas caras.

---

# Qué quiero conservar de la demo actual

Quiero conservar, si es posible sin arrastrar errores estructurales:

- la escena general
- la UI actual de sliders / límites
- el sistema de cámara y navegación
- el helper de ejes / flechas / referencias del modelo HSL
- cualquier elemento de debug útil
- el enfoque de shader custom para colorear correctamente

## Pero atención:

Si alguno de esos elementos está demasiado acoplado a la mala implementación actual, desacoplalo y reorganizalo.
No quiero preservar arquitectura mala solo por continuidad.

---

# Qué quiero reemplazar por completo

Quiero que reemplaces por completo la lógica que hoy genera mal el volumen.
Asumí que esa parte debe rehacerse desde cero.

## Más concretamente:

- no quiero clipping improvisado sobre una malla cerrada incorrecta
- no quiero borrar triángulos de una malla vieja
- no quiero booleanas ad-hoc si no son estrictamente necesarias
- no quiero deformaciones de conos ya existentes sin control paramétrico limpio
- no quiero lógica donde la geometría “parece más o menos correcta” pero las caras internas salen mal

---

# Modelo geométrico correcto del espacio HSL

## Coordenadas del modelo

Usar esta convención:

- eje vertical = `Y`
- plano horizontal = `XZ`
- el centro del sólido coincide con el eje `Y`

## Dominio HSL

- `H ∈ [0, 360)` grados
- `S ∈ [0, 1]`
- `L ∈ [0, 1]`

## Radio máximo del sólido según L

El espacio HSL tiene forma bicónica:

```text
rMax(L) = 1 - |2L - 1|
```

equivalente a:

```text
rMax(L) = 2L           para 0 <= L <= 0.5
rMax(L) = 2(1 - L)     para 0.5 < L <= 1
```

## Radio real para un valor de saturación S

```text
r(L,S) = S * rMax(L)
```

## Conversión a XYZ

```text
theta = H en radianes
x = r(L,S) * cos(theta)
y = L
z = r(L,S) * sin(theta)
```

Toda la geometría debe construirse a partir de esta formulación.

---

# Cómo debe construirse la frontera del sólido

## 1) Caras de H constante

Cuando `H = constante`, se obtiene una pared radial vertical.

Parámetros libres:

- `S`
- `L`

Posición:

```text
theta = hConst
r = S * rMax(L)
x = r * cos(theta)
y = L
z = r * sin(theta)
```

Estas caras representan los “cortes de torta” del rango angular.

### Regla:

- Si el rango de hue cubre 360° completos, no deben generarse estas caras.

---

## 2) Caras de S constante

Cuando `S = constante`, se obtiene una superficie bicónica escalada.

Parámetros libres:

- `H`
- `L`

Posición:

```text
r = sConst * rMax(L)
x = r * cos(theta)
y = L
z = r * sin(theta)
```

Casos:

- `S = sMax` → cara exterior
- `S = sMin` → cara interior, solo si `sMin > 0`

### Regla importante:

Si `sMin = 0`, no existe pared interior.

---

## 3) Caras de L constante

Cuando `L = constante`, se obtiene una tapa horizontal en el plano `Y = constante`, cuya forma es:

- disco sectorial, si `sMin = 0`
- sector anular, si `sMin > 0`

Parámetros libres:

- `H`
- `S`

Posición:

```text
r = S * rMax(Lconst)
x = r * cos(theta)
y = Lconst
z = r * sin(theta)
```

Casos:

- `L = lMin`
- `L = lMax`

---

# Requisito central del shader

Este punto es **crítico**:

> No alcanza con construir bien las seis caras.
> También hay que lograr que cada píxel visible reciba el color HSL correcto.

Quiero que el color visible en cada fragmento corresponda al valor HSL real de ese punto de la superficie.

## Eso implica que la estrategia de shading debe estar diseñada junto con la geometría.

La parte actual del shader probablemente intenta hacer esto, pero como la estructura geométrica está mal, también puede estar mal acoplada.

### Quiero que definas una estrategia robusta para que el fragment shader tenga acceso a los valores correctos de H, S y L por fragmento.

---

# Requisito de shading: opciones válidas

Acepto dos enfoques correctos.

## Opción A — pasar HSL como atributos de vértice

Cada vértice debe transportar información suficiente para que el shader pueda interpolar correctamente:

- `h`
- `s`
- `l`

o una variante equivalente, por ejemplo:

- `vec3 hsl`

El fragment shader interpolará esos valores y convertirá HSL a RGB.

## Opción B — reconstrucción parcial en shader a partir de atributos paramétricos

También es válido pasar coordenadas paramétricas de la cara y reconstruir HSL en el vertex o fragment shader, siempre que:

- la interpolación sea consistente
- el resultado final por píxel corresponda al HSL real del punto
- no haya discontinuidades incorrectas

---

# Advertencia importante sobre interpolación angular del Hue

El hue es angular y tiene una discontinuidad en el paso `360° -> 0°`.

Eso significa que no quiero errores de interpolación como estos:

- interpolar linealmente de `350°` a `10°` pasando por `180°`
- generar gradientes erróneos por wrap angular mal resuelto

## Requisito:

Debés manejar correctamente los casos en que el rango de H cruza el 0°.

Ejemplo:

- `hMin = 300`
- `hMax = 40`

Ese sector debe verse continuo y correcto.

## Podés resolverlo de varias maneras, por ejemplo:

- partir el rango angular en dos subrangos
- usar una representación angular continua interna
- almacenar hue como vector unitario circular (`cos(h), sin(h)`) y reconstruirlo luego
- cualquier otra solución robusta

Pero el resultado visual final debe ser correcto.

---

# Lo que espero específicamente sobre shader y atributos

Quiero que pienses la solución desde el principio así:

## La geometría y el shader deben estar diseñados juntos.

No quiero que primero armes una malla “como salga” y después intentes forzar al shader a adivinar el HSL correcto.

Quiero que cada cara se genere con una parametrización clara y con atributos consistentes.

## Ejemplos

### Cara `H = constante`

En esta cara:

- `H` es constante
- `S` varía
- `L` varía

Por lo tanto, tiene sentido que sus vértices almacenen:

- `H = hConst`
- `S = valor del vértice`
- `L = valor del vértice`

### Cara `S = constante`

En esta cara:

- `S` es constante
- `H` varía
- `L` varía

### Cara `L = constante`

En esta cara:

- `L` es constante
- `H` varía
- `S` varía

Esto debe reflejarse explícitamente en la estructura de atributos.

---

# Requisito de arquitectura

Quiero una arquitectura limpia y desacoplada.Sugerencia:

- `HSLVolumeMath`

  - `rMaxFromL(l)`
  - `hslVolumeToCartesian(h, s, l)`
  - helpers de normalización angular
- `ParametricSurfaceBuilder`

  - construye una superficie paramétrica genérica en grilla
  - genera posiciones
  - genera índices
  - genera atributos paramétricos necesarios para shader
- `HSLVolumeBuilder`

  - decide qué caras construir según rangos
  - arma el sólido final
  - resuelve wrap angular si hace falta
- `HSLVolumeMaterial` o equivalente

  - shader material / raw shader / onBeforeCompile
  - conversión HSL → RGB
  - debug de atributos si hace falta
- `HSLVolumeDebug`

  - wireframe
  - colores por cara
  - normales
  - edges
  - marcadores de esquinas

No quiero un archivo enorme con todo mezclado.

---

# Requisito de reconstrucción de superficies

Quiero que cada cara se construya como superficie paramétrica rectangular sobre su dominio local.

## Cara H constante

Dominio local:

- `u = S`
- `v = L`

## Cara S constante

Dominio local:

- `u = H`
- `v = L`

## Cara L constante

Dominio local:

- `u = H`
- `v = S`

Esto permite:

- una triangulación limpia
- bordes coherentes entre caras
- atributos HSL bien definidos por vértice
- depuración sencilla

---

# Requisito de continuidad entre caras

Las caras deben coincidir exactamente en sus bordes compartidos.

No debe haber:

- grietas
- gaps
- z-fighting por solapes innecesarios
- inversión aleatoria de normales
- discontinuidades visuales de color por mala parametrización

Para lograr eso:

- usar siempre la misma función matemática base
- compartir la misma convención angular
- respetar la misma parametrización de borde

---

# Sobre normales y sombreado geométrico

Quiero que el sólido tenga normales correctas y consistentes.

Acepto:

- caras separadas con `computeVertexNormals()`
- o cálculo propio si hace falta
- o duplicación de vértices en bordes duros

Pero el resultado debe verse limpio.

Durante debug, prefiero incluso:

- cada cara por separado
- materiales separados
- posibilidad de activar `DoubleSide`
- helper de normales

---

# Casos especiales que sí o sí deben funcionar

## Caso 1 — volumen completo

- H = `[0, 360]`
- S = `[0, 1]`
- L = `[0, 1]`

Debe verse el bicónico completo.

## Caso 2 — recorte angular

- H = `[30, 120]`
- S = `[0, 1]`
- L = `[0, 1]`

Debe verse como una porción de torta del bicónico.

## Caso 3 — recorte radial

- H = `[0, 360]`
- S = `[0.5, 1]`
- L = `[0, 1]`

Debe verse un cascarón bicónico con hueco interior.

## Caso 4 — recorte de luz

- H = `[0, 360]`
- S = `[0, 1]`
- L = `[0.25, 0.75]`

Debe verse el bicónico truncado arriba y abajo.

## Caso 5 — recorte combinado

- H = `[45, 160]`
- S = `[0.35, 0.9]`
- L = `[0.2, 0.8]`

Debe verse el sólido correcto con todas sus caras.

## Caso 6 — wrap angular

- H = `[300, 40]`
- S = `[0.2, 1]`
- L = `[0.1, 0.9]`

Debe verse continuo y con coloración angular correcta.

---

# Requisito de debug visual

Agregar modo debug para verificar la solución.

Quiero poder activar:

- color distinto por tipo de cara
- wireframe
- edges
- ejes
- normales
- opcionalmente puntos de vértice

## Colores sugeridos por cara en debug

- `H min` → rojo
- `H max` → naranja
- `S min` → azul
- `S max` → verde
- `L min` → violeta
- `L max` → amarillo

Este modo debug es temporal, pero muy útil para validar la construcción.

---

# Qué NO quiero

- no quiero que intentes salvar la mala malla actual
- no quiero hacks visuales para esconder errores
- no quiero clipping por fragment shader como “solución geométrica”
- no quiero confiar en casualidades de triangulación
- no quiero colores aproximados
- no quiero interpolación incorrecta del hue cuando cruza 0°
- no quiero una implementación que “más o menos se vea bien” en un caso pero falle en otros

---

# Qué SÍ quiero

- una refactorización seria
- una base matemática limpia
- geometría armada desde el dominio HSL
- shader coherente con esa geometría
- atributos de vértice bien pensados
- color por fragmento correcto
- soporte para los casos especiales de hue circular
- código entendible y mantenible

---

# Estrategia sugerida de implementación

## Paso 1

Identificar y aislar todo lo relacionado con:

- construcción geométrica actual
- atributos actuales del shader
- dependencias innecesarias entre geometría y material

## Paso 2

Preservar la escena, UI y helpers útiles, pero desconectar la vieja lógica de volumen.

## Paso 3

Implementar la nueva base matemática:

- `rMax(L)`
- `hsl -> xyz volumétrico`
- helpers de rango angular

## Paso 4

Crear un generador genérico de superficies paramétricas que pueda emitir:

- posición
- normal
- atributos HSL o equivalentes para shader
- índices

## Paso 5

Implementar las 6 caras límite del volumen.

## Paso 6

Implementar o rehacer el shader para que el color final por fragmento sea correcto.

## Paso 7

Validar contra los casos de prueba.

## Paso 8

Reintegrar la UI existente con la nueva arquitectura.

---

# Sobre el material / shader

Podés usar:

- `ShaderMaterial`
- `RawShaderMaterial`
- `onBeforeCompile`
- o la estrategia que te resulte más limpia

Pero el shader debe quedar bien estructurado.

## El material ideal debería poder:

- recibir atributos paramétricos por vértice
- interpolarlos en fragment shader
- convertir HSL a RGB correctamente
- opcionalmente tener un modo debug para mostrar:
  - H
  - S
  - L
  - normales
  - cara actual

---

# Sugerencia técnica importante para el hue

Considerá seriamente no pasar el hue solo como escalar bruto si hay riesgo de wrap angular problemático.

Una solución robusta puede ser pasar:

```text
hueDir = (cos(theta), sin(theta))
```

y luego reconstruir el ángulo en shader si lo necesitás, o usar esa representación para evitar interpolación incorrecta alrededor del 0°.

No es obligatorio si encontrás una estrategia mejor, pero quiero que tengas presente este problema desde el diseño.

---

# Entregable esperado

Quiero que entregues:

1. el código refactorizado
2. explicación breve de la nueva estrategia geométrica
3. explicación breve de la estrategia de shading
4. lista de archivos modificados
5. aclaración de cómo resolviste el hue wrap-around
6. cualquier limitación restante o degenerado no cubierto

---

# Criterio final de éxito

Voy a considerar correcta la solución si:

- la geometría del volumen recortado está bien
- las seis caras se generan correctamente cuando corresponde
- el color HSL visible sobre cada cara es correcto por fragmento
- el hue interpola bien incluso cerca del 0° / 360°
- el código queda más limpio que antes
- la demo conserva su utilidad visual y sus controles

---

# Resumen ejecutivo final para evitar confusión

## Hacé esto:

- conservá la demo como producto
- descartá la lógica geométrica mala
- rehacé desde cero la construcción del sólido usando las seis caras límite
- si hace falta, rehacé también la forma en que el shader recibe los atributos
- asegurá interpolación correcta de HSL por fragmento
- resolvé correctamente el problema circular del hue

## No hagas esto:

- no parches la malla actual
- no intentes salvar una arquitectura errónea
- no resuelvas solo “visualmente”
- no ignores el shader, porque pintar bien los píxeles es parte central del problema

Ese es el objetivo.
