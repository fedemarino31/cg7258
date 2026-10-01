<script>
  import { app } from '../stores/app.svelte.js';
  import { downloadText } from '../export.js';

  let menu = $state(false);
  let fileInput = $state(null);

  const issues = $derived(app.validation.bad.size);

  function close() {
    menu = false;
  }

  async function onFile(e) {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!f) return;
    try {
      app.loadObject(JSON.parse(await f.text()), f.name.replace(/\.json$/i, ''));
      app.notify(`Cargado: ${f.name}`);
    } catch (err) {
      app.notify(`No se pudo importar: ${err.message}`);
    }
  }

  function exportJson() {
    const name = (app.doc.titulo || 'ejercicio').replace(/[^\w\-]+/g, '_');
    downloadText(`${name}.json`, JSON.stringify($state.snapshot(app.doc), null, 2), 'application/json');
    close();
  }

  const run = (fn) => () => {
    close();
    fn();
  };
</script>

<svelte:window onpointerdown={(e) => { if (menu && !e.target.closest?.('.filemenu')) menu = false; }} />

<header class="top">
  <strong class="brand">Grafo de escena 2D</strong>

  <div class="filemenu">
    <button onclick={() => (menu = !menu)} aria-haspopup="menu" aria-expanded={menu}>Archivo ▾</button>
    {#if menu}
      <div class="menu" role="menu">
        <button role="menuitem" onclick={run(() => app.newDoc())}>Nuevo (en blanco)</button>
        <button role="menuitem" onclick={run(() => (app.dialog = 'ejemplos'))}>Abrir ejemplo…</button>
        <button role="menuitem" onclick={run(() => fileInput.click())}>Importar JSON…</button>
        <hr />
        <button role="menuitem" onclick={exportJson}>Exportar JSON</button>
        <button role="menuitem" onclick={run(() => (app.dialog = 'imprimir'))}>Imprimir / exportar imagen…</button>
      </div>
    {/if}
  </div>
  <input bind:this={fileInput} type="file" accept=".json,application/json" hidden onchange={onFile} />

  <button onclick={() => (app.dialog = 'generar')}>Generar…</button>

  <span class="sep"></span>
  <button class="icon" title="Deshacer (Ctrl+Z)" disabled={!app.past.length || app.locked} onclick={() => app.undo()}>↶</button>
  <button class="icon" title="Rehacer (Ctrl+Y)" disabled={!app.future.length || app.locked} onclick={() => app.redo()}>↷</button>

  <input
    class="title"
    type="text"
    value={app.doc.titulo}
    disabled={app.locked}
    aria-label="Título del ejercicio"
    oninput={(e) => app.setTitle(e.currentTarget.value)}
  />

  <span class="spacer"></span>

  <div class="seg" role="group" aria-label="Modo">
    <button class:on={app.mode === 'editar'} onclick={() => { app.mode = 'editar'; }}>Editar</button>
    <button class:on={app.mode === 'practica'} onclick={() => { app.mode = 'practica'; app.practica.revelado = false; app.t = null; app.pause(); }}>Práctica</button>
  </div>
  {#if app.mode === 'practica'}
    <label class="opt"><input type="checkbox" bind:checked={app.practica.ocultarEscena} /> ocultar escena</label>
    <label class="opt"><input type="checkbox" bind:checked={app.practica.ocultarFormulas} /> ocultar fórmulas</label>
    {#if app.practica.revelado}
      <button onclick={() => (app.practica.revelado = false)}>Ocultar</button>
    {:else}
      <button class="primary" onclick={() => { app.practica.revelado = true; }}>Revelar</button>
    {/if}
  {/if}

  <button class="icon helpbtn" title="Ayuda (F1)" aria-label="Ayuda" onclick={() => (app.dialog = 'ayuda')}>? Ayuda</button>

  <button
    class="status"
    class:bad={issues > 0}
    title={issues ? 'Hay formas superpuestas o fuera de la grilla' : 'Sin superposiciones y todo dentro de la grilla'}
    onclick={() => { const id = [...app.validation.bad][0]; if (id) app.select(id); }}
  >{issues ? `⚠ ${issues} con problemas` : '● Sin problemas'}</button>
</header>

<style>
  .top {
    grid-column: 1 / 4;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px;
    height: 46px;
    background: var(--panel);
    border-bottom: 1px solid var(--border);
  }
  .brand {
    margin-right: 6px;
  }
  .sep {
    width: 1px;
    height: 22px;
    background: var(--border);
    margin: 0 4px;
  }
  .spacer {
    flex: 1;
  }
  .title {
    width: 260px;
  }
  .filemenu {
    position: relative;
  }
  .menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 20;
    min-width: 230px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 6px 20px rgb(0 0 0 / 0.18);
    padding: 4px;
    display: flex;
    flex-direction: column;
  }
  .menu button {
    border: none;
    text-align: left;
    background: transparent;
  }
  .menu hr {
    border: none;
    border-top: 1px solid var(--border);
    width: 100%;
    margin: 4px 0;
  }
  .seg {
    display: inline-flex;
  }
  .seg button {
    border-radius: 0;
  }
  .seg button:first-child {
    border-radius: var(--radius) 0 0 var(--radius);
  }
  .seg button:last-child {
    border-radius: 0 var(--radius) var(--radius) 0;
    border-left: none;
  }
  .seg button.on {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  .opt {
    font-size: 12px;
    display: inline-flex;
    gap: 4px;
    align-items: center;
  }
  .helpbtn {
    font-weight: 600;
  }
  .status {
    color: var(--ok);
    font-weight: 600;
  }
  .status.bad {
    color: var(--danger);
  }
</style>
