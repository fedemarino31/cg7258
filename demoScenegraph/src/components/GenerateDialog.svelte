<script>
  import { app } from '../stores/app.svelte.js';
  import { DEFAULTS, DIFICULTADES } from '../core/generator.js';
  import { PRIMITIVES, PRIMITIVE_IDS } from '../core/primitives.js';

  let seed = $state(Math.floor(Math.random() * 100000));
  let nModelos = $state(DEFAULTS.nModelos);
  let formasMin = $state(DEFAULTS.formasMin);
  let formasMax = $state(DEFAULTS.formasMax);
  let profundidad = $state(DEFAULTS.profundidad);
  let dificultad = $state(DEFAULTS.dificultad);
  let tipos = $state([...DEFAULTS.tipos]);
  let error = $state('');
  let busy = $state(false);

  const labels = { facil: 'Fácil', media: 'Media', dificil: 'Difícil' };
  const hints = {
    facil: 'Hasta 2 operaciones por arista, escalas uniformes y sin espejado.',
    media: 'Hasta 3 operaciones; exige al menos un espejado, una escala no uniforme o una rotación después de una traslación.',
    dificil: 'Exige las tres cosas: rotación después de traslación, espejado y escala no uniforme.',
  };

  function toggle(t) {
    tipos = tipos.includes(t) ? tipos.filter((x) => x !== t) : [...tipos, t];
  }

  async function go() {
    error = '';
    if (!tipos.length) {
      error = 'Elegí al menos una primitiva.';
      return;
    }
    busy = true;
    await new Promise((r) => setTimeout(r, 20)); // deja pintar el estado "generando"
    try {
      app.generateDoc({ seed, nModelos, formasMin, formasMax: Math.max(formasMin, formasMax), profundidad, dificultad, tipos });
      app.dialog = null;
      app.notify(`Ejercicio generado (semilla ${seed}).`);
    } catch (e) {
      error = e.message;
    } finally {
      busy = false;
    }
  }
</script>

<div class="backdrop" role="presentation" onclick={() => (app.dialog = null)}>
  <div class="dlg" role="dialog" aria-modal="true" aria-label="Generar ejercicio" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && (app.dialog = null)}>
    <header>
      <strong>Generar ejercicio</strong>
      <button class="icon" onclick={() => (app.dialog = null)} aria-label="Cerrar">✕</button>
    </header>
    <div class="content">
      <p class="muted">Crea un árbol nuevo (reemplaza el actual) en el que ninguna forma se superpone y todo queda dentro de la grilla.</p>

      <div class="grid">
        <label>Semilla
          <span class="inline">
            <input type="number" bind:value={seed} />
            <button title="Semilla al azar" onclick={() => (seed = Math.floor(Math.random() * 100000))}>🎲</button>
          </span>
        </label>
        <label>Dificultad
          <select bind:value={dificultad}>
            {#each DIFICULTADES as d}<option value={d}>{labels[d]}</option>{/each}
          </select>
        </label>
        <label>Cantidad de modelos
          <input type="number" min="2" max="8" bind:value={nModelos} />
        </label>
        <label>Profundidad máxima
          <input type="number" min="2" max="4" bind:value={profundidad} />
        </label>
        <label>Formas (mín.)
          <input type="number" min="3" max="12" bind:value={formasMin} />
        </label>
        <label>Formas (máx.)
          <input type="number" min="3" max="12" bind:value={formasMax} />
        </label>
      </div>
      <p class="muted small">{hints[dificultad]}</p>

      <h3>Primitivas permitidas</h3>
      <div class="types">
        {#each PRIMITIVE_IDS as t}
          <label class="t"><input type="checkbox" checked={tipos.includes(t)} onchange={() => toggle(t)} /> {PRIMITIVES[t].nombre}</label>
        {/each}
      </div>

      {#if error}<div class="err">{error}</div>{/if}
    </div>
    <footer>
      <button onclick={() => (app.dialog = null)}>Cancelar</button>
      <button class="primary" disabled={busy} onclick={go}>{busy ? 'Generando…' : 'Generar'}</button>
    </footer>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
  }
  .dlg {
    background: var(--panel);
    border-radius: 10px;
    width: min(560px, 92vw);
    max-height: 86vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgb(0 0 0 / 0.35);
  }
  header,
  footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
  }
  header {
    border-bottom: 1px solid var(--border);
  }
  footer {
    border-top: 1px solid var(--border);
    justify-content: flex-end;
    gap: 8px;
  }
  .content {
    padding: 4px 16px 12px;
    overflow: auto;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 16px;
  }
  .grid label {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 12px;
    color: var(--muted);
  }
  .grid input,
  .grid select {
    width: 100%;
    font-size: 14px;
    color: var(--text);
  }
  .inline {
    display: flex;
    gap: 4px;
  }
  .types {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 12px;
  }
  .t {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .small {
    font-size: 12px;
  }
  .err {
    color: var(--danger);
    margin-top: 10px;
  }
</style>
