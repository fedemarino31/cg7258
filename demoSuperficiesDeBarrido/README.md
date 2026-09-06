# Superficies de barrido

Demo con vistas 3D y topología 2D sincronizadas, Three.js y Tweakpane.

```sh
npm install
npm run dev
npm test
npm run build
npm run preview
```

El servidor de desarrollo usa el puerto 10001.

- Play/Pause controla la generación; velocidad 0 conserva el avance.
- Seleccionar triángulo pausa al activar. Arrastrar sigue orbitando; hacer clic selecciona. Play permite continuar con la herramienta activa.
- La selección marca la banda de fila en rojo y la de columna en verde en 2D. Los índices empiezan en 0.
- Cada fila corresponde a un nivel del path y cada columna a una muestra del shape. Las muestras de costura conservan índices distintos.
- Las matrices de nivel se muestran como ejes locales. Los auxiliares aparecen en los niveles alcanzados por la generación.
- Cambiar shape/path limpia selección y avance, manteniendo reproducción y opciones. Al completar la superficie se muestra un segundo antes de reiniciar.
- El shape **Copa de champagne** es un perfil abierto; elegí el path **Círculo** para obtener la superficie de revolución. El radio del path define su eje de revolución.
- Los shapes **Semicírculo (esfera)** y **Cilindro (3 segmentos)** son perfiles abiertos de revolución y seleccionan automáticamente el path **Círculo**.

La geometría y sus metadatos se crean una vez por superficie. El contador de triángulos controla el draw range 3D y el relleno 2D; la selección utiliza los mismos índices.
