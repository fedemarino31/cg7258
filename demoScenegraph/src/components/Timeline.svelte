<script>
  import { app } from '../stores/app.svelte.js';
  import { findNode, nodeLabel } from '../core/doc.js';
  import { formatOp } from '../core/formula.js';

  let bar = $state(null);
  let scrubbing = false;

  const tl = $derived(app.timeline);
  const total = $derived(tl.total || 1);
  const pos = $derived(app.t == null ? 1 : app.t / total);
  const none = $derived(tl.stages.length === 0);

  function stageLabel(id) {
    const n = findNode(app.doc, id);
    return n.id === app.doc.raiz.id ? 'Raíz' : n.nombre || n.modelo || id;
  }

  function segLabel(seg) {
    if (seg.kind === 'op' && !app.ocultaFormulas) {
      const c = findNode(app.doc, seg.childId);
      const o = c?.t?.[seg.opIndex];
      return o ? formatOp(o) : '';
    }
    return '';
  }

  const colorOf = (seg) => {
    if (seg.kind !== 'op') return 'var(--panel-2)';
    const c = findNode(app.doc, seg.childId);
    const o = c?.t?.[seg.opIndex]?.op;
    return `color-mix(in srgb, var(--op-${o ?? 'T'}) 30%, var(--panel))`;
  };

  const status = $derived.by(() => {
    if (none) return 'Agregá hijos al árbol para ver la construcción.';
    if (!app.anim) return 'Resultado final. Presioná ▶ para ver cómo se construye.';
    const a = app.anim;
    const P = findNode(app.doc, a.frameId);
    const head = `Etapa ${a.stage + 1}/${tl.stages.length} · marco de ${nodeLabel(P)}`;
    if (a.seg.kind === 'intro') return `${head}: el padre está en el origen.`;
    if (a.seg.kind === 'hold') return `${head}: ${nodeLabel(P)} y sus hijos quedan como un bloque.`;
    const c = findNode(app.doc, a.activeChildId);
    if (a.seg.kind === 'appear') return `${head}: aparece ${nodeLabel(c)} en el origen.`;
    const k = a.activeOp;
    const n = c.t.length;
    if (app.ocultaFormulas) return `${head}: ${nodeLabel(c)} aplica la operación ${n - k} de ${n}.`;
    return `${head}: ${nodeLabel(c)} aplica ${formatOp(c.t[k])} (operación ${n - k} de ${n}, de derecha a izquierda).`;
  });

  function scrub(e) {
    const r = bar.getBoundingClientRect();
    app.pause();
    app.seek(((e.clientX - r.left) / r.width) * tl.total);
  }
  function down(e) {
    if (none) return;
    scrubbing = true;
    bar.setPointerCapture(e.pointerId);
    scrub(e);
  }
  const move = (e) => scrubbing && scrub(e);
  const up = () => (scrubbing = false);
</script>

<footer class="tl">
  <div class="controls">
    <button class="icon" disabled={none} title="Al inicio" onclick={() => app.rewind()}>⏮</button>
    <button class="icon" disabled={none} title="Etapa anterior" onclick={() => app.step('stage', -1)}>⏪</button>
    <button class="icon" disabled={none} title="Operación anterior (←)" onclick={() => app.step('op', -1)}>◀</button>
    <button class="icon primary" disabled={none} title="Reproducir / pausa (espacio)" onclick={() => app.toggle()}>{app.playing ? '⏸' : '▶'}</button>
    <button class="icon" disabled={none} title="Operación siguiente (→)" onclick={() => app.step('op', 1)}>▶</button>
    <button class="icon" disabled={none} title="Etapa siguiente" onclick={() => app.step('stage', 1)}>⏩</button>
    <button class="icon" disabled={none} title="Ver resultado final" onclick={() => app.showFinal()}>⏭</button>
    <select bind:value={app.speed} title="Velocidad">
      {#each [0.25, 0.5, 1, 2, 4] as s}<option value={s}>{s}×</option>{/each}
    </select>
    <span class="status">{status}</span>
  </div>

  <div
    class="bar"
    bind:this={bar}
    role="slider"
    tabindex="0"
    aria-label="Línea de tiempo"
    aria-valuemin="0"
    aria-valuemax={tl.total}
    aria-valuenow={app.t ?? tl.total}
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
  >
    {#each tl.stages as st (st.index)}
      <div class="stage" style="left:{(st.t0 / total) * 100}%; width:{((st.t1 - st.t0) / total) * 100}%">
        <div class="stlabel" title={st.nodeId}>{stageLabel(st.nodeId)}</div>
        <div class="segs">
          {#each st.segments as seg}
            <div class="seg" style="width:{((seg.t1 - seg.t0) / (st.t1 - st.t0)) * 100}%; background:{colorOf(seg)}" title={seg.kind}>
              {segLabel(seg)}
            </div>
          {/each}
        </div>
      </div>
    {/each}
    {#if !none}<div class="head" style="left:{pos * 100}%"></div>{/if}
  </div>
</footer>

<style>
  .tl {
    grid-column: 1 / 3;
    border-top: 1px solid var(--border);
    background: var(--panel);
    padding: 6px 10px 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .controls {
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .status {
    margin-left: 10px;
    font-size: 12.5px;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .bar {
    position: relative;
    height: 44px;
    background: var(--panel-2);
    border-radius: var(--radius);
    cursor: ew-resize;
    touch-action: none;
    user-select: none;
  }
  .stage {
    position: absolute;
    top: 0;
    bottom: 0;
    border-right: 2px solid var(--panel);
    box-sizing: border-box;
    overflow: hidden;
  }
  .stlabel {
    font-size: 10px;
    font-weight: 700;
    padding: 1px 4px;
    color: var(--muted);
    height: 14px;
  }
  .segs {
    display: flex;
    height: 28px;
  }
  .seg {
    font-size: 10px;
    font-family: ui-monospace, Consolas, monospace;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    white-space: nowrap;
    border-right: 1px solid var(--panel);
  }
  .head {
    position: absolute;
    top: -3px;
    bottom: -3px;
    width: 3px;
    margin-left: -1.5px;
    background: var(--accent);
    border-radius: 2px;
    pointer-events: none;
  }
</style>
