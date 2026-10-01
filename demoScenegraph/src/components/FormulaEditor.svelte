<script>
  // Editor de la fórmula de la arista entrante de un nodo: chips reordenables
  // con drag & drop, parámetros del chip elegido y campo de texto.
  import { app } from '../stores/app.svelte.js';
  import { findNode, findParent } from '../core/doc.js';
  import { OP_TYPES, compose, format, formatOp, makeOp, parse } from '../core/formula.js';
  import { identity, multiply, toRows } from '../core/mat3.js';

  let { nodeId } = $props();

  const node = $derived(findNode(app.doc, nodeId));
  const ops = $derived(node?.t ?? []);
  const disabled = $derived(app.locked);

  let sel = $state(null);
  let adding = $state(null); // 'start' | 'end' | null
  let text = $state('');
  let textFocused = $state(false);
  let textError = $state('');
  let lockScale = $state(true);
  let dragFrom = $state(null);
  let dropAt = $state(null);

  // al cambiar de nodo se limpia la selección de chip
  $effect(() => {
    nodeId;
    sel = null;
    adding = null;
  });
  $effect(() => {
    const f = format(ops);
    if (!textFocused) {
      text = f;
      textError = '';
    }
  });
  $effect(() => {
    if (sel != null && sel >= ops.length) sel = ops.length ? ops.length - 1 : null;
  });

  const commit = (next, key = null) => app.setOps(nodeId, next, key);

  function add(op, where) {
    const next = [...ops];
    const o = makeOp(op);
    if (where === 'start') next.unshift(o);
    else next.push(o);
    commit(next);
    sel = where === 'start' ? 0 : next.length - 1;
    adding = null;
  }

  function patch(i, values) {
    const next = ops.map((o, j) => (j === i ? { ...o, ...values } : o));
    commit(next, `op-${nodeId}-${i}`);
  }

  function remove(i) {
    commit(ops.filter((_, j) => j !== i));
    sel = null;
  }

  function setE(i, axis, raw) {
    const v = parseFloat(raw);
    if (!Number.isFinite(v)) return;
    const o = ops[i];
    if (lockScale && o.x === o.y) patch(i, { x: v, y: v });
    else patch(i, { [axis]: v });
  }

  function onText(e) {
    text = e.currentTarget.value;
    const { ops: parsed, error } = parse(text);
    textError = error ?? '';
    if (!error) commit(parsed, `text-${nodeId}`);
  }

  // ---------- drag & drop de chips ----------
  function dstart(e, i) {
    dragFrom = i;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(i));
  }
  function dover(e, i) {
    if (dragFrom == null) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    dropAt = e.clientX < r.left + r.width / 2 ? i : i + 1;
  }
  function ddrop(e) {
    e.preventDefault();
    if (dragFrom == null || dropAt == null) return;
    const next = [...ops];
    const [moved] = next.splice(dragFrom, 1);
    let at = dropAt > dragFrom ? dropAt - 1 : dropAt;
    next.splice(at, 0, moved);
    commit(next);
    sel = at;
    dragFrom = dropAt = null;
  }
  function dend() {
    dragFrom = dropAt = null;
  }

  // ---------- fantasma del resultado parcial ----------
  function hover(k) {
    if (app.anim) return;
    const parent = findParent(app.doc, nodeId);
    const pw = (parent && app.evalMap.get(parent.id)?.world) ?? identity();
    app.ghost = { matrix: multiply(pw, compose(ops.slice(k))), label: format(ops.slice(k)) };
  }
  const unhover = () => (app.ghost = null);

  const rows = $derived(toRows(compose(ops)));
  const fmt = (v) => String(Math.round(v * 1000) / 1000);
</script>

<div class="fe">
  <div class="row chips" role="list" ondragover={(e) => e.preventDefault()} ondrop={ddrop}>
    <button class="add" {disabled} title="Agregar al principio" onclick={() => (adding = adding === 'start' ? null : 'start')}>+</button>
    {#each ops as o, i (i)}
      {#if dropAt === i && dragFrom != null}<span class="marker"></span>{/if}
      <button
        class="chip op-{o.op}"
        class:sel={sel === i}
        class:dragging={dragFrom === i}
        draggable={!disabled}
        {disabled}
        ondragstart={(e) => dstart(e, i)}
        ondragover={(e) => dover(e, i)}
        ondragend={dend}
        onclick={() => (sel = sel === i ? null : i)}
        onpointerenter={() => hover(i)}
        onpointerleave={unhover}
        title="{OP_TYPES[o.op].nombre} — arrastrá para reordenar"
      >{formatOp(o)}</button>
    {/each}
    {#if dropAt === ops.length && dragFrom != null}<span class="marker"></span>{/if}
    <button class="add" {disabled} title="Agregar al final" onclick={() => (adding = adding === 'end' ? null : 'end')}>+</button>
    {#if !ops.length}<span class="muted small">sin transformación (identidad)</span>{/if}
  </div>

  {#if adding}
    <div class="row picker">
      <span class="muted small">{adding === 'start' ? 'Al principio (actúa última):' : 'Al final (actúa primera):'}</span>
      {#each Object.entries(OP_TYPES) as [k, v]}
        <button class="op-{k} chip" onclick={() => add(k, adding)}>{k} · {v.nombre}</button>
      {/each}
    </div>
  {/if}

  {#if sel != null && ops[sel]}
    {@const o = ops[sel]}
    <div class="params op-{o.op}">
      <div class="phead">
        <strong>{OP_TYPES[o.op].nombre}</strong>
        <span class="muted small">({sel + 1} de {ops.length})</span>
        <span class="spacer"></span>
        <label class="stepsel" title="Paso de los campos y sliders">
          paso
          <select bind:value={app.settings.paso}>
            <option value="0.1">0.1</option>
            <option value="0.25">0.25</option>
            <option value="0.5">0.5</option>
            <option value="any">libre</option>
          </select>
        </label>
        <button class="icon danger" {disabled} title="Quitar esta operación" onclick={() => remove(sel)}>🗑</button>
      </div>

      {#if o.op === 'T'}
        {#each ['x', 'y'] as ax}
          <label class="prow">
            <span>{ax}</span>
            <input type="number" step={app.settings.paso} value={o[ax]} {disabled} oninput={(e) => patch(sel, { [ax]: parseFloat(e.currentTarget.value) || 0 })} />
            <input type="range" min="-100" max="100" step={app.settings.paso === 'any' ? '0.01' : app.settings.paso} value={o[ax]} {disabled} oninput={(e) => patch(sel, { [ax]: parseFloat(e.currentTarget.value) })} />
          </label>
        {/each}
      {:else if o.op === 'R'}
        <label class="prow">
          <span>θ°</span>
          <input type="number" step={app.settings.paso} value={o.ang} {disabled} oninput={(e) => patch(sel, { ang: parseFloat(e.currentTarget.value) || 0 })} />
          <input type="range" min="-360" max="360" step={app.settings.paso === 'any' ? '0.01' : app.settings.paso} value={o.ang} {disabled} oninput={(e) => patch(sel, { ang: parseFloat(e.currentTarget.value) })} />
        </label>
        <div class="row">
          {#each [-90, -45, 45, 90, 180] as a}
            <button {disabled} onclick={() => patch(sel, { ang: a })}>{a > 0 ? '+' : ''}{a}°</button>
          {/each}
        </div>
      {:else}
        {#each ['x', 'y'] as ax}
          <label class="prow">
            <span>s{ax}</span>
            <input type="number" step={app.settings.paso} value={o[ax]} {disabled} oninput={(e) => setE(sel, ax, e.currentTarget.value)} />
            <input type="range" min="-6" max="6" step={app.settings.paso === 'any' ? '0.01' : app.settings.paso} value={o[ax]} {disabled} oninput={(e) => setE(sel, ax, e.currentTarget.value)} />
          </label>
        {/each}
        <div class="row">
          <label class="small"><input type="checkbox" bind:checked={lockScale} /> escala uniforme</label>
          <button {disabled} title="Espejar en X (sx → −sx)" onclick={() => patch(sel, { x: -o.x })}>↔ espejar X</button>
          <button {disabled} title="Espejar en Y (sy → −sy)" onclick={() => patch(sel, { y: -o.y })}>↕ espejar Y</button>
        </div>
        {#if Math.abs(o.x) < 1e-9 || Math.abs(o.y) < 1e-9}
          <div class="err">Una escala 0 colapsa la forma (matriz singular).</div>
        {/if}
      {/if}
    </div>
  {/if}

  <label class="textrow">
    <span class="muted small">Fórmula</span>
    <input
      type="text"
      class="mono"
      value={text}
      {disabled}
      onfocus={() => (textFocused = true)}
      onblur={() => (textFocused = false)}
      oninput={onText}
      placeholder="T(10,0)*R(45)*E(2,2)"
    />
  </label>
  {#if textError}<div class="err">{textError}</div>{/if}

  <details>
    <summary>Ver matriz 3×3 de esta arista</summary>
    <table class="mat mono">
      <tbody>
        {#each rows as r}
          <tr>{#each r as v}<td>{fmt(v)}</td>{/each}</tr>
        {/each}
      </tbody>
    </table>
  </details>
</div>

<style>
  .fe {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .chips {
    min-height: 34px;
    padding: 4px;
    background: var(--panel-2);
    border-radius: var(--radius);
  }
  .small {
    font-size: 12px;
  }
  .chip {
    font-family: ui-monospace, Consolas, monospace;
    font-size: 12.5px;
    padding: 3px 8px;
    border-width: 2px;
    cursor: grab;
  }
  .chip.op-T { border-color: var(--op-T); }
  .chip.op-R { border-color: var(--op-R); }
  .chip.op-E { border-color: var(--op-E); }
  .chip.sel.op-T { background: color-mix(in srgb, var(--op-T) 20%, var(--panel)); }
  .chip.sel.op-R { background: color-mix(in srgb, var(--op-R) 20%, var(--panel)); }
  .chip.sel.op-E { background: color-mix(in srgb, var(--op-E) 20%, var(--panel)); }
  .chip.dragging {
    opacity: 0.4;
  }
  .add {
    padding: 2px 9px;
    font-weight: 700;
  }
  .marker {
    width: 3px;
    height: 24px;
    background: var(--accent);
    border-radius: 2px;
  }
  .params {
    border: 1px solid var(--border);
    border-left-width: 4px;
    border-radius: var(--radius);
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .params.op-T { border-left-color: var(--op-T); }
  .params.op-R { border-left-color: var(--op-R); }
  .params.op-E { border-left-color: var(--op-E); }
  .phead {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .spacer {
    flex: 1;
  }
  .stepsel {
    font-size: 12px;
    color: var(--muted);
    display: inline-flex;
    gap: 4px;
    align-items: center;
  }
  .stepsel select {
    font-size: 12px;
    padding: 1px 4px;
  }
  .prow {
    display: grid;
    grid-template-columns: 24px 70px 1fr;
    gap: 6px;
    align-items: center;
  }
  .prow input[type='range'] {
    width: 100%;
  }
  .textrow {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .err {
    color: var(--danger);
    font-size: 12px;
  }
  .mat {
    border-collapse: collapse;
    margin-top: 6px;
  }
  .mat td {
    border: 1px solid var(--border);
    padding: 2px 8px;
    text-align: right;
    min-width: 56px;
  }
  summary {
    cursor: pointer;
    font-size: 12px;
    color: var(--muted);
  }
</style>
