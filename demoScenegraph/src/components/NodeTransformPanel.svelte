<script>
  // Exploración de las transformaciones de un nodo: respecto del padre, de mundo
  // y la cadena de productos de matrices desde la raíz.
  import { app } from '../stores/app.svelte.js';
  import { chain, edgeMatrix } from '../core/evaluate.js';
  import { findNode, nodeLabel } from '../core/doc.js';
  import { decompose, multiply, toRows, identity } from '../core/mat3.js';
  import { format } from '../core/formula.js';

  let { nodeId } = $props();

  const node = $derived(findNode(app.doc, nodeId));
  const isRoot = $derived(nodeId === app.doc.raiz.id);
  const links = $derived(isRoot ? [] : chain(app.doc, nodeId));
  const local = $derived(isRoot ? identity() : edgeMatrix(node));
  const world = $derived(links.length ? links.at(-1).cumulative : identity());
  const dLocal = $derived(decompose(local));
  const dWorld = $derived(decompose(world));

  const f = (v) => String(Math.round(v * 1000) / 1000);
  const rows = (m) => toRows(m);

  function over(link) {
    app.ghost = { matrix: link.cumulative, label: `${nodeLabel(link.node)}` };
    app.hoverNodeId = link.node.id;
  }
  function out() {
    app.ghost = null;
    app.hoverNodeId = null;
  }
</script>

{#snippet matrix(m)}
  <table class="mat mono" aria-label="matriz 3x3">
    <tbody>
      {#each rows(m) as r}
        <tr>{#each r as v}<td>{f(v)}</td>{/each}</tr>
      {/each}
    </tbody>
  </table>
{/snippet}

{#snippet decomp(d)}
  <dl class="dec">
    <dt>posición</dt><dd class="mono">({f(d.tx)}, {f(d.ty)})</dd>
    <dt>rotación</dt><dd class="mono">{f(d.rot)}°</dd>
    <dt>escala</dt><dd class="mono">({f(d.sx)}, {f(d.sy)}){#if d.mirrored} <span class="badge">espejado</span>{/if}</dd>
  </dl>
  {#if d.hasShear}
    <div class="warn">
      La parte lineal incluye cizalla (k = {f(d.shear)}): una escala no uniforme quedó después de una rotación, y no se puede escribir como un único T·R·E.
    </div>
  {/if}
{/snippet}

{#if node}
  <div class="ntp">
    <h3>Respecto del padre</h3>
    {#if isRoot}
      <p class="muted">La Raíz es el origen del mundo (identidad).</p>
    {:else}
      <div class="mono formula">{format(node.t) || 'identidad'}</div>
      <div class="two">
        {@render matrix(local)}
        {@render decomp(dLocal)}
      </div>
    {/if}

    <h3>De mundo</h3>
    <div class="two">
      {@render matrix(world)}
      {@render decomp(dWorld)}
    </div>

    {#if links.length}
      <h3>Cadena de matrices (Raíz → nodo)</h3>
      <p class="muted small">
        M<sub>mundo</sub> = {links.map((_, i) => `M${i + 1}`).join(' · ')}. Pasá el mouse sobre un factor para ver el marco de coordenadas que resulta de multiplicar hasta ahí.
      </p>
      <ol class="chain">
        {#each links as l, i (l.node.id)}
          <li
            onpointerenter={() => over(l)}
            onpointerleave={out}
            class:active={app.hoverNodeId === l.node.id}
          >
            <div class="lhead">
              <strong>M{i + 1}</strong>
              <span class="muted">arista de</span>
              <button class="link" onclick={() => app.select(l.node.id)}>{nodeLabel(l.node)}</button>
              <span class="mono formula">{format(l.ops) || 'I'}</span>
            </div>
            <div class="two">
              <div>
                <div class="cap">factor</div>
                {@render matrix(l.matrix)}
              </div>
              <div>
                <div class="cap">producto M1…M{i + 1}</div>
                {@render matrix(l.cumulative)}
              </div>
            </div>
          </li>
        {/each}
      </ol>
    {/if}
  </div>
{/if}

<style>
  .ntp {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .small {
    font-size: 12px;
    margin: 0;
  }
  .two {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    align-items: flex-start;
  }
  .mat {
    border-collapse: collapse;
    font-size: 12px;
  }
  .mat td {
    border: 1px solid var(--border);
    padding: 1px 6px;
    text-align: right;
    min-width: 46px;
  }
  .dec {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 10px;
    margin: 0;
    font-size: 12.5px;
  }
  .dec dt {
    color: var(--muted);
  }
  .dec dd {
    margin: 0;
  }
  .badge {
    background: var(--accent-soft);
    border-radius: 999px;
    padding: 0 8px;
    font-size: 11px;
    font-family: system-ui, sans-serif;
  }
  .warn {
    margin-top: 4px;
    font-size: 12px;
    color: #92400e;
    background: #fef3c7;
    border-radius: var(--radius);
    padding: 6px 8px;
  }
  .formula {
    font-size: 12.5px;
  }
  .chain {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .chain li {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 6px 8px;
  }
  .chain li.active {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 7%, var(--panel));
  }
  .lhead {
    display: flex;
    gap: 6px;
    align-items: baseline;
    flex-wrap: wrap;
    margin-bottom: 4px;
  }
  .cap {
    font-size: 11px;
    color: var(--muted);
    margin-bottom: 2px;
  }
  .link {
    border: none;
    background: none;
    padding: 0;
    color: var(--accent);
    text-decoration: underline;
  }
</style>
