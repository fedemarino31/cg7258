<script>
  // Escena estática (sin interacción) para impresión y exportación.
  import { gridPaths, gridTicks } from '../core/grid.js';
  import { staticItems } from '../core/timeline.js';
  import { findNode } from '../core/doc.js';
  import { describeParams, modelPolygon, polygonBBox } from '../core/primitives.js';
  import Shape from './Shape.svelte';

  let { doc, showShapes = true, showLegend = true, svg = $bindable(null) } = $props();

  const g = $derived(doc.grilla);
  const pad = 10;
  const side = $derived(g.max - g.min + 2 * pad);
  const paths = $derived(gridPaths(g));
  const ticks = $derived(gridTicks(g));
  const items = $derived(staticItems(doc));
  const models = $derived(Object.entries(doc.modelos));

  function legendBox(modelo) {
    const bb = polygonBBox(modelPolygon(modelo));
    const s = Math.max(bb.w, bb.h, 20) * 0.7;
    return `${bb.cx - s} ${-(bb.cy + s)} ${2 * s} ${2 * s}`;
  }
</script>

<div class="scene">
  <svg bind:this={svg} viewBox="{g.min - pad} {-(g.max + pad)} {side} {side}" role="img" aria-label="Escena 2D">
    <rect x={g.min - pad} y={-(g.max + pad)} width={side} height={side} fill="var(--panel)" />
    <g transform="scale(1 -1)">
      <path d={paths.minor} stroke="var(--grid)" stroke-width="1" vector-effect="non-scaling-stroke" fill="none" />
      <path d={paths.major} stroke="var(--grid-strong)" stroke-width="1.5" vector-effect="non-scaling-stroke" fill="none" />
      <rect x={g.min} y={g.min} width={g.max - g.min} height={g.max - g.min} fill="none" stroke="var(--grid-strong)" stroke-width="1" vector-effect="non-scaling-stroke" />
      {#each ticks as v}
        <text transform="translate({v} -1.2) scale(1 -1)" font-size="3.4" font-family="system-ui, Arial, sans-serif" text-anchor="middle" fill="var(--muted)" dominant-baseline="hanging">{v}</text>
        <text transform="translate(-1.2 {v}) scale(1 -1)" font-size="3.4" font-family="system-ui, Arial, sans-serif" text-anchor="end" fill="var(--muted)" dominant-baseline="central">{v}</text>
      {/each}
      {#if showShapes}
        {#each items as it (it.id)}
          {@const node = findNode(doc, it.id)}
          {#if node && (it.id !== doc.raiz.id || node.modelo)}
            <Shape modelo={node.modelo ? doc.modelos[node.modelo] : null} letra={node.modelo ?? ''} matrix={it.matrix} />
          {/if}
        {/each}
      {/if}
      <circle r="1.4" fill="var(--text)" />
    </g>
  </svg>

  {#if showLegend}
    <div class="legend">
      {#each models as [letra, m] (letra)}
        <div class="model">
          <svg viewBox={legendBox(m)} width="60" height="60">
            <g transform="scale(1 -1)"><Shape modelo={m} {letra} matrix={[1, 0, 0, 1, 0, 0]} /></g>
          </svg>
          <div class="name">modelo {letra}</div>
          <div class="dims">{describeParams(m)}</div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  svg {
    width: 100%;
    height: auto;
    display: block;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    justify-content: center;
    margin-top: 6px;
  }
  .model {
    display: flex;
    flex-direction: column;
    align-items: center;
    font-size: 12px;
  }
  .model svg {
    width: 60px;
  }
  .name {
    font-weight: 700;
  }
  .dims {
    font-size: 11px;
    color: var(--muted);
  }
</style>
