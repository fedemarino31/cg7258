<script>
  import { app } from '../stores/app.svelte.js';
  import { findNode, isDescendant, nodeLabel } from '../core/doc.js';
  import { NODE_H, layoutTree, nodeW } from '../core/graphLayout.js';
  import GraphNodes from './GraphNodes.svelte';

  let width = $state(600);
  let height = $state(500);
  let view = $state({ x: 0, y: 0, k: 1 });
  let userMoved = false;
  let svgEl = $state(null);

  const hide = $derived(app.ocultaFormulas);
  const layout = $derived(layoutTree(app.doc, hide));
  const bounds = $derived(layout.bounds);

  function fit() {
    const b = bounds;
    const w = b.x1 - b.x0 + 80;
    const h = b.y1 - b.y0 + 90;
    const k = Math.min(1.4, width / w, height / h);
    view = { k, x: width / 2 - ((b.x0 + b.x1) / 2) * k, y: 40 * k + 10 };
    userMoved = false;
  }

  // reencuadrar al cambiar el documento o su estructura (si el usuario no movió la vista)
  const signature = $derived(layout.nodes.map((n) => n.data.id).join(','));
  $effect(() => {
    signature;
    width;
    height;
    if (!userMoved) fit();
  });
  $effect(() => {
    app.docToken;
    userMoved = false;
  });

  // ---------- pan / zoom ----------
  function onwheel(e) {
    e.preventDefault();
    const r = svgEl.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const k = Math.max(0.2, Math.min(3, view.k * Math.exp(-e.deltaY * 0.0015)));
    view = { k, x: mx - ((mx - view.x) / view.k) * k, y: my - ((my - view.y) / view.k) * k };
    userMoved = true;
  }

  let pan = null;
  function onbgdown(e) {
    if (e.button !== 0 || drag) return;
    pan = { sx: e.clientX, sy: e.clientY, x: view.x, y: view.y, moved: false };
    svgEl.setPointerCapture(e.pointerId);
  }

  // ---------- arrastrar nodos para reubicarlos ----------
  let drag = $state(null); // { id, x, y, target, started }
  function onnodedown(e, n) {
    e.stopPropagation();
    if (e.button !== 0) return;
    app.select(n.id);
    if (n.id === app.doc.raiz.id || app.locked) return;
    drag = { id: n.id, sx: e.clientX, sy: e.clientY, x: 0, y: 0, target: null, started: false };
    svgEl.setPointerCapture(e.pointerId);
  }

  function onmove(e) {
    if (drag) {
      const r = svgEl.getBoundingClientRect();
      if (!drag.started && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
      drag.started = true;
      drag.x = (e.clientX - r.left - view.x) / view.k;
      drag.y = (e.clientY - r.top - view.y) / view.k;
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-node]');
      const tid = el?.getAttribute('data-node') ?? null;
      drag.target = tid && tid !== drag.id && !isDescendant(app.doc, drag.id, tid) ? tid : null;
    } else if (pan) {
      const dx = e.clientX - pan.sx;
      const dy = e.clientY - pan.sy;
      if (Math.hypot(dx, dy) > 3) pan.moved = true;
      view = { ...view, x: pan.x + dx, y: pan.y + dy };
      userMoved = true;
    }
  }

  function onup() {
    if (drag) {
      if (drag.started && drag.target) app.move(drag.id, drag.target);
      drag = null;
    }
    if (pan) {
      if (!pan.moved) app.select(null);
      pan = null;
    }
  }

  // ---------- estado visual ----------
  const inFrame = (id) => !app.frameId || app.evalMap.has(id);

  // recuadros de "pieza armada" para las etapas ya completadas
  const doneBoxes = $derived.by(() => {
    if (!app.anim) return [];
    const done = new Set(app.anim.doneStages);
    const out = [];
    for (const n of layout.nodes) {
      if (!done.has(n.data.id)) continue;
      const pad = 8 + n.height * 5;
      let x0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const d of n.descendants()) {
        const w = nodeW(app.doc, d.data);
        x0 = Math.min(x0, d.x - w / 2);
        x1 = Math.max(x1, d.x + w / 2);
        y1 = Math.max(y1, d.y + NODE_H / 2);
      }
      out.push({ id: n.data.id, x: x0 - pad, y: n.y - NODE_H / 2 - pad, w: x1 - x0 + 2 * pad, h: y1 - n.y + NODE_H + 2 * pad - NODE_H });
    }
    return out;
  });

  const activeChild = $derived(app.anim?.activeChildId ?? null);

  // ---------- acciones de la barra ----------
  let newModel = $state('');
  const modelKeys = $derived(Object.keys(app.doc.modelos));
  const chosenModel = $derived(newModel in app.doc.modelos ? newModel : modelKeys[0] ?? '');
  const parentForAdd = $derived(app.selectedId ?? app.doc.raiz.id);

  function addShape() {
    const letra = chosenModel;
    if (!letra) {
      app.notify('Primero agregá un modelo en la pestaña «Modelos».');
      return;
    }
    app.addChildTo(parentForAdd, { modelo: letra, t: [] });
  }
  const addContainer = () => app.addChildTo(parentForAdd, { modelo: null, t: [], nombre: '' });
  const canIsolate = $derived(app.selected && (app.selected.hijos?.length ?? 0) > 0);
</script>

<section class="graph">
  <header>
    <strong>Grafo</strong>
    <span class="spacer"></span>
    <label class="add" title="Se agrega como hijo del nodo seleccionado (o de la Raíz)">
      <select value={chosenModel} onchange={(e) => (newModel = e.currentTarget.value)} disabled={app.locked || !modelKeys.length}>
        {#each modelKeys as k}<option value={k}>{k}</option>{/each}
      </select>
      <button disabled={app.locked || !modelKeys.length} onclick={addShape}>+ Forma</button>
    </label>
    <button disabled={app.locked} onclick={addContainer} title="Agrega un contenedor (nodo sin forma)">+ Contenedor</button>
    <button
      class="icon"
      disabled={app.locked || !app.selectedId || app.selectedId === app.doc.raiz.id}
      title="Duplicar subárbol"
      onclick={() => app.duplicateSelected()}>⧉</button>
    <button
      class="icon"
      disabled={app.locked || !app.selectedId || app.selectedId === app.doc.raiz.id}
      title="Mover antes entre hermanos"
      onclick={() => app.reorder(app.selectedId, -1)}>◀</button>
    <button
      class="icon"
      disabled={app.locked || !app.selectedId || app.selectedId === app.doc.raiz.id}
      title="Mover después entre hermanos"
      onclick={() => app.reorder(app.selectedId, 1)}>▶</button>
    <button
      class="icon danger"
      disabled={app.locked || !app.selectedId || app.selectedId === app.doc.raiz.id}
      title="Eliminar nodo y su subárbol (Supr)"
      onclick={() => app.removeSelected()}>🗑</button>
    {#if app.frameId}
      <button class="primary" onclick={() => app.clearIsolation()} title="Volver a ver el árbol completo">✕ Salir del aislamiento</button>
    {:else}
      <button disabled={!canIsolate} onclick={() => app.isolate(app.selectedId)} title="Ver solo este subárbol y su animación">Aislar</button>
    {/if}
    <button class="icon" title="Encuadrar" onclick={fit}>⤢</button>
  </header>

  <div class="area" bind:clientWidth={width} bind:clientHeight={height}>
    <svg
      bind:this={svgEl}
      {width}
      {height}
      role="application"
      aria-label="Grafo de escena"
      onwheel={onwheel}
      onpointerdown={onbgdown}
      onpointermove={onmove}
      onpointerup={onup}
      onpointercancel={onup}
    >
      <g transform="translate({view.x} {view.y}) scale({view.k})">
        {#each doneBoxes as b (b.id)}
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="12" fill="var(--accent)" fill-opacity="0.06" stroke="var(--accent)" stroke-dasharray="5 4" stroke-opacity="0.7" />
        {/each}

        <GraphNodes
          doc={app.doc}
          {layout}
          {hide}
          selectedId={app.selectedId}
          hoverId={app.hoverNodeId}
          activeChild={activeChild}
          bad={app.mode === 'editar' ? app.validation.bad : new Set()}
          dim={(id) => !inFrame(id)}
          dropTarget={drag?.started ? drag.target : null}
          onnodedown={onnodedown}
          onedgedown={(e, id) => { e.stopPropagation(); app.select(id); }}
          onenter={(id) => (app.hoverNodeId = id)}
          onleave={() => (app.hoverNodeId = null)}
        />

        {#if drag?.started}
          <g transform="translate({drag.x} {drag.y})" opacity="0.7" pointer-events="none">
            <rect x="-24" y="-13" width="48" height="26" rx="8" fill="var(--accent)" fill-opacity="0.3" stroke="var(--accent)" />
            <text text-anchor="middle" dominant-baseline="central" font-size="13">{nodeLabel(findNode(app.doc, drag.id))}</text>
          </g>
        {/if}
      </g>
    </svg>
    <div class="hint muted">Arrastrá un nodo sobre otro para cambiarle el padre · rueda: zoom · arrastrar fondo: mover</div>
  </div>
</section>

<style>
  .graph {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    background: var(--panel);
  }
  header {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    padding: 6px 10px;
    min-height: 36px;
    border-bottom: 1px solid var(--border);
  }
  .spacer {
    flex: 1;
  }
  .add {
    display: inline-flex;
    gap: 3px;
  }
  .area {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  svg {
    display: block;
    touch-action: none;
    cursor: grab;
    user-select: none;
  }
  .hint {
    position: absolute;
    left: 10px;
    bottom: 6px;
    font-size: 11px;
    pointer-events: none;
  }
</style>
