<script>
  import { app } from '../stores/app.svelte.js';
  import { nodeLabel } from '../core/doc.js';
  import FormulaEditor from './FormulaEditor.svelte';
  import NodeTransformPanel from './NodeTransformPanel.svelte';
  import ModelLibrary from './ModelLibrary.svelte';

  let tab = $state('nodo');
  const sel = $derived(app.selected);
  const isRoot = $derived(sel && sel.id === app.doc.raiz.id);
  const modelKeys = $derived(Object.keys(app.doc.modelos));
</script>

<aside class="inspector">
  <div role="tablist" class="tabs">
    {#each [['nodo', 'Nodo'], ['modelos', 'Modelos'], ['ajustes', 'Ajustes']] as [k, label]}
      <button role="tab" aria-selected={tab === k} class:on={tab === k} onclick={() => (tab = k)}>{label}</button>
    {/each}
  </div>

  <div class="body">
    {#if tab === 'nodo'}
      {#if !sel}
        <p class="muted">Seleccioná un nodo en el grafo o una forma en la escena para ver y editar sus transformaciones.</p>
        {#if !app.validation.ok && app.mode === 'editar'}
          <h3>Problemas detectados</h3>
          <ul class="issues">
            {#each app.validation.overlaps as o}
              <li><button class="link" onclick={() => app.select(o.a)}>{o.a}</button> y <button class="link" onclick={() => app.select(o.b)}>{o.b}</button> se superponen (área {Math.round(o.area * 10) / 10})</li>
            {/each}
            {#each app.validation.outside as id}
              <li><button class="link" onclick={() => app.select(id)}>{id}</button> sale de la grilla</li>
            {/each}
            {#each app.validation.singular as id}
              <li><button class="link" onclick={() => app.select(id)}>{id}</button> tiene una escala 0</li>
            {/each}
          </ul>
        {/if}
      {:else}
        <div class="field">
          <label for="nm">{isRoot ? 'Nodo' : 'Nombre'}</label>
          {#if isRoot}
            <strong>Raíz</strong>
          {:else}
            <input id="nm" type="text" value={sel.nombre ?? ''} placeholder={nodeLabel(sel)} disabled={app.locked}
              oninput={(e) => app.setName(sel.id, e.currentTarget.value)} />
          {/if}
        </div>
        {#if !isRoot}
          <div class="field">
            <label for="md">Modelo</label>
            <select id="md" value={sel.modelo ?? ''} disabled={app.locked} onchange={(e) => app.setModelOf(sel.id, e.currentTarget.value)}>
              <option value="">(contenedor, sin forma)</option>
              {#each modelKeys as k}<option value={k}>{k} — {app.doc.modelos[k].tipo}</option>{/each}
            </select>
          </div>
          {#if !app.ocultaFormulas}
            <h3>Transformación de la arista</h3>
            <FormulaEditor nodeId={sel.id} />
          {/if}
        {/if}
        {#if app.ocultaFormulas}
          <p class="muted">Las fórmulas están ocultas (modo práctica). Usá «Revelar» para verlas.</p>
        {:else}
          <NodeTransformPanel nodeId={sel.id} />
        {/if}
      {/if}
    {:else if tab === 'modelos'}
      <ModelLibrary />
    {:else}
      <div class="settings">
        <label class="srow"><input type="checkbox" bind:checked={app.settings.mostrarLetras} /> Mostrar letra del modelo en la escena</label>
        <label class="srow">
          Paso de los controles T, R y E
          <select bind:value={app.settings.paso}>
            <option value="0.1">0.1</option>
            <option value="0.25">0.25</option>
            <option value="0.5">0.5</option>
            <option value="any">libre</option>
          </select>
        </label>
        <label class="srow">
          Velocidad de animación
          <select bind:value={app.speed}>
            {#each [0.25, 0.5, 1, 2, 4] as s}<option value={s}>{s}×</option>{/each}
          </select>
        </label>
        <label class="srow">
          Tema
          <select bind:value={app.settings.tema}>
            <option value="auto">Automático</option>
            <option value="light">Claro</option>
            <option value="dark">Oscuro</option>
          </select>
        </label>
        <h3>Grilla</h3>
        <div class="muted small">De {app.doc.grilla.min} a {app.doc.grilla.max}, celdas de {app.doc.grilla.paso}.</div>
      </div>
    {/if}
  </div>
</aside>

<style>
  .inspector {
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--panel);
    border-left: 1px solid var(--border);
  }
  .tabs {
    display: flex;
    border-bottom: 1px solid var(--border);
  }
  .tabs button {
    flex: 1;
    border: none;
    border-radius: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    padding: 9px 4px;
  }
  .tabs button.on {
    border-bottom-color: var(--accent);
    font-weight: 600;
  }
  .body {
    padding: 10px 12px 20px;
    overflow: auto;
    min-height: 0;
    flex: 1;
  }
  .field {
    display: grid;
    grid-template-columns: 70px 1fr;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
  }
  .field label {
    color: var(--muted);
    font-size: 12px;
  }
  .settings {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .srow {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
  }
  .small {
    font-size: 12px;
  }
  .issues {
    padding-left: 18px;
    font-size: 13px;
  }
  .link {
    border: none;
    background: none;
    padding: 0;
    color: var(--accent);
    text-decoration: underline;
  }
</style>
