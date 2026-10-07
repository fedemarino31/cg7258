# Decisiones y límites

## Decisiones

- El SVG trabaja en coordenadas de pantalla calculadas desde una cámara isótropa. Así los textos permanecen derechos y los grosores no cambian con el zoom.
- Las curvas suaves usan exclusivamente `L`, `Q` y `C`. La discretización manual es otra capa y nunca alimenta derivadas, continuidad o curvatura.
- Todas las mutaciones documentales pasan por transacciones con 120 estados de historial. Selección simple, cámara y frames de reproducción quedan fuera del historial.
- Split, elevación y ejemplos 14/15 usan las mismas funciones puras probadas en 101 muestras.
- La exportación serializa un SVG nuevo sin scripts, eventos, `foreignObject` ni CSS remoto. PNG rasteriza ese SVG con Canvas 2D.
- Los nombres importados se asignan mediante `textContent`; no se evalúa contenido de archivos.
- Catmull-Rom se modela como tramos de cuatro puntos (`type: "catmullRom"`). Una spline es una secuencia de tramos consecutivos que comparten tres IDs; no hay una entidad aparte. Todo el análisis (path `C`, derivadas, curvatura, longitud, muestreo, continuidad, sondas, referencias) usa la cúbica de Bézier exactamente equivalente, con tangentes de Barry-Goldman sobre nodos |ΔP|^α escaladas por (1−τ).
- Las operaciones de secuencia (insertar, borrar, cerrar, extremos) regeneran los tramos de la secuencia y conservan IDs, nombres, parámetros y estilo cuando es posible.
- El formato de escena sigue siendo `bezier-lab-scene` versión 1 y la clave de autoguardado no cambia. Las escenas anteriores se leen sin cambios porque `type` ausente equivale a Bézier.

## Límites explícitos

- El bloqueo dirigido persistente se limita deliberadamente a pares cúbica-cúbica, con propagación de izquierda a derecha; los grados bajos conservan diagnóstico y ajustes puntuales.
- El recorrido global por duraciones funciona en el transporte y respeta el lado derecho en límites. El reparto animado por longitud de una cadena completa queda fuera de esta entrega.
- La exportación disponible cubre la escena visible. Los paneles analíticos y la tabla aún no se exportan como composiciones independientes.
- Las transformaciones afines tienen soporte matemático implícito por la propiedad de Bézier, pero no se expone un panel de preview/aplicar.
- KaTeX se usa para el panel local; el exportador de fórmulas a paths y la opción de texto como trazados no están disponibles.
- En una curva Catmull-Rom cerrada, la tabla de continuidad no evalúa la unión entre el último y el primer tramo porque la cadena sigue siendo lineal; el lazo es C1 por construcción.
- La construcción de Barry-Goldman solo se dibuja con τ=0; con otra tensión se muestra De Casteljau sobre la Bézier equivalente.
- La revisión automatizada usa Edge. El conector interactivo no encontró navegadores registrados y Firefox no estaba disponible.

Estos límites no afectan evaluación, edición básica, continuidad diagnóstica, catálogo, JSON ni exportación de escena, pero sí son diferencias concretas respecto de la especificación máxima.
