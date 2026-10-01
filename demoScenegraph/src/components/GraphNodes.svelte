<script>
  // Dibujo de aristas y nodos del grafo. Lo usan la vista interactiva y la de impresión.
  import { nodeLabel } from '../core/doc.js';
  import { NODE_H, edgeText, nodeW } from '../core/graphLayout.js';

  let {
    doc,
    layout,
    hide = false, // oculta las fórmulas de las aristas ("?")
    selectedId = null,
    hoverId = null,
    activeChild = null,
    bad = new Set(),
    dim = () => false,
    dropTarget = null,
    onnodedown = null,
    onedgedown = null,
    onenter = null,
    onleave = null,
  } = $props();

  const uid = $props.id();
</script>

<defs>
  <marker id="arrow-{uid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
    <path d="M0 0L10 5L0 10z" fill="var(--grid-strong)" />
  </marker>
</defs>

{#each layout.links as l (l.target.data.id)}
  {@const c = l.target}
  {@const p = l.source}
  {@const id = c.data.id}
  {@const active = activeChild === id}
  {@const txt = edgeText(c.data, hide)}
  {@const lx = c.x}
  {@const ly = c.y - NODE_H / 2 - 23}
  <g opacity={dim(id) ? 0.35 : 1}>
    <line
      x1={p.x} y1={p.y + NODE_H / 2} x2={c.x} y2={c.y - NODE_H / 2}
      stroke={active ? 'var(--op-R)' : selectedId === id ? 'var(--accent)' : 'var(--grid-strong)'}
      stroke-width={active || selectedId === id ? 2.5 : 1.3}
      marker-end="url(#arrow-{uid})"
    />
    {#if onedgedown}
      <line x1={p.x} y1={p.y + NODE_H / 2} x2={c.x} y2={c.y - NODE_H / 2} stroke="transparent" stroke-width="14"
        role="presentation" onpointerdown={(e) => onedgedown(e, id)} />
    {/if}
    {#if txt}
      <g transform="translate({lx} {ly})" role="presentation" onpointerdown={onedgedown ? (e) => onedgedown(e, id) : null} class:clickable={!!onedgedown}>
        <rect x={-txt.length * 3.3 - 5} y="-9" width={txt.length * 6.6 + 10} height="18" rx="4"
          fill="var(--panel)" stroke={active ? 'var(--op-R)' : 'var(--border)'} />
        <text text-anchor="middle" dominant-baseline="central" font-size="11.5" font-family="ui-monospace, Consolas, monospace" fill="var(--text)">{txt}</text>
      </g>
    {/if}
  </g>
{/each}

{#each layout.nodes as n (n.data.id)}
  {@const d = n.data}
  {@const w = nodeW(doc, d)}
  {@const m = d.modelo ? doc.modelos[d.modelo] : null}
  {@const isRoot = d.id === doc.raiz.id}
  {@const sel = selectedId === d.id}
  {@const isBad = bad.has(d.id)}
  <g
    data-node={d.id}
    transform="translate({n.x} {n.y})"
    opacity={dim(d.id) ? 0.35 : 1}
    role="presentation"
    class:clickable={!!onnodedown}
    onpointerdown={onnodedown ? (e) => onnodedown(e, d) : null}
    onpointerenter={onenter ? () => onenter(d.id) : null}
    onpointerleave={onleave ? () => onleave(d.id) : null}
  >
    {#if dropTarget === d.id}
      <rect x={-w / 2 - 5} y={-NODE_H / 2 - 5} width={w + 10} height={NODE_H + 10} rx="11" fill="none" stroke="var(--ok)" stroke-width="2.5" stroke-dasharray="4 3" />
    {/if}
    <rect
      x={-w / 2} y={-NODE_H / 2} width={w} height={NODE_H} rx="8"
      fill={isRoot ? 'var(--text)' : m ? m.color : 'var(--panel-2)'}
      fill-opacity={isRoot ? 1 : m ? 0.45 : 1}
      stroke={isBad ? 'var(--danger)' : sel ? 'var(--accent)' : m ? m.color : 'var(--grid-strong)'}
      stroke-width={sel || isBad ? 3 : 2}
    />
    {#if sel}
      <rect x={-w / 2 - 4} y={-NODE_H / 2 - 4} width={w + 8} height={NODE_H + 8} rx="11" fill="none" stroke="var(--accent)" stroke-opacity="0.4" stroke-width="3" />
    {/if}
    {#if hoverId === d.id && !sel}
      <rect x={-w / 2 - 3} y={-NODE_H / 2 - 3} width={w + 6} height={NODE_H + 6} rx="10" fill="none" stroke="var(--grid-strong)" stroke-opacity="0.6" stroke-width="2" />
    {/if}
    <text
      text-anchor="middle" dominant-baseline="central"
      font-size={m ? 15 : 12.5} font-weight={m || isRoot ? 700 : 500}
      font-family="system-ui, Arial, sans-serif"
      fill={isRoot ? 'var(--bg)' : 'var(--text)'}
      pointer-events="none"
    >{nodeLabel(d)}</text>
    {#if m && d.nombre}
      <text y={NODE_H / 2 + 11} text-anchor="middle" font-size="10" fill="var(--muted)" pointer-events="none">{d.nombre}</text>
    {/if}
  </g>
{/each}

<style>
  .clickable {
    cursor: pointer;
  }
</style>
