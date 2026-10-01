<script>
  import { app } from '../stores/app.svelte.js';
  import { downloadPng, downloadSvg } from '../export.js';
  import GraphStatic from './GraphStatic.svelte';
  import SceneStatic from './SceneStatic.svelte';

  const VARIANTS = {
    enunciado1: {
      label: 'Enunciado 1: dado el grafo, dibujar la escena',
      consigna: 'Dado el siguiente grafo de escena, dibujar en la grilla la escena resultante.',
      grafo: true, hide: false, escena: false,
    },
    enunciado2: {
      label: 'Enunciado 2: dada la escena, completar las transformaciones',
      consigna: 'Dada la escena, completar las transformaciones de cada arista del grafo de escena.',
      grafo: true, hide: true, escena: true,
    },
    solucion: {
      label: 'Solución (grafo + escena)',
      consigna: 'Solución.',
      grafo: true, hide: false, escena: true,
    },
  };

  let variant = $state('enunciado1');
  let conSolucion = $state(false);
  let titulo = $state(app.doc.titulo || '');
  let sceneSvg = $state(null);
  let graphSvg = $state(null);
  let busy = $state(false);

  const pages = $derived(conSolucion && variant !== 'solucion' ? [variant, 'solucion'] : [variant]);
  const fileBase = $derived((app.doc.titulo || 'ejercicio').replace(/[^\w\-]+/g, '_'));

  // El SVG exportable es el de la última hoja que tiene escena/grafo.
  async function savePng(which) {
    const el = which === 'escena' ? sceneSvg : graphSvg;
    if (!el) return app.notify('Esta variante no incluye ese dibujo.');
    busy = true;
    try {
      await downloadPng(`${fileBase}-${which}.png`, el, which === 'escena' ? 2000 : 2400);
    } catch (e) {
      app.notify(e.message);
    } finally {
      busy = false;
    }
  }
  function saveSvg(which) {
    const el = which === 'escena' ? sceneSvg : graphSvg;
    if (!el) return app.notify('Esta variante no incluye ese dibujo.');
    downloadSvg(`${fileBase}-${which}.svg`, el, which === 'escena' ? 1200 : 1600);
  }
</script>

<div class="print-backdrop" role="presentation">
  <div class="dlg" role="dialog" aria-modal="true" aria-label="Imprimir o exportar" tabindex="-1" onkeydown={(e) => e.key === 'Escape' && (app.dialog = null)}>
    <aside class="controls">
      <div class="head">
        <strong>Imprimir / exportar</strong>
        <button class="icon" onclick={() => (app.dialog = null)} aria-label="Cerrar">✕</button>
      </div>

      <h3>Variante</h3>
      {#each Object.entries(VARIANTS) as [k, v]}
        <label class="radio"><input type="radio" name="variant" value={k} bind:group={variant} /> {v.label}</label>
      {/each}
      <label class="check"><input type="checkbox" bind:checked={conSolucion} disabled={variant === 'solucion'} /> Agregar la solución en otra hoja</label>

      <h3>Título de la hoja</h3>
      <input type="text" bind:value={titulo} />

      <h3>Imprimir</h3>
      <button class="primary" onclick={() => window.print()}>Imprimir / guardar como PDF</button>
      <p class="muted small">Hoja A4 vertical. En el cuadro de impresión del navegador elegí «Guardar como PDF» si querés un archivo.</p>

      <h3>Exportar imagen</h3>
      <div class="btns">
        <button disabled={busy} onclick={() => saveSvg('escena')}>Escena SVG</button>
        <button disabled={busy} onclick={() => savePng('escena')}>Escena PNG</button>
        <button disabled={busy} onclick={() => saveSvg('grafo')}>Grafo SVG</button>
        <button disabled={busy} onclick={() => savePng('grafo')}>Grafo PNG</button>
      </div>
      <p class="muted small">Las imágenes salen en colores claros, listas para pegar en un documento.</p>
    </aside>

    <div class="preview">
      {#each pages as pv, i (pv + i)}
        {@const v = VARIANTS[pv]}
        <article class="sheet light-scope">
          <h1>{titulo}</h1>
          <p class="consigna">{v.consigna}</p>
          <div class="graph"><GraphStatic doc={app.doc} hide={v.hide} bind:svg={graphSvg} /></div>
          <div class="scene"><SceneStatic doc={app.doc} showShapes={v.escena} bind:svg={sceneSvg} /></div>
        </article>
      {/each}
    </div>
  </div>
</div>

<style>
  .print-backdrop {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
  }
  .dlg {
    background: var(--panel);
    border-radius: 10px;
    width: min(1180px, 96vw);
    height: 92vh;
    display: grid;
    grid-template-columns: 300px 1fr;
    overflow: hidden;
    box-shadow: 0 20px 60px rgb(0 0 0 / 0.35);
  }
  .controls {
    padding: 12px 16px;
    overflow: auto;
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .radio,
  .check {
    display: flex;
    gap: 6px;
    align-items: flex-start;
    font-size: 13px;
  }
  .btns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .small {
    font-size: 12px;
    margin: 4px 0 0;
  }
  .preview {
    overflow: auto;
    background: #8b909a;
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }
  .sheet {
    width: 794px; /* A4 a 96 dpi */
    min-height: 1123px;
    flex: none;
    background: var(--panel);
    color: var(--text);
    padding: 40px 48px;
    box-shadow: 0 2px 12px rgb(0 0 0 / 0.35);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  h1 {
    font-size: 20px;
    margin: 0;
  }
  .consigna {
    margin: 0 0 4px;
    font-size: 13px;
  }
  .graph {
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px;
  }
  .graph :global(svg) {
    max-height: 380px;
  }
  .scene {
    width: 410px;
    align-self: center;
  }

  @media print {
    @page {
      size: A4;
      margin: 0;
    }
    :global(body) {
      overflow: visible !important;
      background: #fff !important;
    }
    :global(main) {
      display: block !important;
      height: auto !important;
    }
    :global(main > *:not(.print-backdrop)) {
      display: none !important;
    }
    .print-backdrop {
      position: static;
      display: block;
      background: none;
    }
    .dlg {
      display: block;
      width: auto;
      height: auto;
      box-shadow: none;
      border-radius: 0;
      overflow: visible;
      background: none;
    }
    .controls {
      display: none;
    }
    .preview {
      overflow: visible;
      background: none;
      padding: 0;
      gap: 0;
      display: block;
    }
    .sheet {
      box-shadow: none;
      width: 210mm;
      height: 297mm;
      min-height: 0;
      padding: 40px 48px;
      break-after: page;
      overflow: hidden;
    }
    .sheet:last-child {
      break-after: auto;
    }
  }
</style>
