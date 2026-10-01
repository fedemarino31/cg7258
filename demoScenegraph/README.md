# Grafo de escena 2D

Aplicación para ver, armar y animar grafos de escena 2D (transformaciones T, R, E en las aristas)
y para generar ejercicios de parcial sin superposición de formas.

> `generadorEjerciciosParcial/` es solo la referencia vieja (Three.js + GoJS) y se puede borrar:
> esta aplicación no depende de ella. Los ejemplos viejos ya están convertidos en `public/ejemplos/`.

## Índice

1. [Puesta en marcha](#puesta-en-marcha)
2. [Uso de la aplicación](#uso-de-la-aplicación)
3. [Generar ejercicios automáticamente](#generar-ejercicios-automáticamente)
4. [Otras herramientas](#otras-herramientas)
5. [Estructura del proyecto](#estructura-del-proyecto)
6. [Formato de archivo](#formato-de-archivo-v2)
7. [Convenciones](#convenciones)

## Puesta en marcha

Requiere [Node.js](https://nodejs.org) 20 o superior.

```bash
npm install
npm run dev          # servidor de desarrollo (http://localhost:5173)
npm run build        # sitio estático en dist/ (publicable en GitHub Pages)
npm test             # tests del núcleo (vitest)
```

## Uso de la aplicación

Tres columnas: **escena** (izquierda), **grafo** (centro) y **panel de opciones** (derecha); barra de menús arriba y línea de tiempo abajo.

- **Cargar**: *Archivo ▸ Abrir ejemplo*, *Importar JSON* (formato nuevo o el viejo) o *Nuevo (en blanco)*.
- **Animar la construcción**: ▶ en la línea de tiempo. De las hojas hacia la raíz, cada hijo nace en el origen del padre
  y ejecuta las operaciones de su arista **de derecha a izquierda**, uno después del otro; el subárbol queda como un bloque.
  Se puede arrastrar la barra, avanzar por operación (← →) o por etapa, pausar (espacio) y cambiar la velocidad.
- **Aislar** un subárbol: seleccioná un nodo y tocá «Aislar». El botón pasa a «✕ Salir del aislamiento» (azul) para volver.
- **Pan y zoom de la escena**: rueda = zoom, arrastrar = mover, «⤢ Encuadrar» o doble clic = vista inicial.
  Debajo de la grilla hay una referencia de ejes (flecha roja X, flecha verde Y).
- **Editar el grafo**: agregar forma o contenedor, duplicar, borrar (Supr), reordenar con ◀ ▶, y cambiar el padre
  arrastrando un nodo sobre otro. Deshacer/rehacer con Ctrl+Z / Ctrl+Y; se autoguarda en el navegador.
- **Editar una fórmula** (panel derecho ▸ Nodo): chips reordenables con arrastrar y soltar, «+» al principio y al final,
  parámetros con campos y sliders, o escribir la fórmula (`T(10,0)*R(45)*E(2,2)`).
  El **paso** de los controles se elige entre 0.1 (por defecto), 0.25, 0.5 y libre.
- **Explorar un nodo**: matriz respecto del padre y de mundo, su descomposición en posición/rotación/escala
  y la cadena de productos de matrices desde la raíz. Con el mouse sobre un factor se dibuja en la escena el marco de ejes resultante.
- **Modelos** (pestaña Modelos): 8 primitivas (rectángulo, círculo, triángulo isósceles, triángulo rectángulo, semicírculo,
  hexágono, trapecio, forma L), cada una con letra y color propios y una marca de orientación para detectar rotaciones y espejados.
  Los ejes locales XY de cada modelo se dibujan siempre.
- **Validación en vivo**: formas superpuestas o fuera de la grilla se marcan en rojo (indicador arriba a la derecha).
- **Práctica**: oculta la escena y/o las fórmulas hasta «Revelar».
- **Imprimir / exportar** (*Archivo ▸ Imprimir*): hoja A4 en tres variantes (enunciado 1: dado el grafo, dibujar la escena;
  enunciado 2: dada la escena, completar las transformaciones; solución). PDF con el cuadro de impresión del navegador,
  más SVG y PNG de la escena y del grafo.

## Generar ejercicios automáticamente

Los ejercicios generados cumplen siempre estas condiciones: **ninguna forma se superpone con otra**, todo queda dentro de la
grilla (a 5 unidades o más del borde) y se usan al menos 2 modelos. Con la misma semilla y los mismos parámetros sale
siempre el mismo ejercicio.

### Desde la aplicación

Botón **Generar…** en la barra superior. Reemplaza el ejercicio abierto. Podés pasarlo a otro lado con *Archivo ▸ Exportar JSON*.

### Desde la consola: `generar.bat`

Atajo de Windows para no escribir el comando largo (instala las dependencias solo la primera vez):

```bat
generar                       :: 1 ejercicio, dificultad media, semilla al azar
generar 10                    :: 10 ejercicios
generar 10 dificil            :: 10 ejercicios difíciles
generar 5 facil 42            :: 5 ejercicios fáciles desde la semilla 42 (42, 43, 44, 45, 46)
```

Forma corta: `generar [cantidad] [dificultad] [semilla]`.
Si el primer argumento empieza con `-` se pasa todo tal cual al generador, así que se pueden usar todas las opciones:

```bat
generar --n 10 --dificultad media --formas 6-9 --modelos 4 --tipos rectangulo,circulo,hexagono
generar --n 3 --seed 100 --out C:\mis-ejercicios
generar --help
```

En cualquier sistema (o sin el `.bat`) es equivalente a:

```bash
npm run generar -- --n 10 --seed 42 --dificultad media
node tools/generar.js --help
```

### Opciones

| Opción | Descripción | Por defecto |
|---|---|---|
| `--n N` | cantidad de ejercicios | `1` |
| `--seed S` | semilla del primero; los siguientes usan S+1, S+2… | al azar |
| `--dificultad D` | `facil`, `media` o `dificil` | `media` |
| `--modelos N` | cantidad de modelos distintos (letras A, B, C…) | `3` |
| `--formas MIN[-MAX]` | cantidad de formas en el árbol (ej. `6` o `6-9`) | `5-8` |
| `--profundidad N` | niveles máximos de anidamiento | `3` |
| `--tipos a,b,c` | primitivas permitidas | `rectangulo,circulo,triangulo` |
| `--out DIR` | carpeta de salida | `public/ejemplos` |

Primitivas disponibles para `--tipos`: `rectangulo`, `circulo`, `triangulo`, `triangulo_rect`, `semicirculo`,
`hexagono`, `trapecio`, `forma_L`.

### Dificultad

| Nivel | Operaciones por arista | Escalas | Se exige en el árbol |
|---|---|---|---|
| `facil` | hasta 2 | uniformes y positivas (2, 3, 0.5) | nada en particular |
| `media` | hasta 3 | pueden ser no uniformes y negativas | al menos un espejado, una escala no uniforme o una rotación después de una traslación |
| `dificil` | hasta 3 | pueden ser no uniformes y negativas | **las tres cosas**: rotación después de traslación, espejado y escala no uniforme |

Las traslaciones son múltiplos de 5; los ángulos salen de {±45, ±90, 135, 180} (en difícil también −135).

### Salida

Cada ejercicio se guarda como `gen-<dificultad>-<semilla>.json` (formato v2, ver más abajo). Si la carpeta de salida tiene un
`index.json` (como `public/ejemplos/`), los ejercicios se agregan al grupo **Generados** de *Archivo ▸ Abrir ejemplo*. Para abrir un
archivo de otra carpeta usá *Archivo ▸ Importar JSON*.

Si no se puede generar un ejercicio con los parámetros pedidos (por ejemplo demasiadas formas y poca profundidad), el
generador lo informa (`✗ semilla N: …`) y sigue con el siguiente; el código de salida es distinto de 0. Probá con menos
formas o una dificultad menor.

### Cómo lo genera

El árbol se construye de abajo hacia arriba. Cada subárbol se arma en su propio sistema de coordenadas y después se ubica en el del
padre probando fórmulas al azar hasta que su bloque no pise a los hermanos ya ubicados. Como una transformación afín invertible
conserva la no superposición, alcanza con controlarla entre hermanos. En los niveles internos se prefiere la posición más compacta; en
la raíz se elige al azar para que la escena se reparta por la grilla. Al final se valida el documento completo y, si falla, se reintenta
(hasta 400 veces). Un ejercicio tarda unos 40 ms.

## Otras herramientas

```bash
npm run importar     # convierte generadorEjerciciosParcial/ejercicios/**/transformaciones*.json a public/ejemplos/ (y los repara si hace falta)
npm run reparar      # corrige superposiciones y formas fuera de la grilla en los ejercicios de public/ejemplos/
node tools/reparar.js ruta/ejercicio.json    # repara un archivo puntual
node tools/dev/smoke.mjs                     # prueba de humo en Chrome/Edge (con `npm run dev` corriendo en el puerto 5175)
```

El reparador mueve lo mínimo posible las traslaciones involucradas (de a 5 unidades) hasta que desaparecen los problemas, y
muestra qué fórmulas cambió.

## Estructura del proyecto

- `src/core/`: lógica pura sin DOM, compartida por la app y la CLI (`mat3`, `formula`, `primitives`, `doc`, `evaluate`,
  `collide`, `timeline`, `generator`, `repair`, `legacy`, `graphLayout`, `grid`).
- `src/stores/app.svelte.js`: estado global (documento, historial, selección, reproducción).
- `src/components/`: interfaz (Svelte 5). El dibujo es SVG.
- `tools/`: `generar.js`, `importar-legacy.js`, `reparar.js` y `dev/` (pruebas y utilidades de desarrollo).
- `public/ejemplos/`: ejercicios; `index.json` es el manifiesto que usa el diálogo «Abrir ejemplo».
- `tests/`: tests unitarios (`npm test`).
- `generar.bat`: atajo de Windows para el generador.

## Formato de archivo (v2)

```json
{
  "formato": "grafo-escena-2d", "version": 2, "titulo": "…",
  "grilla": { "min": -100, "max": 100, "paso": 10 },
  "modelos": { "A": { "tipo": "rectangulo", "params": { "ancho": 10, "alto": 20 }, "color": "#66CC66" } },
  "raiz": { "id": "n0", "nombre": "Raíz", "hijos": [
    { "id": "n1", "modelo": "A", "t": [ { "op": "T", "x": 0, "y": -40 }, { "op": "R", "ang": 90 } ], "hijos": [] }
  ] }
}
```

- `modelo` es la letra de un modelo, o `null` para un contenedor (nodo sin forma). Un nodo con forma también puede tener hijos.
- `t` es la lista de operaciones de la arista que llega al nodo: `T` (x, y), `R` (ang en grados) y `E` (x, y).
- La Raíz no tiene transformación y puede tener varios hijos.
- Los archivos del formato viejo (`formas` + `arbol`) se importan automáticamente.

## Convenciones

- La fórmula se multiplica de izquierda a derecha (`M = T·R·E`) y se aplica a los vértices como `M·v`: la operación de más a
  la derecha es la primera que actúa.
- Ejes con Y hacia arriba. Origen de cada modelo: centro (rectángulo, círculo, hexágono), punto medio de la base (triángulo
  isósceles, trapecio), vértice del ángulo recto (triángulo rectángulo), centro del diámetro (semicírculo) y esquina interior (forma L).
- Cada forma se dibuja con relleno translúcido al 50 %, contorno fino del mismo color y una marca de orientación: mitad
  izquierda lisa, cuadrante superior derecho más claro e inferior derecho más oscuro.
