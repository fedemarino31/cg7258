# Laboratorio de curvas Bézier 2D — Especificación de implementación para Codex

Versión 1.0 · 15 de septiembre de 2026 · Idioma de interfaz: español

## 0. Instrucción al agente implementador

Implementar una aplicación web completa de escritorio para experimentar con curvas Bézier planas y producir ilustraciones docentes. Este documento es el contrato funcional: no entregar únicamente un prototipo visual, controles desconectados ni un plan. Completar todas las funciones obligatorias, los archivos de ejemplo, las pruebas matemáticas y la exportación. Las etapas del final ordenan el trabajo; no autorizan a recortar el alcance.

Inspeccionar primero el repositorio y sus instrucciones. Si ya existe una aplicación, integrar respetando su estructura y sin destruir trabajo existente. En un repositorio vacío, crear JavaScript moderno con módulos ES, Vite, SVG nativo, Tweakpane y KaTeX. Usar Vitest para cálculo y Playwright para interacciones y exportación. Mantener JavaScript; JSDoc para contratos. Fijar versiones compatibles y conservar el lockfile. Si el proyecto ya usa React, puede conservarse como capa de UI sin introducirlo como requisito nuevo.

No usar Three.js, WebGL, backend, cuentas, base de datos remota ni servicios de IA. No implementar Hermite, Catmull–Rom, B-splines, NURBS ni Bézier racionales. La arquitectura debe separar algoritmos y presentación, sin desarrollar infraestructura de plugins innecesaria.

Resolver decisiones menores siguiendo este contrato. Preguntar solo si una restricción real del repositorio impide cumplirlo. No pedir al usuario escoger bibliotecas, colores o estructuras internas ya decididas aquí. No publicar ni desplegar automáticamente: entregar la aplicación ejecutable en el entorno del repositorio y explicar cómo iniciarla.

## 1. Objetivo y alcance cerrado

El usuario debe poder construir y editar Bézier de grados 1, 2 y 3; explorar sus bases y formulaciones; visualizar De Casteljau, derivadas, normal y curvatura; comparar continuidad entre tramos; controlar discretización; cargar/guardar escenas y extraer imágenes reproducibles para diapositivas.

Todo lo descrito como función en este documento es obligatorio salvo las exclusiones explícitas. Los modos avanzados pueden estar plegados inicialmente, pero deben funcionar. La aplicación permite varias cadenas en una escena y mezcla de grados entre tramos, aunque cada herramienta de creación tenga un grado activo.

Conceptos de dominio:

- **Escena:** puntos, tramos, cadenas ordenadas, anotaciones, referencias congeladas y estado de presentación.
- **Tramo:** una Bézier completa con grado 1–3 y exactamente grado + 1 referencias a puntos.
- **Cadena:** orden de recorrido y de comparación de un conjunto de tramos. No presupone continuidad geométrica.
- **Polígono de control:** polilínea abierta de los puntos de un tramo; no cerrar automáticamente el último con el primero.
- **Borrador:** puntos todavía insuficientes para completar un tramo. Es visible y persistente, pero no evaluable como curva.
- **Unión:** par de tramos consecutivos de una cadena, aunque sus extremos estén separados.
- **Vista guardada:** configuración visual y encuadre sobre la geometría actual; no es otra copia de la geometría.
- **Referencia congelada:** copia explícita de geometría para comparar antes/después; no participa en recorridos ni continuidad.

## 2. Decisiones de producto y diseño

### 2.1 Superficie de trabajo

Fondo blanco; plano cartesiano con X hacia la derecha e Y hacia arriba. Relación de aspecto geométrica 1:1 siempre: un círculo debe verse circular. Separar transformación mundo→pantalla del tamaño visual de rótulos, puntos, flechas y trazos.

SVG nativo para escena y gráficos. Bézier exactas mediante `L`, `Q` y `C`, sin comandos suaves `S`/`T` que introduzcan controles implícitos. La referencia es exacta como representación vectorial; no afirmar exactitud infinita del rasterizado del navegador. Usar polígonos muestreados solo para la capa de discretización y cálculos numéricos auxiliares.

Etiquetas derechas y legibles: no invertir texto al invertir Y. Recomendación: proyectar geometría a coordenadas de pantalla y dibujar rótulos en una capa SVG sin inversión. Mantener grosores y tamaños en píxeles CSS durante el zoom. Un exportado conserva estos tamaños relativos a su tamaño lógico.

### 2.2 Distribución

- Barra superior de 48 px: escena, archivo, ejemplos, deshacer/rehacer, encuadre, modo ilustración y exportar.
- Barra izquierda de 48 px: seleccionar, agregar, borrar, explorar y desplazar.
- Centro: viewport que ocupa todo el espacio disponible.
- Lateral derecho redimensionable, 340 px iniciales, mínimo 300 y máximo 520: pestañas **Controles**, **Bases**, **Continuidad**, **Mediciones**.
- Tweakpane dentro de Controles; el resto son componentes HTML/SVG propios. No intentar construir tablas complejas dentro de Tweakpane.
- Franja inferior de 64 px: selector de cadena y tramo, ámbito local/global, slider, campo numérico, reproducción y velocidad.
- Botón `i` abajo a la izquierda: panel matemático superpuesto y redimensionable, sin desplazar el dibujo.
- Barra de estado discreta: herramienta activa, coordenadas, cantidad de tramos completos y borradores.

Objetivo principal: 1280×720 o más. En 1024×768 el lateral se convierte en panel superpuesto colapsable. En pantallas menores permitir uso básico y avisar suavemente que se recomienda escritorio; no bloquear archivos ni exportación.

### 2.3 Estilo inicial y límites

| Elemento | Valor inicial | Ajuste |
| --- | --- | --- |
| Curva | azul `#2563EB`, 3 px | color y 0.5–12 px |
| Referencia suave en modo manual | `#BFDBFE`, 3 px | color y opacidad |
| Polígono de control | `#64748B`, 1.5 px, dash 5/5 | grosor y dash; siempre discontinuo |
| Punto de control | radio 5 px, borde blanco 1.5 px | radio 2–14 px |
| Punto evaluado | radio 7 px, `#DC2626` | radio y color |
| Tangente | `#D97706`, 2 px | color y escala |
| Normal principal | `#059669`, 2 px | color y escala |
| Segunda derivada | `#7C3AED`, 2 px | color y escala independiente |
| Etiqueta | 15 px, sans-serif, `#172033` | 10–40 px |
| Cuadrícula | `#E5E7EB`, 1 px | visible inicialmente, opacidad |
| Ejes | `#94A3B8`, 1 px | visibles inicialmente |
| Casco convexo | relleno azul al 8%, contorno al 35% | oculto inicialmente |

Base y punto correspondiente comparten una paleta de cuatro colores: `#2563EB`, `#D97706`, `#059669`, `#7C3AED`. Añadir índices/leyendas: el color nunca es la única identificación. Todos los tamaños y colores relevantes son editables en preferencias y se guardan.

## 3. Modelo de datos y reglas invariantes

Usar IDs estables, opacos, únicos dentro de cada escena. Los nombres visibles no son IDs. Guardar coordenadas en unidades del mundo y sin redondearlas a lo mostrado por la UI.

Entidades mínimas:

```js
// Contratos conceptuales; implementarlos mediante JSDoc y esquema JSON.
Point = { id, x, y }
Segment = {
  id, name, degree, pointIds, duration,
  sampling: null | { mode, strategy, subdivisions, tolerancePx },
  style: null | { color, width }, visible
}
Chain = { id, name, segmentIds }
Draft = { id, chainId, degree, creationMode, pointIds, seedSegmentId, orderIndex }
Constraint = { id, leftSegmentId, rightSegmentId, type, enabled, g1HandleLength }
Probe = { id, segmentId, u, label, visible }
LabelOffset = { targetId, role, dx, dy } // píxeles lógicos
```

Invariantes:

1. Cada tramo tiene grado entero 1–3 y exactamente grado + 1 puntos existentes.
2. Cada tramo pertenece a exactamente una cadena. Las referencias congeladas quedan fuera de estas cadenas.
3. Un punto puede compartirse solo como extremo entre tramos consecutivos. Los controles interiores pertenecen a un único tramo. No se permiten ramificaciones ni ciclos de referencias en esta versión.
4. Dos puntos distintos pueden tener idénticas coordenadas: coincidencia geométrica no significa identidad compartida.
5. `duration` es la longitud positiva del intervalo paramétrico global, no segundos de animación. Valor inicial 1; rango admitido `[1e-6, 1e6]`.
6. Los borradores no entran en longitud, bases, continuidad ni exportación por defecto. Sí entran en encuadre de edición.
7. Separar estado documental, selección, cámara y cachés derivados. Ningún objeto DOM/SVG entra en JSON.
8. No guardar valores de continuidad, derivadas o longitud como resultados autoritativos: recalcularlos.

Límites de importación: 10 MiB por archivo, 1000 tramos, 5000 puntos, coordenadas finitas de módulo ≤ 1e9, nombres de hasta 120 caracteres. Rechazar archivos inválidos sin modificar la escena. Los límites protegen respuesta y legibilidad, no implican rendimiento de animación garantizado en su máximo.

## 4. Creación, selección y edición

### 4.1 Creación por clics

Selector de grado 1/2/3 y modo **Independiente / Encadenado**. Predeterminado: cúbica independiente, coherente con ocho puntos para dos tramos. Un clic agrega un punto al final del borrador activo.

- Independiente: consumir grupos de grado + 1 puntos, finalizar un tramo y comenzar borrador vacío. Nunca dibujar la arista entre polígonos de tramos diferentes.
- Encadenado: el primer tramo usa grado + 1 puntos. Cada siguiente tramo comparte el extremo anterior y necesita grado puntos nuevos.
- Cubic independiente: 6 clics → 1 tramo + 2 puntos pendientes; 8 → 2 tramos.
- Cubic encadenado: 7 clics → 2 tramos; 8 → 2 tramos y un nuevo control pendiente más el extremo semilla.
- Etiqueta del borrador: «Faltan N puntos para completar el tramo».
- Cambiar grado o modo durante un borrador no lo reinterpreta: suspender ese borrador y empezar otro. Mostrar los borradores en la lista para continuar o descartar explícitamente.
- `Esc` sale de Agregar y conserva el borrador. Acción «Descartar borrador» lo elimina, sin borrar un extremo compartido con un tramo completo.
- «Nueva cadena» crea otra secuencia independiente. Añadir a una cadena con tramos existentes en modo Encadenado usa su último extremo como semilla.

### 4.2 Selección y movimiento

- Clic en un punto: seleccionarlo y mostrar coordenadas editables.
- Clic en curva: seleccionar tramo; lista lateral equivalente.
- Shift+clic: selección múltiple. Arrastrar fondo en Seleccionar: rectángulo de selección de puntos; Shift suma.
- Arrastrar un punto seleccionado mueve todo el conjunto de puntos seleccionados; un ID compartido se mueve una sola vez.
- Panel permite seleccionar todos los puntos de un tramo/cadena.
- Arrastre limitado a X/Y mediante controles «Eje libre / X / Y». Shift se reserva a selección, no a bloqueo de eje.
- Ajuste a cuadrícula opcional, desactivado inicialmente; aplicado a la propuesta del usuario antes de restricciones.
- Campos numéricos aceptan punto o coma decimal; confirmar con Enter o al perder foco. No interpretar coma como separador de miles.
- Hit area de punto: mínimo 12 px de radio; curva: franja invisible de 12 px. Rótulos no bloquean selección salvo en modo editar etiquetas.
- Prioridad: punto, vector/etiqueta editable, curva, fondo. En solapamientos Alt+clic alterna candidatos y muestra su identidad.

Un arrastre completo produce una sola entrada de deshacer, no una por frame. Escape durante el arrastre revierte esa operación.

### 4.3 Eliminación sin reagrupar puntos

Borrar un control de un tramo completo transforma **solo ese tramo** en borrador con sus puntos restantes. No desplaza puntos de otros tramos ni cambia su grado. Si el punto es un extremo compartido, se retira de todos los tramos que lo referencian y esos tramos pasan a borrador. Antes de confirmar la acción, mostrar en el hover cuáles resultarán afectados; clic ejecuta y se puede deshacer.

Las posiciones originales de esos tramos en la cadena se conservan como posiciones reservadas para completar el borrador. No crear una nueva unión entre tramos situados a ambos lados de una posición incompleta. El recorrido se realiza solo sobre bloques consecutivos completos y el selector indica el bloque activo.

Al completar un borrador generado por borrado, conservar el orden relativo de los controles restantes y agregar los nuevos al final. Esto puede cambiar la forma y los roles de extremo; no intentar adivinar el índice original borrado. Si un control restante era compartido y ahora ocuparía un rol interior, duplicar su ID para ese borrador antes de completarlo. Mostrar vista previa del polígono resultante. Para recuperar exactamente la curva anterior usar Deshacer.

«Eliminar tramo» es una operación distinta: elimina su posición, limpia puntos huérfanos y une el orden de sus vecinos para el diagnóstico, sin unir su geometría. Elimina restricciones y sondas que dependan del tramo; una entrada de deshacer recupera todo.

Para evitar ambigüedad de serialización, `chain.segmentIds` contiene solo IDs completos y `draft` guarda `orderIndex` para su posición reservada, relativo al orden mixto reconstruido. Los IDs de borrador no figuran en `segmentIds`. Crear un validador de orden mixto sin posiciones duplicadas. Borradores nuevos al final también usan `orderIndex`.

### 4.4 Operaciones explícitas

- Duplicar tramo/cadena: nuevos IDs, sin vínculos con originales; desplazar copia 24 px convertidos a mundo.
- Vincular extremos: sobre unión seleccionada, mantener extremo izquierdo y sustituir la referencia inicial derecha por ese ID; no mover controles interiores. Establece C0.
- Desvincular: duplicar ID del extremo derecho conservando coordenadas; inicialmente sigue cumpliendo C0 pero se puede separar.
- Renombrar tramos y cadenas sin cambiar IDs.
- Cambiar orden en lista mediante botones subir/bajar: no cambia geometría; eliminar las restricciones que ya no correspondan a adyacencias, mostrando un aviso no bloqueante.
- Grado activo afecta solo nuevos tramos. La conversión de existentes se hace por elevación de grado, nunca por reinterpretación de sus puntos.
- No implementar reducción aproximada de grado.

## 5. Cámara, cuadrícula y etiquetas

- Rueda: zoom centrado bajo el puntero; botones +/− disponibles.
- Espacio+arrastre o herramienta Desplazar: pan; no capturar Espacio dentro de inputs.
- Escala: `[1e-7, 1e7]` píxeles por unidad, con saturación y sin NaN.
- Cuadrícula adaptativa con pasos 1, 2 o 5 por potencia de 10, buscando 60–120 px entre líneas principales.
- Ajuste a cuadrícula usa paso matemático explícito, inicial 0.25, independiente del cambio visual adaptativo.
- Encuadrar todo: bbox de curvas visibles, polígonos/puntos visibles y borradores; incluir puntos de control da un encuadre conservador válido. No incluir flechas, círculos osculadores ni referencias congeladas salvo opción explícita.
- Encuadrar selección usa solo selección; sin selección se desactiva.
- Margen inicial 10% por lado, mínimo 32 px; nunca estirar un eje. Para un punto o recta de bbox degenerado usar mínimo de 2 unidades por eje antes del ajuste.
- No autoencuadrar durante edición/reproducción. Solo al abrir ejemplo, abrir escena sin cámara válida o pulsar encuadre.
- Rótulos automáticos: `S0`, `S1` y `P0,0`, `P0,1`…; en modo aislado usar `P0`…`P3`. Extremo compartido muestra ambas identidades locales en un único rótulo.
- Etiqueta de tramo cerca de `C(0.5)`, desplazada 14 px; etiquetas de puntos inicialmente a (+10, −10) px de pantalla.
- Resolver colisiones mediante posiciones candidatas alrededor del ancla; prioridad punto evaluado > controles > tramos > muestras. Permitir arrastrar etiquetas en modo «Editar etiquetas». Los offsets manuales prevalecen y se guardan.
- «Restablecer etiquetas» limpia offsets del ámbito seleccionado. No cambiar posiciones manuales al exportar.

## 6. Evaluación matemática: una única fuente de verdad

Usar cálculo analítico, double precision de JavaScript. Ninguna derivada depende del paso de discretización visible. API pura mínima:

```js
evaluate(points, u)
derivative(points, u, order) // order 1 o 2
casteljauLevels(points, u)
bernstein(degree, u)
powerCoefficients(points)
split(points, u)
elevateDegree(points)
curvatureFrame(points, u, tolerance)
analyzeJoin(left, right, mode, tolerance)
```

### 6.1 Formulaciones

Para grado n, `C(u)=Σ Bᵢⁿ(u) Pᵢ`, `Bᵢⁿ(u)=binomial(n,i)(1−u)^(n−i)u^i`, `u∈[0,1]`. Evaluar extremos explícitamente para evitar convenciones ambiguas con potencias nulas.

De Casteljau: `Pᵢ⁰=Pᵢ`; `Pᵢʳ=(1−u)Pᵢʳ⁻¹+uPᵢ₊₁ʳ⁻¹`; `C=P₀ⁿ`. Devolver todos los niveles.

Controles de la primera derivada: `Dᵢ=n(Pᵢ₊₁−Pᵢ)`. Segunda: `Eᵢ=n(n−1)(Pᵢ₊₂−2Pᵢ₊₁+Pᵢ)`. La segunda derivada lineal es `(0,0)`.

Forma cúbica `C(u)=a u³+b u²+c u+d`:

```text
a = -P0 + 3P1 - 3P2 + P3
b = 3P0 - 6P1 + 3P2
c = -3P0 + 3P1
d = P0
```

Cuadrática: `a=P0−2P1+P2`, `b=2(P1−P0)`, `c=P0`, en `a u²+b u+c`. Lineal: `(P1−P0)u+P0`.

Matriz cúbica, con convención explícita:

```text
C(u) = [u³ u² u 1] M [P0 P1 P2 P3]ᵀ
M = [-1  3 -3  1
      3 -6  3  0
     -3  3  0  0
      1  0  0  0]
```

Probar que De Casteljau, Bernstein, polinomio y SVG representan la misma geometría. Bernstein y De Casteljau son formulaciones de la misma curva, no tipos de curva diferentes.

### 6.2 Tolerancias

No usar zoom ni tamaño del viewport para continuidad. Para el tramo o par analizado definir `L=max(1, diagonal bbox de controles)`. Defaults editables: absoluta `1e-9` unidades, relativa `1e-7`, angular `0.01°`.

- Posición: `epsPos=absTol+relTol*L`.
- Comparación de vectores de derivadas: `epsDer=absTol+relTol*max(1,L,|vA|,|vB|)`.
- Casi nulo local: `|C'|<=absTol+relTol*max(1,L)`.
- Curvatura casi cero: `|κs|*L<=relTol`, siempre que la velocidad no sea casi nula.

Mostrar «Cumple dentro de tolerancia», nunca afirmar igualdad simbólica a partir de doubles. Cambiar tolerancias recalcula diagnósticos, no mueve puntos. Estados numéricos no finitos deben producir aviso de cálculo no disponible, no contaminar SVG.

## 7. Recorrido, selección de tramo y reproducción

### 7.1 Parámetro local y global

Local: tramo activo y `u∈[0,1]`. Global: cadena/bloque completo activo, duraciones `hᵢ`, acumulados `aᵢ=Σⱼ<ᵢ hⱼ`, total H. Para `t∈[aᵢ,aᵢ+hᵢ]`, `u=(t−aᵢ)/hᵢ`.

Por defecto `hᵢ=1`: coincide con t=índice+u. Mostrar simultáneamente tramo, u y t, más progreso porcentual global. En límites interiores elegir lado derecho durante reproducción hacia delante; en `t=H` elegir último tramo, u=1. Botones «Lado anterior / Lado siguiente» permiten inspeccionar ambos límites sin epsilon artificial.

Campo numérico muestra 4 decimales por defecto y admite más precisión al escribir. Slider usa paso 0.001 como interacción, pero no redondea la evaluación numérica ni la selección por puntero.

Tramos invisibles siguen perteneciendo al recorrido; al alcanzarlos, el marcador no aparece sobre el dibujo y el panel informa «Tramo oculto». El modo aislado cambia automáticamente el ámbito a local. Salir de aislamiento recupera el ámbito previo.

### 7.2 Explorar con puntero

En herramienta Explorar, clic/arrastre busca el punto más cercano en espacio de pantalla. Usar muestreo inicial + refinamiento acotado sobre intervalos candidatos, incluidos extremos; no depender de la discretización visible. En autocruces, preferir el parámetro cercano al anterior si la distancia difiere menos de 2 px; Alt alterna ramas candidatas. No seleccionar una curva a más de 16 px salvo durante arrastre ya capturado.

### 7.3 Animación

Play/pausa, reiniciar, anterior/siguiente paso y repetición. Duración base de un recorrido completo: 8 segundos a ×1; selector ×0.25/0.5/1/2/4. Avance basado en timestamps de requestAnimationFrame, no conteo de frames. Pausar cuando la pestaña queda oculta; no saltar tiempo al volver. Arrastrar controles o modificar coordenadas pausa la reproducción.

Modo de velocidad:

1. Uniforme en parámetro: t global o u local avanzan linealmente.
2. Uniforme en distancia aproximada: invertir tabla de longitud acumulada independiente de muestras visibles, interpolando u y refinando si hace falta. Mostrar distintivo «Por longitud aproximada» y u real.

En huecos C0 el marcador salta sin dibujar conexión; la distancia del hueco no cuenta como longitud recorrida. Los tramos de longitud cero se omiten en reparto por longitud, pero siguen seleccionables localmente. Si todo mide cero, desactivar reproducción por longitud con motivo.

Construir tabla de longitud mediante subdivisión de De Casteljau hasta que la suma de diferencias polígono−cuerda cumpla tolerancia objetivo `1e-5*max(1,L)` por tramo, o 16384 hojas. Registrar precisión alcanzada; si se llega al límite mostrar aproximación limitada. Incluir extremos, acumular cuerdas y buscar por búsqueda binaria. No reutilizar la polilínea de N subdivisiones.

## 8. Capas didácticas y paneles

### 8.1 Capas y ámbito

Visibilidad global por capa: curva, polígonos de control, puntos, rótulos, muestras, De Casteljau, vectores, círculo osculador, casco convexo, cuadrícula/ejes, sondas y referencias. Además cada tramo puede ocultarse. La curva principal y su polilínea obedecen la misma visibilidad de tramo.

Ámbito de análisis: tramo seleccionado. La escena puede mostrar todos; De Casteljau y vector dinámico se dibujan solo para el activo, salvo sondas fijadas. Tramos no seleccionados conservan color salvo opción «Atenuar otros», que usa opacidad 0.25.

### 8.2 Bases

Panel SVG con ejes u=[0,1], valor=[0,1], leyenda y cuatro colores como máximo. Bases del grado activo, cursor vertical en u, puntos de intersección y tabla de valores. Mostrar suma y fórmula `C(u)=Σ BᵢPᵢ`. Cambiar controles geométricos no cambia las bases. En recorrido global cambiar bases al grado del tramo actual.

Opciones: bases originales / primeras derivadas / segundas derivadas. Para derivadas ajustar Y según extremos del polinomio, incluyendo valores negativos y eje cero. Sus sumas deben ser 0, frente a suma 1 de bases originales. Rótulos y leyenda especifican qué se está graficando.

### 8.3 De Casteljau

Polígono original siempre discontinuo. Niveles auxiliares con trazos continuos finos y colores por nivel: Q naranja, R verde; punto final rojo. Checkboxes por nivel, puntos auxiliares y etiquetas. No mostrar niveles que no existen para el grado. Cúbica: Q0..Q2, R0..R1 y C. Cuadrática: Q0,Q1 y C. Lineal: C entre P0 y P1.

Mostrar fórmula simbólica y valores actuales de cada interpolación en el panel i. Usar `C=lerp(R0,R1,u)` para cúbica y `C=lerp(Q0,Q1,u)` para cuadrática; corregir los índices inconsistentes de las diapositivas originales.

### 8.4 Sondas fijadas

«Fijar evaluación» crea sonda vinculada a segmento/u; hasta 12 por escena. Sigue recalculándose si cambia geometría, y no debe confundirse con una referencia congelada. Cada sonda permite mostrar punto, vectores y/o De Casteljau. Default solo punto y etiqueta `u=…`. Borrar individual/todas. Incluirlas en JSON y exportación si están visibles.

### 8.5 Casco convexo

Calcular por tramo con controles únicos; puntos coincidentes se deduplican solo para el cálculo. Hull de 1 punto o 2 puntos se representa como punto/segmento, sin polígono inválido. Mostrar relleno tenue por debajo de la curva. En aislamiento mostrar solo el casco activo. El polígono de control no debe confundirse con el casco convexo.

### 8.6 Mediciones y gráficos adicionales

Panel muestra C=(x,y), C', C'', norma de C', curvatura con signo y absoluta, radio y longitud aproximada del tramo/cadena. Pestañas de gráficos `x(u)`, `y(u)`, `|C'(u)|`, `κs(u)` con cursor sincronizado. Local u=[0,1]; global t=[0,H] con separadores de tramo y discontinuidades sin puentes. No conectar valores a través de singularidades; mostrar hueco y marcador de singularidad. Permitir elegir derivadas locales o globales, rotulando unidades paramétricas.

## 9. Vectores, normal y círculo osculador

Para velocidad local v=C', aceleración a=C'':

```text
T = v / |v|
Nizq = (-Ty, Tx)
κs = (vx*ay - vy*ax) / |v|³
κ = |κs|
Nprincipal = sign(κs) * Nizq
ρ = 1 / κ
O = C + Nizq / κs
```

Normal principal y centro O requieren velocidad no nula y curvatura no nula. C'' no es la normal y no se etiqueta como tal. Mostrar ambos independientemente. La tangente unitaria T existe cuando v no es casi nulo; normal izquierda puede mostrarse como convención orientada, etiquetada `Nizq`, incluso en rectas. Normal principal se oculta en curvatura cero con explicación.

Binormal opcional activable: `(0,0,sign(κs))` para Frenet cuando está definido, con ⊙/⊗ y leyenda «sale/entra del plano»; no dibujarla como flecha XY. En rectas/inflexiones no asignar una binormal Frenet arbitraria.

Vectores derivada: longitud dibujada = norma matemática × factor editable en px/unidad de derivada, inicial 30; escala independiente para C' y C''. Vectores unitarios: longitud visual inicial 70 px. Modos rotulados inequívocamente. Opcional longitud máxima visual 240 px: si se recorta, punta con marca de corte y valor real en panel. Todas las flechas parten de C(u).

Círculo osculador se proyecta con radio en unidades del mundo (escala isotrópica). Dibujar arco visible sin intentar crear un elemento con radio descontrolado: si radio proyectado supera 1e7 px, ocultar círculo y mostrar «Radio fuera de escala». Mostrar centro y radio solo cuando visibles. En κ≈0: radio infinito, círculo no dibujado. En v≈0: tangente unitaria/curvatura/radio no definidos; C' cero y C'' aún pueden informarse.

## 10. Continuidad, ajuste y restricciones

### 10.1 Diagnóstico

Tabla por unión con columnas unión, C0, G1, C1 y C2. Indicadores de solo lectura: ✓ cumple, ✕ no cumple, — no definido. C0 falso implica C1/C2 falsos; G1 falso si falta C0, no definido si hay C0 pero alguna velocidad es nula. C1 puede cumplirse con ambas derivadas cero; eso no prueba regularidad geométrica.

Comparación predeterminada respecto del parámetro global t:

```text
C0: A(1) ≈ B(0)
C1: C0 y A'(1)/hA ≈ B'(0)/hB
C2: C1 y A''(1)/hA² ≈ B''(0)/hB²
G1: C0, velocidades no nulas, ángulo ≤ tolerancia, producto escalar > 0
```

Selector «Global t / Local u de cada tramo» para comparar también sin factores h. Mostrar hA/hB y advertir que la continuidad paramétrica depende de esa elección. El selector de diagnóstico no cambia las restricciones: estas siempre operan respecto de t. G1 no depende de h positivos.

Detalle de unión: ambos extremos, ambas derivadas, separación, errores vectoriales y ángulo. En el dibujo superponer flechas desde ambos lados, con etiquetas A/B y pequeño desplazamiento de rótulos. Diferenciar G1 de C1 incluso si la forma parece suave.

### 10.2 Ajustes puntuales

Usuario elige unión; izquierda A fija, derecha B modificable. Una sola transacción reversible. Las acciones no se ejecutan al seleccionar diagnóstico.

- Ajustar C0: mover solo B0 hasta An; si ya comparten ID no hacer nada.
- Ajustar G1: primero C0; orientar B1−B0 con la tangente final A, preservando su longitud. Si esa longitud es cero, usar `|An−A(n−1)|`; si A tiene tangente nula, desactivar con motivo. Operación disponible para grados 1–3; para B lineal mueve su extremo final y puede afectar la siguiente unión.
- Ajustar C1: primero C0; para grados n de A y m de B, `B1=B0+(hB/m)*(n/hA)*(An−A(n−1))`.
- Ajustar C2: primero C1; si m≥2, `B2=2B1−B0+[hB²/(m(m−1))]*[n(n−1)/hA²]*(An−2A(n−1)+A(n−2))`. Para A lineal el término de segunda derivada es cero, sin acceder índices negativos. Si B es lineal, permitir solo si la segunda derivada final A es casi cero; de otro modo desactivar y ofrecer elevar B a cuadrática.

Los controles que se modifican pueden ser extremos de B para grados bajos: indicarlo antes de aplicar y recalcular todas las uniones afectadas. No prometer preservar el resto de la cadena.

### 10.3 Bloqueo durante edición

Mantener C0/G1/C1/C2 mediante restricciones dirigidas A→B para pares **cúbica–cúbica**. Esta limitación explícita evita controles dependientes solapados en grados bajos; estos conservan diagnóstico y ajustes puntuales. No es necesario un solucionador general de restricciones.

Permitidos varios bloqueos consecutivos dentro de una cadena abierta. Propagar de izquierda a derecha en orden. Con C0, B0 es dependiente; G1/C1 agregan B1; C2 agrega B2. Controles dependientes muestran candado y no admiten arrastre/edición numérica directa. B3 sigue libre. Desactivar bloqueo libera controles sin moverlos.

Para G1 guardar longitud objetivo del manejador derecho al activar la restricción; panel permite editarla. Si el manejador izquierdo se vuelve nulo, marcar restricción suspendida y conservar el último B1 válido; mantener C0. Reanudar cuando vuelva a ser no nulo. No fabricar direcciones.

Rechazar bloqueo si introduciría ciclo, falta adyacencia, alguno no es cúbico o existe dependencia estructural incompatible. Explicar el motivo junto al control. No aceptar JSON con restricciones habilitadas imposibles ni corregirlo silenciosamente. Duraciones y geometría independientes recalculan dependientes por las mismas fórmulas del ajuste.

Arrastrar selección múltiple que incluye dependientes: mover solo los independientes y resolver una vez; informar «N controles se mantienen por restricción». Un punto compartido está condicionado por su rol de extremo de A, sin duplicar escrituras.

## 11. Discretización

Modo **Suave automático / Manual**; default automático. Automático dibuja únicamente path exacto azul. No mantener miles de muestras ocultas como sustituto de ese path.

Manual: path exacto en azul claro y polilínea principal azul por encima. Mostrar muestras opcionales. No agregar una línea entre tramos separados. Cada tramo incluye extremos. Aplicación «Todos / Seleccionado»; la segunda crea override por tramo, «Restablecer» vuelve al ajuste global.

Estrategias manuales, todas implementadas:

1. **Uniforme en u**: N entero `[1,2048]`, inicial 8; muestras i/N, i=0..N; mostrar Δu=1/N.
2. **Uniforme por distancia aproximada**: mismo N, invertir tabla de longitud independiente; no mostrar Δu constante, mostrar rango de Δu.
3. **Adaptativa visual**: tolerancia `[0.1,20]` px, inicial 1. Subdividir con De Casteljau usando distancia de controles interiores al segmento finito entre extremos y exceso polígono−cuerda como criterios de planitud en pantalla. Manejar extremos coincidentes sin dividir por cero. Profundidad máxima 20 y 8192 aristas por tramo. Si llega al límite, indicarlo. Recalcular al cambiar geometría o zoom; mostrar N resultante.

En modo manual siempre conservar referencia clara, incluso con N alto o si la diferencia ya no es perceptible. No comparar contra un supuesto «paso máximo». Menor Δu implica mayor detalle.

Añadir «Mostrar diferencia» opcional: 256 evaluaciones independientes como mínimo por tramo y distancia a la polilínea; panel informa error máximo observado, explícitamente **estimado**, no cota garantizada. Identificar punto de mayor error. Esta estimación no controla derivadas ni curvatura.

Exportar congela la discretización de la vista actual, incluyendo adaptativa, antes de escalar resolución. Cambiar PNG de 1× a 4× no cambia la geometría didáctica representada.

## 12. Operaciones didácticas avanzadas

### 12.1 Subdivisión exacta

«Dividir aquí» disponible para `1e-4≤u≤1−1e-4` y siempre que las nuevas duraciones sean ≥1e-6. Construir controles de ambos lados con los bordes del triángulo de De Casteljau. Conservar IDs de extremos originales; nuevo extremo central compartido; nuevos IDs para controles interiores. Reemplazar tramo por dos consecutivos.

Duraciones nuevas: `hIzq=h*u`, `hDer=h*(1−u)`. Esto conserva la parametrización global además de la forma. La continuidad local de los dos nuevos tramos puede diferir de la global; explicarlo en el detalle.

Sondas originales: remapear u≤c a izquierdo con u/c; u>c a derecho con (u−c)/(1−c). En igualdad usar lado izquierdo u=1. Selección pasa al izquierdo u=1. Eliminar restricciones incidentes al tramo dividido y explicar que se deben crear de nuevo sobre la nueva topología; Deshacer las recupera. No conservar referencias a IDs obsoletos.

### 12.2 Elevación de grado

Permitir 1→2, 2→3 y 1→3 por dos pasos. Fórmula con extremos conservados: `Qᵢ=(i/(n+1))Pᵢ₋₁+(1−i/(n+1))Pᵢ`, i=1..n. Mantener duración, sondas, nombre y posición en cadena. Nuevos controles interiores, extremos compartidos preservados. No superar grado 3. Preservar forma y parametrización; prueba numérica obligatoria.

### 12.3 Referencias antes/después

«Congelar referencia» copia la geometría seleccionada, su nombre y color; por defecto gris discontinuo, opacidad 0.45. Hasta 8 referencias. No editable geométricamente ni seleccionable por hit test ordinario. Visible/eliminable/exportable desde lista. Mover originales no cambia la referencia.

«Duplicar para comparar» crea geometría editable independiente y puede usar misma posición; evitar offset solo cuando usuario elige «Superponer». Comparar movimiento de controles con referencia congelada cubre influencia global dentro de un tramo.

### 12.4 Transformaciones e invariancia afín

Panel para trasladar, rotar, escalar uniformemente/no uniformemente y reflejar selección. Pivote predeterminado centro del bbox de controles, editable. Aplicar a IDs únicos; preview y aplicar/cancelar, una transacción. Sin perspectiva. Una referencia congelada permite mostrar transformación de curva y polígono. Círculo osculador se recalcula de la curva transformada, no se transforma como si siempre siguiera siendo círculo.

## 13. Panel matemático contextual

Renderizar fórmulas con KaTeX local, sin CDN. Tres pestañas: **De Casteljau**, **Bernstein**, **Polinómica y matriz**. Se ajustan al grado activo. Subpaneles Derivadas, Curvatura y Continuidad. Toggle «Simbólica / Valores actuales»; precisión visual ajustable 2–8 decimales, sin afectar cálculo.

Mostrar claramente convención u local, t global y h. Para cúbica, incluir cuatro bases desarrolladas, forma factorizada, combinación de puntos, coeficientes a/b/c/d y matriz. Para grados bajos usar sus expresiones correctas, no una cúbica artificial con ceros sin explicación.

Propiedades: interpolación de extremos, tangencia cuando derivada no nula, combinación convexa para u∈[0,1], casco convexo, control global dentro del tramo e invariancia afín. Distinguir suavidad interior de un polinomio y condiciones entre tramos.

Copiar fórmula como LaTeX y copiar valores como texto. Botón exportar panel matemático como SVG/PNG independiente; usar un render matemático a SVG (por ejemplo MathJax SVG empaquetado localmente bajo carga diferida) para exportación de fórmulas. No exportar KaTeX HTML mediante foreignObject como única vía: falla en consumidores de SVG. La carga adicional debe ser diferida; no hay requisito de exportar todo el HTML de Tweakpane.

## 14. Persistencia, JSON y catálogo

### 14.1 Formatos

Entregar `schemas/scene.schema.json` y `schemas/catalog.schema.json`, versión entera 1. Objetos raíz:

```json
{
  "format": "bezier-lab-scene",
  "version": 1,
  "title": "Dos cúbicas con C1",
  "geometry": {
    "points": [],
    "segments": [],
    "chains": [],
    "drafts": [],
    "constraints": []
  },
  "presentation": {
    "camera": {"centerX": 0, "centerY": 0, "pixelsPerUnit": 80},
    "settings": {},
    "selection": {"segmentId": null, "pointIds": []},
    "playhead": {"chainId": null, "segmentId": null, "scope": "local", "u": 0.5, "boundarySide": "right", "speedMode": "parameter"},
    "probes": [],
    "labelOffsets": [],
    "references": [],
    "savedViews": []
  },
  "metadata": {"description": "", "tags": []}
}
```

El ejemplo anterior es estructura mínima con defaults, no un catálogo terminado. `settings` debe tener esquema completo implementado, defaults centralizados y serialización de todo ajuste visible. Las importaciones pueden omitir ajustes para usar defaults. No omitirlos al exportar una escena real.

Catálogo:

```json
{
  "format": "bezier-lab-catalog",
  "version": 1,
  "title": "Casos docentes",
  "examples": [
    {
      "id": "join-c1",
      "title": "C1 sin C2",
      "description": "Derivadas primeras iguales, segundas distintas.",
      "tags": ["continuidad"],
      "scene": {},
      "expected": {"joins": []}
    }
  ]
}
```

Cada `scene` debe ser una escena completa válida, no URL externa. `expected` es metadato de pruebas y explicación; nunca reemplaza el cálculo del diagnóstico.

Convenciones de serialización obligatorias:

- `creationMode`: `independent` o `chained`.
- `sampling.mode`: `smooth` o `manual`; `strategy`: `parameter`, `arcLength` o `adaptive`.
- `Constraint.type`: `C0`, `G1`, `C1` o `C2`; `g1HandleLength` es número positivo para G1 y null para el resto.
- `playhead.scope`: `local` o `global`; `speedMode`: `parameter` o `arcLength`.
- `duration` siempre presente en tramos exportados. `seedSegmentId` y IDs de selección admiten null.
- Sin selección o borrador activo, paneles analíticos muestran instrucciones, no valores del último tramo como si siguieran activos.
- Duración de reproducción, dirección de recorrido, repetición, aislamiento y bloque global activo se incluyen en el estado de presentación real, aunque no se enumeren en el ejemplo mínimo. Guardar el bloque mediante el ID de su primer tramo completo; recalcular su extensión al restaurar.
- Cámara se guarda respecto del viewport lógico. Cambiar tamaño de ventana conserva centro y escala, no promete idéntico recorte en otra relación de aspecto. Los exportados conservan la composición elegida.
- `LabelOffset.targetId` puede referir punto, segmento o sonda; `role` distingue rótulo de curva, control, vector o valor u. No usar índices de arrays como identidad persistente.
- Vistas guardadas con referencias obsoletas se toleran al aplicar; referencias estructurales de geometría obsoletas invalidan el archivo.

El implementador debe ampliar el esquema mínimo para representar todos estos campos, no ignorarlos por no aparecer en el JSON abreviado. Documentar el esquema final con un ejemplo completo exportado desde la propia aplicación.

### 14.2 Archivo y recuperación

Menú: Nueva escena, Abrir escena JSON, Guardar escena JSON, Cargar catálogo JSON, Ejemplos incorporados, Restaurar sesión local y Borrar datos locales.

Abrir reemplaza escena solo tras validación. Si hay cambios sin guardar, diálogo Guardar/Descartar/Cancelar. Cargar catálogo agrega ejemplos al selector, sin reemplazar escena. IDs de catálogo en namespace por catálogo para evitar colisiones.

JSON exporta UTF-8, indentación 2, nombres de archivo seguros. Ignorar metadatos desconocidos solo dentro de `metadata`; campos estructurales inválidos producen error con ruta del campo. Rechazar versión futura con explicación. No usar eval ni innerHTML para nombres importados. Validar referencias, roles, topología, restricciones y finitud además del esquema.

Autosave local con debounce de 750 ms y versión de esquema. Default activado, con indicador. Guardar escena actual y catálogos importados; manejar quota excedida sin perder escena en memoria. Al iniciar recuperar automáticamente una sesión válida, con acción Deshacer recuperación/abrir demo inicial. No ejecutar animación al restaurar. «Borrar datos locales» no borra archivos descargados.

### 14.3 Vistas guardadas

Guardar nombre, cámara, visibilidades, estilo, selección, aislamiento, parámetro, panel analítico y discretización. No duplicar geometría ni otras vistas. Aplicar vista no mueve controles. IDs eliminados se ignoran con aviso, sin restaurar geometría vieja. Renombrar/eliminar/restablecer. Exportar JSON conserva vistas.

### 14.4 Historial

Deshacer/rehacer al menos 100 transacciones: geometría, restricciones, estilos, capas, sondas, vistas y cambios de discretización. No registrar frames de reproducción, hover, selección simple ni pan/zoom. Guardar el estado de selección junto a transacciones geométricas para recuperar contexto. Abrir archivo/ejemplo establece un documento nuevo y limpia historial tras el diálogo de cambios pendientes.

## 15. Catálogo obligatorio con coordenadas verificables

Crear archivos independientes en `public/examples/` y un `catalog.json` que los incorpore como escenas completas al generar el build. Además ofrecer descarga del catálogo completo desde la app. No depender de que el usuario tenga el PDF original.

Todas las coordenadas siguientes son en unidades del mundo. Salvo indicación, h=1, IDs independientes incluso si coinciden coordenadas. Los casos de continuidad usan A cúbica:

```text
A = [(0,0), (1,2), (2,2), (3,0)]
A'(1) = (3,-6)
A''(1) = (0,-12)
```

| Archivo | Geometría / configuración | Resultado esperado |
| --- | --- | --- |
| `01-lineal.json` | [(0,0),(4,2)] | C'=(4,2), C''=0, κ=0 |
| `02-cuadratica.json` | [(0,0),(2,3),(4,0)] | En u=.5: C=(2,1.5), C'=(4,0), C''=(0,-12), κ=.75, ρ=4/3 |
| `03-cubica-casteljau.json` | [(0,0),(1,3),(3,3),(4,0)], u=.5 | C=(2,2.25), C'=(4.5,0), C''=(0,-18); niveles visibles |
| `04-sin-c0.json` | A; B=[(4,0),(5,-2),(6,-2),(7,0)] | C0/G1/C1/C2 falsos |
| `05-c0-esquina.json` | A; B=[(3,0),(4,2),(5,2),(6,0)] | C0 sí; G1/C1/C2 no |
| `06-g1-sin-c1.json` | A; B=[(3,0),(5,-4),(6,-3),(7,0)] | C0/G1 sí; C1/C2 no |
| `07-c1-sin-c2.json` | A; B=[(3,0),(4,-2),(5,-2),(6,0)] | C0/G1/C1 sí; C2 no |
| `08-c2.json` | A; B=[(3,0),(4,-2),(5,-6),(6,-4)] | C0/G1/C1/C2 sí |
| `09-inflexion.json` | [(0,0),(1,2),(2,-2),(3,0)] | κs cambia signo en .5, C' no nula allí, radio infinito |
| `10-cuspide.json` | [(.25,-.125),(-1/12,.125),(-1/12,-.125),(.25,.125)] | C'(.5)=0; equivale a ((u−.5)²,(u−.5)³); marco no definido |
| `11-constante.json` | cuatro puntos distintos todos (2,1) | longitud=0, derivadas=0, sin NaN |
| `12-discretizacion.json` | curva de 03, N=4, referencia clara y muestras | 4 aristas, 5 muestras |
| `13-casco-convexo.json` | [(0,0),(4,3),(0,3),(4,0)] | casco visible; curva contenida |
| `14-subdivision.json` | curva de 03 dividida en .25; h=.25/.75 | forma y parametrización global conservadas; C2 global sí, C1 local no |
| `15-elevacion.json` | cuadrática de 02 y su cúbica elevada superpuestas | misma curva para todo u |
| `16-velocidad.json` | [(0,0),(.1,0),(.2,0),(5,0)] | línea geométrica, velocidad paramétrica variable, κ=0 |
| `17-mixta.json` | lineal [(0,0),(1,0)]; cuadrática [(1,0),(1.5,0),(2,1)] | C0/C1/G1 sí; C2 no |
| `18-compartidos.json` | geometría de 07 con ID de extremo compartido | arrastrar extremo mueve ambos; C0 siempre |

En archivos JSON sustituir fracciones por valores numéricos computados, no cadenas. Añadir descripción, etiquetas, valores esperados y configuración visual útil. Casos 14 y 15 se generan con las funciones puras y se verifican contra la curva fuente.

Añadir `19-sentidos-opuestos.json`: A anterior y B=[(3,0),(2,2),(4,3),(6,0)]; C0 sí, G1/C1/C2 no. Añadir `20-borrador.json`: curva de 03 completa y dos puntos pendientes (5,0),(6,2) en modo cúbico independiente; un tramo y un borrador que requiere dos puntos adicionales.

Escena inicial: caso 03, u=.35, curva, controles, etiquetas y tangente unitaria visibles; De Casteljau disponible pero apagado. Panel derecho Controles. Un breve mensaje inicial indica «Arrastrá los puntos o cargá un ejemplo» y se puede cerrar.

## 16. Modo ilustración y exportación

### 16.1 Modo ilustración

Tab oculta chrome (barras, lateral, slider, i y estado). No alterar cámara ni composición: conservar rectángulo de escena en su posición y dimensiones actuales, rellenando el resto con fondo. Salir con Tab/Esc; mostrar ayuda antes de entrar y ocultarla tras 2 s. No bloquear Tab de navegación de teclado cuando el foco está dentro de formularios: usar botón explícito o atajo solo con foco en viewport.

Modo independiente de exportación: no es necesario ocultar controles para exportar; el exportador nunca los incluye. Permitir overlay de marco 16:9/1:1/libre, que no aparece en el archivo final.

### 16.2 Contenidos exportables

- Escena visible.
- Selección geométrica, ajustada con margen.
- Panel Bases o gráfico de mediciones activo.
- Tabla de continuidad.
- Panel matemático/formulación activa.
- Composición escena + panel de análisis activo, 70%/30%, separación 24 px.

SVG autónomo y PNG. Para SVG: estilos explícitos, namespace, viewBox, IDs únicos, sin scripts, manejadores, enlaces remotos, foreignObject ni dependencias CSS externas. Fórmulas a paths SVG. Textos simples con familia sans-serif y caracteres Unicode comprobados. Ofrecer «Texto como trazados» para exportación portable con una fuente local de licencia compatible; conservar texto editable como default. Empaquetar fuente y licencia, no descargarla al exportar.

PNG generado desde el mismo SVG autónomo mediante canvas 2D solo para rasterización. Fondo blanco/transparente. Resoluciones predefinidas 1920×1080 y 3840×2160, dimensiones personalizadas hasta 8192 px por lado y 32 megapíxeles totales; validar antes de asignar canvas y mostrar error recuperable si el navegador no puede exportar.

### 16.3 Reglas de composición

- Mantener aspecto isotrópico, sin estirar el dibujo para llenar formato.
- Dos encuadres: «Vista actual» conserva cámara y usa letterbox si cambia aspecto; «Ajustar contenido» calcula bbox y margen, 8% inicial por lado.
- Grosor y tipografía son tamaños del lienzo lógico: multiplicar resolución PNG no los cambia relativamente a la figura.
- Congelar animación/estado en un snapshot para todo el proceso. No mutar documento ni cámara. Restaurar reproducción solo si estaba activa y la operación terminó sin intervención del usuario.
- Incluir solo capas visibles, con opciones explícitas para rótulos y leyenda. Borradores excluidos por defecto; opción incluir borradores.
- Exportar selección no incluye otras curvas; conservar overlays analíticos asociados a esa selección.
- Tabla de continuidad se renderiza en SVG con textos y filas, no screenshot del HTML.
- Descarga y «Copiar PNG» cuando Clipboard API lo permita; fallback visible a descarga. Sin exigir permiso para guardar por descarga normal.
- Nombre seguro `<escena>-<contenido>-<fecha>.svg/png`, editable.

Prueba obligatoria: SVG descargado se abre solo en navegador con red desactivada y coincide con PNG. No incluir selección UI, hit targets, botones ni tooltips.

## 17. Tweakpane, accesibilidad y comandos

Grupos de Tweakpane: Creación, Selección, Recorrido, Capas, Discretización, Vectores/curvatura, Continuidad/restricciones, Estilo, Cámara/cuadrícula y Sesión. Evitar duplicar controles con estados distintos: todas las vistas conectan al mismo store. Acciones exportar/archivo accesibles arriba y por paleta.

Paleta Ctrl+K con búsqueda en español: agregar, mover, borrar, explorar, nuevo tramo/cadena, encuadrar, aislar, dividir, elevar, congelar referencia, fijar sonda, guardar/cargar, modo ilustración y exportar. Comandos desactivados muestran razón, no desaparecen sin explicación.

| Atajo | Acción |
| --- | --- |
| V / A / D / E / H | Seleccionar / Agregar / Borrar / Explorar / Pan |
| Espacio+arrastre | Pan temporal |
| F / Shift+F | Encuadrar todo / selección |
| I | Aislar tramo, si existe selección |
| Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y | Deshacer / rehacer |
| Supr | Borrar selección conforme a reglas de topología |
| Ctrl+S / Ctrl+O | Descargar escena / abrir escena |
| Ctrl+K | Paleta |
| Tab con foco viewport | Modo ilustración |
| Esc | Cancelar operación o cerrar overlay |

Atajos nunca actúan en input, textarea, contenteditable o diálogo salvo los de ese diálogo. Soportar Cmd equivalente. Botones con nombre accesible, foco visible, tooltips y etiquetas textuales. Valores de diagnósticos no dependen solo del color. Elementos ocultos salen del tab order. No habilitar animación automática si prefers-reduced-motion; exportación y sliders siguen funcionando.

## 18. Arquitectura de implementación

Estructura sugerida, adaptada a repo existente si corresponde:

```text
src/
  math/        bezier, derivatives, continuity, frames, arcLength, hull
  model/       schema, defaults, invariants, commands, history, constraints
  render/      svgScene, transforms, layers, labels, charts
  interaction/ tools, hitTest, shortcuts, selection
  ui/          tweakpane, timeline, inspector, formulas, dialogs, palette
  io/          importExportJson, autosave, svgExport, pngExport, fontPaths
  examples/    fixtureBuilders
public/examples/
schemas/
tests/unit/
tests/e2e/
docs/
```

Matemática pura no importa DOM ni store. Renderizador consume snapshot derivado. Todas las mutaciones pasan por comandos transaccionales. Constraints se resuelven antes de render/diagnóstico. Cachear por revisión de geometría, grado, tolerancia y cámara solo cuando corresponde. No recalcular bases al mover un punto; no reconstruir Tweakpane por frame.

Render en demanda: requestAnimationFrame solo durante cambios/animación. Evitar crear y destruir todo el SVG en cada tick; reutilizar elementos por ID. ResizeObserver actualiza viewport sin autoencuadrar. Longitud se invalida por geometría, no por cámara. Adaptativo visual sí se invalida por cámara.

Objetivo de respuesta: con 50 cúbicas, un tramo analizado, sin muestreo máximo, arrastre y animación cercanos a 60 fps en escritorio moderno. Medir en equipo disponible y reportar escenario/resultado, sin prometer hardware universal. Para densidades grandes ocultar solo etiquetas automáticas de muestras si se supera un presupuesto visual indicado; nunca quitar geometría ni alterar cálculo silenciosamente.

## 19. Pruebas obligatorias y criterios de aceptación

### 19.1 Matemática

- Extremos y equivalencia de las tres formulaciones para grados 1–3, varios u incluidos 0 y 1.
- Bases suman 1; derivadas de bases suman 0; bases no negativas en [0,1].
- Derivadas analíticas contra valores exactos de fixtures y diferencias finitas solo como comprobación secundaria lejos de singularidades.
- Tabla del catálogo: C0/G1/C1/C2 con resultados esperados, incluido G1 falso por sentidos opuestos y tangentes nulas.
- Dependencia de C1/C2 de duraciones: dividir conserva continuidad global, no necesariamente local.
- Split y elevación conservan curva, extremos y parametrización según remapeo en al menos 101 muestras y tolerancia 1e-9 relativa a escala.
- Círculo osculador del caso cuadrático: centro (2,1/6) en u=.5, radio 4/3; normal hacia abajo.
- Inflexión: κ=0 con velocidad no nula; cúspide: velocidad nula y marco indefinido; constante: longitud cero.
- Discretización uniforme genera N+1 muestras y N aristas; N=1 produce cuerda, no curva exacta oculta como resultado.
- Hull, controles coincidentes, extremos coincidentes en adaptativo y tablas de longitud degeneradas sin NaN.
- Restricciones cúbicas se propagan de izquierda a derecha y deshacer recupera todos los puntos.
- JSON round-trip preserva IDs, compartición, valores double, cámara, vistas y sondas.

### 19.2 Flujos de usuario con Playwright

1. Crear cúbicas independientes: seis y ocho clics producen los conteos previstos.
2. Crear encadenadas: siete puntos generan dos tramos con extremo realmente compartido.
3. Mover control, editar coordenadas y deshacer/rehacer sin cambiar IDs.
4. Borrar punto compartido produce borradores afectados; no reagrupa el resto ni inventa una unión a través de hueco reservado.
5. Cargar ejemplo sin C0; recorrer global y comprobar ausencia de línea artificial.
6. Seleccionar/aislar tramo; slider local muestra punto correcto, bases correctas y tangente analítica.
7. Cambiar N de 4 a 16 y verificar que C(u), tangente y curvatura no cambian.
8. Activar De Casteljau, fijar sondas y exportar con esas capas.
9. Ajustar G1/C1/C2 y comprobar tabla; bloqueo impide editar dependientes y se puede liberar.
10. Dividir, elevar y congelar referencia; comprobar superposición antes/después y guardado.
11. Zoom/pan/encuadre; etiquetas siguen derechas y grosores conservan tamaño visual.
12. Exportar SVG y PNG, abrirlos y verificar tamaño, fondo, capas y ausencia de controles UI.
13. Exportar panel de fórmulas autónomo y tabla de continuidad.
14. JSON inválido no modifica escena; sesión válida se recupera; quota excedida muestra aviso.
15. Abrir escena con borrador y vistas guardadas; aplicar vista no modifica geometría.
16. Captura en 1280×720 y 1920×1080 sin controles cortados ni solapamientos graves.

### 19.3 Revisión visual y entrega

Guardar capturas de QA de: De Casteljau, bases, continuidad, discretización gruesa, curvatura, modo ilustración y exportación. Inspeccionarlas y corregir problemas antes de terminar. Probar navegación por teclado y herramientas en Chrome/Edge actual; usar Firefox si está disponible, e informar límites verificados.

No alcanza con que build compile. Para dar por terminada la tarea deben funcionar creación, diagnóstico, carga/guardado y exportación real. Un botón sin acción o una fórmula placeholder incumplen el contrato.

## 20. Orden de implementación y entregables

1. Inspección del repo; defaults y contratos; esquema JSON; núcleo matemático con fixtures exactos.
2. Store, comandos, historial y topología; creación independiente/encadenada; SVG, cámara y edición.
3. Parámetros, reproducción, bases, De Casteljau, mediciones y vectores.
4. Continuidad, ajustes y restricciones; discretización de tres estrategias; split/elevación, referencias y transformaciones.
5. Catálogo completo, autosave, vistas, panel matemático y paleta.
6. Exportación SVG/PNG y paneles, modo ilustración, accesibilidad y pulido.
7. Pruebas integrales, inspección visual, documentación y reporte de verificación.

Entregar:

- Código completo integrado, sin TODO funcionales del alcance obligatorio.
- Catálogo JSON y cada escena individual, con metadatos esperados verificables.
- Esquemas JSON y documentación del formato.
- README con instalación, desarrollo, build, tests y cómo agregar ejemplos.
- `docs/guia-rapida.md`: crear, analizar, ilustrar y exportar.
- `docs/decisiones.md`: decisiones relevantes y limitaciones explícitas de esta versión.
- Scripts `dev`, `build`, `test`, `test:e2e` y `preview`, o equivalentes del repositorio.
- Reporte final breve: funciones implementadas, comandos de verificación ejecutados y cualquier fallo concreto pendiente. No afirmar verificado lo no ejecutado.

## 21. Referencias de consulta

La presentación suministrada aporta el objetivo didáctico; esta especificación es autocontenida y corrige índices LERP y la distinción G1/C1. No copiar errores del PDF por fidelidad visual.

- [SVG y Bézier](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorials/SVG_from_scratch/Paths).
- [Tweakpane](https://tweakpane.github.io/docs/).
- [Derivadas y continuidad Bézier](https://pages.mtu.edu/~shene/COURSES/cs3621/NOTES/spline/Bezier/bezier-der.html).
- [Curvatura](https://mathworld.wolfram.com/Curvature.html).
- [Normal](https://mathworld.wolfram.com/NormalVector.html) y [binormal](https://mathworld.wolfram.com/BinormalVector.html).

Consultar documentación oficial vigente al integrar dependencias. Las fórmulas, fixtures y criterios de aceptación de este documento tienen precedencia sobre aproximaciones informales de la interfaz.
