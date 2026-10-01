<script>
  // Grafo estático (sin interacción) para impresión y exportación.
  import { layoutTree } from '../core/graphLayout.js';
  import GraphNodes from './GraphNodes.svelte';

  let { doc, hide = false, svg = $bindable(null) } = $props();

  const layout = $derived(layoutTree(doc, hide));
  const vb = $derived.by(() => {
    const b = layout.bounds;
    const pad = 16;
    return `${b.x0 - pad} ${b.y0 - pad} ${b.x1 - b.x0 + 2 * pad} ${b.y1 - b.y0 + 2 * pad}`;
  });
</script>

<svg bind:this={svg} viewBox={vb} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Grafo de escena">
  <GraphNodes {doc} {layout} {hide} />
</svg>

<style>
  svg {
    width: 100%;
    height: auto;
    display: block;
  }
</style>
