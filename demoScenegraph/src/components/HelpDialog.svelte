<script>
  import { app } from '../stores/app.svelte.js';

  let page = $state(0);
  const TOTAL = 2;

  function onkey(e) {
    if (e.key === 'Escape') app.dialog = null;
    else if (e.key === 'ArrowRight') page = Math.min(TOTAL - 1, page + 1);
    else if (e.key === 'ArrowLeft') page = Math.max(0, page - 1);
  }
</script>

<svelte:window onkeydown={onkey} />

<div class="backdrop" role="presentation" onclick={() => (app.dialog = null)}>
  <div class="dlg" role="dialog" aria-modal="true" aria-label="Ayuda" tabindex="-1" onclick={(e) => e.stopPropagation()}>
    <header>
      <strong>Ayuda · {page === 0 ? 'Las partes de la aplicación' : 'Cómo se usa'}</strong>
      <button class="icon" onclick={() => (app.dialog = null)} aria-label="Cerrar">✕</button>
    </header>

    <div class="content">
      {#if page === 0}
        <p class="lead">
          La app muestra un <b>grafo de escena 2D</b> (un árbol cuyas aristas llevan transformaciones) y la <b>escena</b> que resulta de
          aplicarlas. Cada nodo con forma dibuja un modelo; los nodos sin forma («Contenedor») solo agrupan.
        </p>

        <div class="grid">
          <section>
            <h4>Barra superior</h4>
            <ul>
              <li><b>Archivo</b>: nuevo, abrir ejemplo, importar/exportar JSON e imprimir o exportar imagen.</li>
              <li><b>Generar…</b>: crea un ejercicio al azar sin superposiciones.</li>
              <li><b>↶ ↷</b>: deshacer y rehacer. El título es editable.</li>
              <li><b>Editar / Práctica</b>: en práctica se oculta la escena y/o las fórmulas hasta «Revelar».</li>
              <li><b>Indicador</b>: verde si no hay formas superpuestas ni fuera de la grilla; rojo si las hay (clic para ir a la primera).</li>
            </ul>
          </section>

          <section>
            <h4>Escena (izquierda)</h4>
            <ul>
              <li>Grilla de −100 a 100 con los modelos ya transformados. Rojo = eje X, verde = eje Y de cada modelo.</li>
              <li>Cada forma tiene una marca de orientación (mitad izquierda lisa, cuadrante superior derecho claro, inferior derecho oscuro) para ver rotaciones y espejados.</li>
              <li><b>Rueda</b> = zoom, <b>arrastrar</b> = mover, <b>⤢ Encuadrar</b> o doble clic = vista inicial.</li>
              <li>Abajo, la leyenda de modelos con sus dimensiones. Un clic en una forma selecciona su nodo.</li>
            </ul>
          </section>

          <section>
            <h4>Grafo (centro)</h4>
            <ul>
              <li>Cada flecha muestra la fórmula de la arista. Un clic en un nodo o arista lo selecciona.</li>
              <li>Botones: <b>+ Forma</b> / <b>+ Contenedor</b> (hijos del nodo elegido), duplicar, ◀ ▶ reordenar, eliminar.</li>
              <li><b>Aislar</b>: muestra y anima solo el subárbol elegido; «✕ Salir del aislamiento» vuelve.</li>
              <li>Arrastrá un nodo sobre otro para cambiarle el padre. Rueda y arrastre del fondo: zoom y movimiento.</li>
            </ul>
          </section>

          <section>
            <h4>Panel derecho</h4>
            <ul>
              <li><b>Nodo</b>: nombre, modelo, editor de la fórmula de su arista y el análisis de sus matrices.</li>
              <li><b>Modelos</b>: agregar, renombrar, cambiar medidas y color de las primitivas del ejercicio.</li>
              <li><b>Ajustes</b>: letras en la escena, paso de los controles, velocidad y tema.</li>
            </ul>
          </section>

          <section class="wide">
            <h4>Línea de tiempo (abajo)</h4>
            <ul>
              <li><b>▶</b> reproduce la construcción; ⏮ ⏪ ◀ ▶ ⏩ ⏭ saltan al inicio, etapa u operación anterior/siguiente y al resultado final.</li>
              <li>La barra tiene una franja por etapa (un padre con sus hijos) y un bloque por operación, coloreado por tipo (T azul, R naranja, E violeta). Se puede arrastrar.</li>
            </ul>
          </section>
        </div>
      {:else}
        <section>
          <h4>Cómo leer el grafo</h4>
          <ul>
            <li>Cada arista tiene una fórmula como <code>T(30,0)*R(45)*E(2,2)</code>, que es la matriz <b>M = T·R·E</b>. Se aplica a los vértices como <b>M·v</b>: la operación de <b>más a la derecha actúa primero</b> (acá, primero escala, luego rota y al final traslada).</li>
            <li>La posición final de un nodo es el producto de las matrices de todas las aristas desde la Raíz, que se ve en <i>Nodo ▸ Cadena de matrices</i>.</li>
          </ul>
        </section>

        <section>
          <h4>Ver la construcción paso a paso</h4>
          <ul>
            <li>La animación va de las hojas hacia la raíz. En cada <b>etapa</b>, el padre queda en el origen; sus hijos nacen ahí, uno por vez, y ejecutan las operaciones de su arista <b>de derecha a izquierda</b>. Al terminar, el padre y sus hijos quedan como un bloque.</li>
            <li>La última etapa es la Raíz: sus hijos arman la escena final. Con <b>espacio</b> reproducís o pausás y con <b>← →</b> avanzás una operación.</li>
          </ul>
        </section>

        <section>
          <h4>Editar una transformación</h4>
          <ul>
            <li>Elegí un nodo; en <i>Nodo ▸ Transformación de la arista</i> aparecen las operaciones como <b>chips</b> en el orden de la fórmula.</li>
            <li><b>Arrastrá</b> los chips para reordenarlos, usá <b>+</b> al principio o al final para agregar T, R o E, y elegí un chip para ajustar sus valores (campos, sliders, atajos de rotación, espejado de escala).</li>
            <li>El <b>paso</b> de los controles se elige entre 0.1, 0.25, 0.5 o libre. También podés escribir la fórmula completa en el campo de texto.</li>
            <li>Al pasar el mouse sobre un chip se dibuja en la escena el marco de ejes del resultado parcial, y los cambios se ven al instante.</li>
          </ul>
        </section>

        <section>
          <h4>Explorar y entender</h4>
          <ul>
            <li><i>Respecto del padre</i> y <i>De mundo</i> muestran la matriz 3×3 y su descomposición en posición, rotación y escala (con aviso de espejado o cizalla).</li>
            <li>En la cadena, el mouse sobre un factor resalta su arista y dibuja el marco de coordenadas que resulta de multiplicar hasta ahí.</li>
          </ul>
        </section>

        <div class="two">
          <section>
            <h4>Armar y generar ejercicios</h4>
            <ul>
              <li>En blanco: <b>Archivo ▸ Nuevo</b>, agregá modelos en la pestaña Modelos y luego formas en el grafo.</li>
              <li><b>Generar…</b> crea un árbol sin superposiciones según dificultad, cantidad de formas, modelos y semilla (misma semilla, mismo resultado).</li>
              <li>Todo se guarda solo en el navegador; usá <i>Exportar JSON</i> para conservarlo.</li>
            </ul>
          </section>
          <section>
            <h4>Practicar y entregar</h4>
            <ul>
              <li><b>Práctica</b>: oculta la escena y/o las fórmulas; «Revelar» muestra el resultado.</li>
              <li><b>Imprimir</b>: hoja A4 como enunciado 1 (dado el grafo, dibujar la escena), enunciado 2 (dada la escena, completar fórmulas) o solución. También exporta SVG y PNG.</li>
            </ul>
          </section>
        </div>

        <p class="keys">
          <b>Atajos:</b> espacio reproducir/pausar · ← → operación anterior/siguiente · Ctrl+Z / Ctrl+Y deshacer/rehacer · Supr borrar nodo · Esc cerrar o deseleccionar
        </p>
      {/if}
    </div>

    <footer>
      <button disabled={page === 0} onclick={() => (page = 0)}>← Anterior</button>
      <span class="dots" aria-label="Página {page + 1} de {TOTAL}">
        {#each Array(TOTAL) as _, i}<button class="dot" class:on={page === i} aria-label="Página {i + 1}" onclick={() => (page = i)}></button>{/each}
      </span>
      <button class:primary={page === 0} disabled={page === TOTAL - 1} onclick={() => (page = 1)}>Siguiente →</button>
    </footer>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60;
  }
  .dlg {
    background: var(--panel);
    border-radius: 12px;
    width: min(860px, 94vw);
    height: min(780px, 95vh);
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgb(0 0 0 / 0.4);
  }
  header,
  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 18px;
    flex: none;
  }
  header {
    border-bottom: 1px solid var(--border);
    font-size: 15px;
  }
  footer {
    border-top: 1px solid var(--border);
  }
  .content {
    padding: 12px 20px 16px;
    overflow: auto;
    flex: 1;
    font-size: 13px;
    line-height: 1.45;
  }
  .lead {
    margin: 0 0 10px;
  }
  h4 {
    margin: 0 0 4px;
    font-size: 13px;
    color: var(--accent);
  }
  ul {
    margin: 0;
    padding-left: 18px;
  }
  li {
    margin-bottom: 3px;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 24px;
  }
  .wide {
    grid-column: 1 / 3;
  }
  .two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 24px;
  }
  section {
    margin-bottom: 10px;
  }
  code {
    background: var(--panel-2);
    padding: 0 4px;
    border-radius: 4px;
    font-family: ui-monospace, Consolas, monospace;
  }
  .keys {
    margin: 4px 0 0;
    padding: 8px 10px;
    background: var(--panel-2);
    border-radius: var(--radius);
    font-size: 12px;
  }
  .dots {
    display: inline-flex;
    gap: 8px;
  }
  .dot {
    width: 10px;
    height: 10px;
    min-width: 0;
    padding: 0;
    border-radius: 50%;
    border: 1px solid var(--grid-strong);
    background: transparent;
  }
  .dot.on {
    background: var(--accent);
    border-color: var(--accent);
  }
  @media (max-width: 760px) {
    .grid,
    .two {
      grid-template-columns: 1fr;
    }
    .wide {
      grid-column: auto;
    }
  }
</style>
