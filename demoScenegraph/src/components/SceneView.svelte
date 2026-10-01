<script>
  import { app } from '../stores/app.svelte.js';
  import { findNode, nodeLabel } from '../core/doc.js';
  import { describeParams, modelPolygon, polygonBBox } from '../core/primitives.js';
  import { toSVG } from '../core/mat3.js';
  import Shape from './Shape.svelte';

  const g = $derived(app.doc.grilla);
  const pad = 10;
  const baseVB = $derived({ x: g.min - pad, y: -(g.max + pad), w: g.max - g.min + 2 * pad, h: g.max - g.min + 2 * pad });

  // vista (pan y zoom): null = encuadre inicial
  let custom = $state(null);
  const vbox = $derived(custom ?? baseVB);
  const vb = $derived(`${vbox.x} ${vbox.y} ${vbox.w} ${vbox.h}`);
  const zoomed = $derived(custom !== null);
  let svgEl = $state(null);

  const resetView = () => (custom = null);
  $effect(() => {
    app.docToken;
    custom = null;
  });

  function userPoint(e) {
    const m = svgEl.getScreenCTM().inverse();
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
    return { x: pt.x, y: pt.y };
  }

  function onwheel(e) {
    e.preventDefault();
    const f = Math.exp(-e.deltaY * 0.0015);
    const cur = vbox;
    const w = Math.max(baseVB.w / 12, Math.min(baseVB.w * 1.5, cur.w / f));
    const ff = cur.w / w;
    const p = userPoint(e);
    custom = { x: p.x - (p.x - cur.x) / ff, y: p.y - (p.y - cur.y) / ff, w, h: cur.h / ff };
  }

  let pan = null;
  let moved = false;
  function onpointerdown(e) {
    if (e.button !== 0) return;
    pan = { sx: e.clientX, sy: e.clientY, vb: { ...vbox }, scale: svgEl.getScreenCTM().a };
    moved = false;
    window.addEventListener('pointermove', onpanmove);
    window.addEventListener('pointerup', onpanend, { once: true });
  }
  function onpanmove(e) {
    if (!pan) return;
    const dx = e.clientX - pan.sx;
    const dy = e.clientY - pan.sy;
    if (!moved && Math.hypot(dx, dy) < 4) return;
    moved = true;
    custom = { ...pan.vb, x: pan.vb.x - dx / pan.scale, y: pan.vb.y - dy / pan.scale };
  }
  function onpanend() {
    pan = null;
    window.removeEventListener('pointermove', onpanmove);
  }
  const pick = (id) => {
    if (!moved) app.select(id);
  };

  // líneas de la grilla (en coordenadas de modelo; el grupo aplica el flip de Y)
  const gridPath = $derived.by(() => {
    let minor = '';
    let major = '';
    for (let v = g.min; v <= g.max + 1e-9; v += g.paso) {
      const p = `M${v} ${g.min}V${g.max}M${g.min} ${v}H${g.max}`;
      if (Math.abs(v) < 1e-9) continue;
      minor += p;
    }
    major = `M0 ${g.min}V${g.max}M${g.min} 0H${g.max}`;
    return { minor, major };
  });

  const ticks = $derived.by(() => {
    const out = [];
    for (let v = g.min; v <= g.max; v += g.paso * 2) if (Math.abs(v) > 1e-9) out.push(v);
    return out;
  });

  const hideScene = $derived(
    app.mode === 'practica' && app.practica.ocultarEscena && !app.practica.revelado
  );

  const frameNode = $derived(app.anim ? findNode(app.doc, app.anim.frameId) : null);

  const showErrors = $derived(app.mode === 'editar' && !app.anim);

  const models = $derived(Object.entries(app.doc.modelos));

  function legendBox(modelo) {
    const bb = polygonBBox(modelPolygon(modelo));
    const s = Math.max(bb.w, bb.h, 20) * 0.7;
    const cx = bb.cx;
    const cy = bb.cy;
    return `${cx - s} ${-(cy + s)} ${2 * s} ${2 * s}`;
  }
</script>

<section class="scene">
  <header>
    <strong>Escena</strong>
    {#if app.frameId}
      <span class="chip iso">
        Subárbol aislado: {nodeLabel(findNode(app.doc, app.frameId))}
        <button class="icon" title="Volver al árbol completo" onclick={() => app.clearIsolation()}>✕</button>
      </span>
    {/if}
    <span class="spacer"></span>
    <button class="icon" title="Encuadrar: volver a la vista inicial (doble clic en la grilla)" disabled={!zoomed} onclick={resetView}>⤢ Encuadrar</button>
    {#if app.anim && frameNode}
      <span class="chip">
        Etapa {app.anim.stage + 1}/{app.timeline.stages.length} · marco: {nodeLabel(frameNode)}
      </span>
    {/if}
  </header>

  <div class="canvas">
    <svg
      bind:this={svgEl}
      viewBox={vb}
      preserveAspectRatio="xMidYMid meet"
      role="application"
      aria-label="Escena 2D"
      class:panning={moved && pan}
      onwheel={onwheel}
      onpointerdown={onpointerdown}
      ondblclick={resetView}
    >
      <rect x={-1000} y={-1000} width="2000" height="2000" fill="var(--panel)" />
      <g transform="scale(1 -1)">
        <path d={gridPath.minor} stroke="var(--grid)" stroke-width="1" vector-effect="non-scaling-stroke" fill="none" />
        <path d={gridPath.major} stroke="var(--grid-strong)" stroke-width="1.5" vector-effect="non-scaling-stroke" fill="none" />
        <rect x={g.min} y={g.min} width={g.max - g.min} height={g.max - g.min} fill="none" stroke="var(--grid-strong)" stroke-width="1" vector-effect="non-scaling-stroke" />
        {#each ticks as v}
          <text transform="translate({v} -1.2) scale(1 -1)" font-size="3.4" text-anchor="middle" fill="var(--muted)" dominant-baseline="hanging">{v}</text>
          <text transform="translate(-1.2 {v}) scale(1 -1)" font-size="3.4" text-anchor="end" fill="var(--muted)" dominant-baseline="central">{v}</text>
        {/each}

        {#if !hideScene}
          {#each app.items as it (it.id)}
            {@const node = findNode(app.doc, it.id)}
            {#if node && (it.id !== app.doc.raiz.id || node.modelo)}
              <Shape
                modelo={node.modelo ? app.doc.modelos[node.modelo] : null}
                letra={node.modelo ?? ''}
                matrix={it.matrix}
                opacity={it.opacity}
                showLetter={app.settings.mostrarLetras}
                bad={showErrors && app.validation.bad.has(it.id)}
                selected={app.selectedId === it.id}
                hovered={app.hoverNodeId === it.id}
                onclick={() => pick(it.id)}
                onenter={() => (app.hoverNodeId = it.id)}
                onleave={() => (app.hoverNodeId = null)}
              />
            {/if}
          {/each}
        {/if}

        <!-- origen del marco actual -->
        <circle r="1.4" fill="var(--text)" />

        {#if app.ghost && !hideScene}
          <g transform={toSVG(app.ghost.matrix)} pointer-events="none">
            <path d="M0 0H20M20 0l-3 1.5M20 0l-3 -1.5" stroke="var(--axis-x)" stroke-width="3" fill="none" stroke-dasharray="4 2" vector-effect="non-scaling-stroke" />
            <path d="M0 0V20M0 20l1.5 -3M0 20l-1.5 -3" stroke="var(--axis-y)" stroke-width="3" fill="none" stroke-dasharray="4 2" vector-effect="non-scaling-stroke" />
            <circle r="1.8" fill="var(--accent)" />
            <text transform="translate(3 3) scale(1 -1)" font-size="5" fill="var(--accent)" font-weight="700">{app.ghost.label}</text>
          </g>
        {/if}
      </g>
    </svg>

    {#if hideScene}
      <div class="veil">
        <p>Modo práctica: la escena está oculta</p>
        <button class="primary" onclick={() => (app.practica.revelado = true)}>Revelar resultado</button>
      </div>
    {/if}
  </div>

  <div class="axes-ref" aria-label="Referencia de ejes">
    <svg width="46" height="12" viewBox="0 0 46 12"><path d="M1 6H42M42 6l-5 -3.5M42 6l-5 3.5" stroke="var(--axis-x)" stroke-width="1.6" fill="none" stroke-linecap="round" /></svg>
    <span>X</span>
    <svg width="12" height="30" viewBox="0 0 12 30"><path d="M6 29V3M6 2l-3.5 5M6 2l3.5 5" stroke="var(--axis-y)" stroke-width="1.6" fill="none" stroke-linecap="round" /></svg>
    <span>Y</span>
    <span class="hintz">rueda: zoom · arrastrar: mover · doble clic: encuadrar</span>
  </div>

  <footer class="legend">
    {#each models as [letra, m] (letra)}
      <div class="model">
        <svg viewBox={legendBox(m)} width="64" height="64">
          <g transform="scale(1 -1)">
            <Shape modelo={m} {letra} matrix={[1, 0, 0, 1, 0, 0]} axisLen={Math.max(6, 12)} showLetter={app.settings.mostrarLetras} />
          </g>
        </svg>
        <div class="name">modelo {letra}</div>
        <div class="dims muted">{describeParams(m)}</div>
      </div>
    {:else}
      <span class="muted">Sin modelos. Agregá uno en la pestaña «Modelos».</span>
    {/each}
  </footer>
</section>

<style>
  .scene {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    background: var(--bg);
    border-right: 1px solid var(--border);
  }
  header {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 6px 10px;
    min-height: 36px;
  }
  .chip {
    background: var(--accent-soft);
    border-radius: 999px;
    padding: 2px 10px;
    font-size: 12px;
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }
  .chip button {
    border: none;
    background: transparent;
    padding: 0 4px;
    min-width: 0;
  }
  .canvas {
    position: relative;
    flex: 1;
    min-height: 0;
    padding: 0 10px;
  }
  .canvas svg {
    width: 100%;
    height: 100%;
    display: block;
  }
  .veil {
    position: absolute;
    inset: 0 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--panel) 55%, transparent);
  }
  .spacer {
    flex: 1;
  }
  .axes-ref {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 14px 4px;
    font-size: 11px;
    color: var(--muted);
    opacity: 0.85;
  }
  .axes-ref svg {
    display: block;
    overflow: visible;
  }
  .hintz {
    margin-left: auto;
    opacity: 0.8;
  }
  .canvas svg {
    cursor: grab;
    touch-action: none;
    user-select: none;
  }
  .canvas svg.panning {
    cursor: grabbing;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    padding: 8px 12px 10px;
    border-top: 1px solid var(--border);
    background: var(--panel);
    max-height: 170px;
    overflow: auto;
  }
  .model {
    display: flex;
    flex-direction: column;
    align-items: center;
    font-size: 12px;
    min-width: 80px;
  }
  .name {
    font-weight: 700;
    margin-top: 2px;
  }
  .dims {
    font-size: 11px;
  }
</style>
