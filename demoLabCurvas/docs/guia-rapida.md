# Guía rápida

## Crear y editar

Elegí **Agregar** (`A`), el grado y el modo en la pestaña **Crear**. Independiente consume grupos completos; Encadenado reutiliza el último extremo de la cadena. Un grupo incompleto queda como borrador persistente.

Con **Tipo de curva: Catmull-Rom** cada tramo usa cuatro puntos P0..P3 e interpola de P1 a P2. En modo Encadenado, después de los primeros cuatro puntos **cada clic agrega un tramo** que comparte tres puntos con el anterior. La parametrización α (0 uniforme, 0,5 centrípeta, 1 cordal) y la tensión τ se eligen para la creación y se pueden cambiar por tramo en la pestaña **Tramo** (deslizador + valor numérico) o aplicar a toda la cadena.

Con **Seleccionar** (`V`) podés arrastrar puntos, sumar selección con Shift o encerrar varios con un rectángulo. El inspector admite coordenadas con punto o coma decimal. La rueda hace zoom bajo el puntero; **Desplazar** (`H`) mueve la cámara.

## Analizar

El slider inferior controla `u`. **Explorar** (`E`) busca el punto más cercano sin depender de la discretización. Las pestañas muestran funciones base, continuidad y mediciones analíticas. Las capas De Casteljau, vectores, normal, círculo osculador, casco y muestras se activan en la pestaña **Vista**. `T` es la tangente unitaria de longitud visual fija; `C′` se activa por separado y su flecha escala con el módulo real de la primera derivada.

En **Continuidad**, elegí comparación global `t` o local `u`. Los botones C0/G1/C1/C2 modifican el tramo derecho en una sola transacción reversible. **Dividir aquí** conserva la forma y la parametrización global; **Elevar grado** conserva la curva.

## Catmull-Rom

Cada tramo se dibuja y analiza a través de su cúbica de Bézier exactamente equivalente (capa **Bézier equivalente**). La capa de construcción muestra la pirámide de Barry-Goldman cuando τ=0. **Bases** grafica los pesos efectivos, que suman 1 pero pueden ser negativos.

En la pestaña **Tramo**: **Insertar punto aquí** agrega un punto de interpolación en C(u) y cambia la forma solo localmente. **Extremos duplicados/reflejados** hace que la curva pase por el primer y el último punto. **Cerrar curva** forma un lazo. **h = intervalo nodal** asigna a cada tramo la duración |P2−P1|^α, que da C1 en la comparación global. **Convertir a Bézier** reemplaza el tramo por su equivalente exacto. Borrar un punto regenera los tramos vecinos.

En **Continuidad**, las uniones Catmull-Rom ofrecen **Compartir 3 puntos** e **Igualar α/τ** en lugar de los ajustes de controles; los bloqueos persistentes siguen siendo exclusivos de las cúbicas Bézier.

## Ilustrar y exportar

**Congelar referencia** guarda una copia inmutable para comparar. El botón `i` abre fórmulas contextuales. Tab con foco en el plano entra al modo ilustración.

**Exportar** produce SVG autónomo o PNG desde el mismo snapshot vectorial, en 1920×1080, 3840×2160 o formato cuadrado. Los controles, hit targets y selección de UI nunca se incluyen.

## Archivos y recuperación

**Guardar** descarga una escena JSON. **Abrir** acepta escenas y catálogos; un archivo inválido no cambia la escena. El autoguardado local se actualiza 750 ms después de cada modificación y se restaura al iniciar. Las vistas guardadas conservan cámara, capas, selección y parámetro sin duplicar geometría.

La paleta `Ctrl+K` reúne herramientas, operaciones, archivo, vistas y exportación. `Ctrl+Z`/`Ctrl+Y` deshacen y rehacen; `F` encuadra; Supr aplica el borrado topológico.
