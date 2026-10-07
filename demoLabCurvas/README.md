# Laboratorio de curvas 2D

Aplicación de escritorio web para construir, analizar e ilustrar curvas Bézier lineales, cuadráticas y cúbicas, y splines Catmull-Rom de uno o muchos tramos (uniformes, centrípetas o cordales, con tensión). Usa SVG nativo para la geometría exacta, Tweakpane para ajustes rápidos y KaTeX local para fórmulas.

## Puesta en marcha

Requiere Node.js 20 o posterior.

```bash
npm install
npm run dev
```

Vite sirve por defecto en `http://localhost:10001`. Los demás comandos son:

```bash
npm run build
npm test
npm run test:e2e
npm run preview
```

## Estructura

- `src/math/`: evaluación, derivadas, continuidad, curvatura, longitud, casco y muestreo (`bezier.js`); nodos, tangentes, Barry-Goldman, pesos y conversión exacta a Bézier (`catmullRom.js`).
- `src/model/`: contratos, defaults, catálogo, validación, comandos e historial.
- `src/render/`: escena SVG y exportación autónoma.
- `src/ui/`: interfaz, interacciones, paneles y persistencia.
- `public/examples/`: las 33 escenas docentes (01–20 Bézier, 21–33 Catmull-Rom) y `catalog.json`.
- `schemas/`: esquemas JSON versión 1.
- `tests/`: pruebas matemáticas y flujos de navegador.

## Catálogo y escenas

El selector superior abre los ejemplos incorporados y permite descargar el catálogo completo. `Abrir` acepta tanto escenas como catálogos JSON. Una escena se valida completamente antes de reemplazar el documento actual.

Para regenerar los archivos desde los constructores verificables:

```bash
node scripts/generate-examples.mjs
```

Al agregar un ejemplo, incorporalo en `src/model/examples.js`, regenerá el catálogo y añadí la expectativa matemática correspondiente en `tests/unit/bezier.test.js` o `tests/unit/catmullRom.test.js`.

## Formato

Una escena usa `format: "bezier-lab-scene"`, `version: 1` y separa `geometry`, `presentation` y `metadata`. Los IDs son persistentes; los resultados derivados no se serializan. Un tramo Catmull-Rom tiene `type: "catmullRom"`, cuatro `pointIds` y `params: { alpha, tension }`; los tramos consecutivos de una spline comparten tres IDs de punto. El ejemplo completo [03-cubica-casteljau.json](public/examples/03-cubica-casteljau.json) documenta todos los defaults exportados.

Más detalles de uso en [docs/guia-rapida.md](docs/guia-rapida.md) y decisiones técnicas en [docs/decisiones.md](docs/decisiones.md).
