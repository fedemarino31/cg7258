<script>
  import { app } from '../stores/app.svelte.js';

  const groups = $derived.by(() => {
    const g = new Map();
    for (const e of app.examples) {
      if (!g.has(e.grupo)) g.set(e.grupo, []);
      g.get(e.grupo).push(e);
    }
    return [...g.entries()];
  });

  async function open(e) {
    try {
      await app.loadExample(e.archivo);
      app.dialog = null;
    } catch (err) {
      app.notify(err.message);
    }
  }
</script>

<div class="backdrop" role="presentation" onclick={() => (app.dialog = null)}>
  <div class="dlg" role="dialog" aria-modal="true" aria-label="Abrir ejemplo" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && (app.dialog = null)}>
    <header>
      <strong>Abrir ejemplo</strong>
      <button class="icon" onclick={() => (app.dialog = null)} aria-label="Cerrar">✕</button>
    </header>
    <div class="content">
      {#each groups as [grupo, list]}
        <h3>{grupo}</h3>
        <div class="grid">
          {#each list as e}
            <button onclick={() => open(e)}>{e.titulo}</button>
          {/each}
        </div>
      {:else}
        <p class="muted">No hay ejemplos en <code>public/ejemplos/</code>. Ejecutá <code>npm run importar</code>.</p>
      {/each}
    </div>
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
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgb(0 0 0 / 0.35);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }
  .content {
    padding: 4px 16px 16px;
    overflow: auto;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 6px;
  }
</style>
