<script>
  import { app } from '../stores/app.svelte.js';
  import { PRIMITIVES, PRIMITIVE_IDS } from '../core/primitives.js';
  import { walk } from '../core/doc.js';

  let newType = $state('rectangulo');

  const models = $derived(Object.entries(app.doc.modelos));
  const usage = $derived.by(() => {
    const u = {};
    for (const { node } of walk(app.doc.raiz)) if (node.modelo) u[node.modelo] = (u[node.modelo] ?? 0) + 1;
    return u;
  });
  const dupColors = $derived.by(() => {
    const seen = {};
    const dup = new Set();
    for (const [k, m] of models) {
      const c = m.color.toLowerCase();
      if (seen[c]) {
        dup.add(k);
        dup.add(seen[c]);
      } else seen[c] = k;
    }
    return dup;
  });

  function rename(from, e) {
    const to = e.currentTarget.value.trim().toUpperCase().slice(0, 3);
    if (!to || to === from) {
      e.currentTarget.value = from;
      return;
    }
    if (to in app.doc.modelos) {
      app.notify(`Ya existe un modelo «${to}».`);
      e.currentTarget.value = from;
      return;
    }
    app.rename(from, to);
  }
</script>

<div class="lib">
  <div class="row">
    <select bind:value={newType} disabled={app.locked}>
      {#each PRIMITIVE_IDS as id}<option value={id}>{PRIMITIVES[id].nombre}</option>{/each}
    </select>
    <button class="primary" disabled={app.locked} onclick={() => app.addModelOfType(newType)}>+ Modelo</button>
  </div>
  <p class="muted small">Origen: {PRIMITIVES[newType].origen}.</p>

  {#each models as [letra, m] (letra)}
    <div class="model">
      <div class="head">
        <input class="letter" type="text" value={letra} maxlength="3" disabled={app.locked} onchange={(e) => rename(letra, e)} title="Letra del modelo" />
        <span>{PRIMITIVES[m.tipo]?.nombre ?? m.tipo}</span>
        <span class="spacer"></span>
        <input type="color" value={m.color} disabled={app.locked} oninput={(e) => app.updateModel(letra, { color: e.currentTarget.value.toUpperCase() }, 'color-' + letra)} title="Color identificatorio" />
        <button class="icon danger" disabled={app.locked} title="Eliminar modelo" onclick={() => app.deleteModel(letra)}>🗑</button>
      </div>
      <div class="params">
        {#each Object.entries(PRIMITIVES[m.tipo].params) as [k, def]}
          <label>
            <span>{def.label}</span>
            <input
              type="number" min={def.min} max={def.max} step="1" value={m.params[k]} disabled={app.locked}
              oninput={(e) => {
                const v = parseFloat(e.currentTarget.value);
                if (Number.isFinite(v) && v > 0) app.updateModel(letra, { params: { [k]: v } }, `p-${letra}-${k}`);
              }}
            />
          </label>
        {/each}
      </div>
      <div class="foot muted small">
        {#if usage[letra]}usado en {usage[letra]} nodo{usage[letra] > 1 ? 's' : ''}{:else}sin usar{/if}
        {#if dupColors.has(letra)}<span class="warn"> · color repetido</span>{/if}
      </div>
    </div>
  {:else}
    <p class="muted">Todavía no hay modelos.</p>
  {/each}
</div>

<style>
  .lib {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .row {
    display: flex;
    gap: 6px;
  }
  .small {
    font-size: 12px;
    margin: 0;
  }
  .model {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .head {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .letter {
    width: 44px;
    font-weight: 700;
    text-align: center;
  }
  .spacer {
    flex: 1;
  }
  input[type='color'] {
    width: 34px;
    height: 28px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: none;
  }
  .params {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .params label {
    display: flex;
    flex-direction: column;
    font-size: 11px;
    color: var(--muted);
  }
  .warn {
    color: var(--danger);
  }
</style>
