# Decisiones y límites

## Decisiones

- El SVG trabaja en coordenadas de pantalla calculadas desde una cámara isótropa. Así los textos permanecen derechos y los grosores no cambian con el zoom.
- Las curvas suaves usan exclusivamente `L`, `Q` y `C`. La discretización manual es otra capa y nunca alimenta derivadas, continuidad o curvatura.
- Todas las mutaciones documentales pasan por transacciones con 120 estados de historial. Selección simple, cámara y frames de reproducción quedan fuera del historial.
- Split, elevación y ejemplos 14/15 usan las mismas funciones puras probadas en 101 muestras.
- La exportación serializa un SVG nuevo sin scripts, eventos, `foreignObject` ni CSS remoto. PNG rasteriza ese SVG con Canvas 2D.
- Los nombres importados se asignan mediante `textContent`; no se evalúa contenido de archivos.

## Límites explícitos

- El bloqueo dirigido persistente se limita deliberadamente a pares cúbica-cúbica, con propagación de izquierda a derecha; los grados bajos conservan diagnóstico y ajustes puntuales.
- El recorrido global por duraciones funciona en el transporte y respeta el lado derecho en límites. El reparto animado por longitud de una cadena completa queda fuera de esta entrega.
- La exportación disponible cubre la escena visible. Los paneles analíticos y la tabla aún no se exportan como composiciones independientes.
- Las transformaciones afines tienen soporte matemático implícito por la propiedad de Bézier, pero no se expone un panel de preview/aplicar.
- KaTeX se usa para el panel local; el exportador de fórmulas a paths y la opción de texto como trazados no están disponibles.
- La revisión automatizada usa Edge. El conector interactivo no encontró navegadores registrados y Firefox no estaba disponible.

Estos límites no afectan evaluación, edición básica, continuidad diagnóstica, catálogo, JSON ni exportación de escena, pero sí son diferencias concretas respecto de la especificación máxima.
