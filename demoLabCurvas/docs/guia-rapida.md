# Guía rápida

## Crear y editar

Elegí **Agregar** (`A`), el grado y el modo en **Controles**. Independiente consume grupos completos; Encadenado reutiliza el último extremo de la cadena. Un grupo incompleto queda como borrador persistente.

Con **Seleccionar** (`V`) podés arrastrar puntos, sumar selección con Shift o encerrar varios con un rectángulo. El inspector admite coordenadas con punto o coma decimal. La rueda hace zoom bajo el puntero; **Desplazar** (`H`) mueve la cámara.

## Analizar

El slider inferior controla `u`. **Explorar** (`E`) busca el punto más cercano sin depender de la discretización. Las pestañas muestran funciones base, continuidad y mediciones analíticas. Las capas De Casteljau, vectores, normal, círculo osculador, casco y muestras se activan en **Controles**. `T` es la tangente unitaria de longitud visual fija; `C′` se activa por separado y su flecha escala con el módulo real de la primera derivada.

En **Continuidad**, elegí comparación global `t` o local `u`. Los botones C0/G1/C1/C2 modifican el tramo derecho en una sola transacción reversible. **Dividir aquí** conserva la forma y la parametrización global; **Elevar grado** conserva la curva.

## Ilustrar y exportar

**Congelar referencia** guarda una copia inmutable para comparar. El botón `i` abre fórmulas contextuales. Tab con foco en el plano entra al modo ilustración.

**Exportar** produce SVG autónomo o PNG desde el mismo snapshot vectorial, en 1920×1080, 3840×2160 o formato cuadrado. Los controles, hit targets y selección de UI nunca se incluyen.

## Archivos y recuperación

**Guardar** descarga una escena JSON. **Abrir** acepta escenas y catálogos; un archivo inválido no cambia la escena. El autoguardado local se actualiza 750 ms después de cada modificación y se restaura al iniciar. Las vistas guardadas conservan cámara, capas, selección y parámetro sin duplicar geometría.

La paleta `Ctrl+K` reúne herramientas, operaciones, archivo, vistas y exportación. `Ctrl+Z`/`Ctrl+Y` deshacen y rehacen; `F` encuadra; Supr aplica el borrado topológico.
