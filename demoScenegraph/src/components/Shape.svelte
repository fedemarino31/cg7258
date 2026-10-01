<script>
  // Una forma (o un contenedor) dibujada con su matriz de mundo.
  // Coordenadas de modelo con Y hacia arriba: el SVG padre aplica el flip de Y.
  import { modelPolygon, polygonBBox, polygonPath } from '../core/primitives.js';
  import { toSVG } from '../core/mat3.js';

  let {
    modelo = null, // { tipo, params, color, pivot } o null para un contenedor
    letra = '',
    matrix,
    opacity = 1,
    bad = false,
    selected = false,
    hovered = false,
    showLetter = true,
    axisLen = 12,
    onclick = null,
    onenter = null,
    onleave = null,
  } = $props();

  const uid = $props.id();

  const poly = $derived(modelo ? modelPolygon(modelo) : []);
  const bb = $derived(poly.length ? polygonBBox(poly) : null);
  const d = $derived(poly.length ? polygonPath(poly) : '');
  const fontSize = $derived(bb ? Math.max(4, Math.min(14, Math.min(bb.w, bb.h) * 0.45)) : 8);
  const color = $derived(modelo?.color ?? '#888');
  const L = $derived(axisLen);

  // Los ejes: línea + puntas de flecha (en unidades del modelo, así muestran la escala).
  const axisX = $derived(`M0 0 L${L} 0 M${L} 0 L${L - 2.6} 1.3 M${L} 0 L${L - 2.6} -1.3`);
  const axisY = $derived(`M0 0 L0 ${L} M0 ${L} L1.3 ${L - 2.6} M0 ${L} L-1.3 ${L - 2.6}`);
</script>

<g
  transform={toSVG(matrix)}
  opacity={opacity}
  class="shape"
  class:clickable={!!onclick}
  role="presentation"
  onclick={onclick}
  onpointerenter={onenter}
  onpointerleave={onleave}
>
  {#if modelo}
    <clipPath id="clip-{uid}"><path {d} /></clipPath>
    <path {d} fill={color} fill-opacity="0.5" />
    <!-- marca de orientación: mitad izquierda lisa, cuadrante sup. derecho claro, inf. derecho oscuro -->
    <g clip-path="url(#clip-{uid})" pointer-events="none">
      <rect x={bb.cx} y={bb.cy} width={bb.w} height={bb.h} fill="#fff" fill-opacity="0.45" />
      <rect x={bb.cx} y={bb.y0 - 1} width={bb.w} height={bb.h / 2 + 1} fill="#000" fill-opacity="0.22" />
    </g>
    <path
      {d}
      fill="none"
      stroke={color}
      stroke-width="2.5"
      stroke-linejoin="round"
      vector-effect="non-scaling-stroke"
    />
    {#if bad}
      <path {d} fill="none" stroke="#dc2626" stroke-width="2.5" stroke-dasharray="6 4" vector-effect="non-scaling-stroke" />
    {/if}
    {#if selected || hovered}
      <path
        {d}
        fill="none"
        stroke={selected ? '#2563eb' : '#64748b'}
        stroke-width="6"
        stroke-opacity="0.35"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
      />
    {/if}
    {#if showLetter && letra}
      <text
        transform="translate({bb.cx} {bb.cy}) scale(1 -1)"
        text-anchor="middle"
        dominant-baseline="central"
        font-size={fontSize}
        font-weight="700"
        font-family="system-ui, Arial, sans-serif"
        fill={color}
        fill-opacity="0.55"
        pointer-events="none">{letra}</text>
    {/if}
  {:else if selected || hovered}
    <circle r="3.2" fill="none" stroke={selected ? '#2563eb' : '#64748b'} stroke-width="3" stroke-opacity="0.5" vector-effect="non-scaling-stroke" />
  {/if}

  <!-- Ejes locales XY (siempre visibles). Los contenedores, más finos y punteados. -->
  <g
    fill="none"
    stroke-linecap="round"
    vector-effect="non-scaling-stroke"
    pointer-events="none"
  >
    <path
      d={axisX}
      stroke="var(--axis-x)"
      stroke-width={modelo ? 2 : 1.6}
      stroke-dasharray={modelo ? null : '5 3'}
      vector-effect="non-scaling-stroke"
    />
    <path
      d={axisY}
      stroke="var(--axis-y)"
      stroke-width={modelo ? 2 : 1.6}
      stroke-dasharray={modelo ? null : '5 3'}
      vector-effect="non-scaling-stroke"
    />
  </g>
</g>

<style>
  .clickable {
    cursor: pointer;
  }
</style>
