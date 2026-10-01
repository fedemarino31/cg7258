<script>
  import { onMount } from 'svelte';
  import { app } from './stores/app.svelte.js';
  import TopBar from './components/TopBar.svelte';
  import SceneView from './components/SceneView.svelte';
  import GraphView from './components/GraphView.svelte';
  import Inspector from './components/Inspector.svelte';
  import Timeline from './components/Timeline.svelte';
  import ExamplesDialog from './components/ExamplesDialog.svelte';
  import GenerateDialog from './components/GenerateDialog.svelte';
  import PrintDialog from './components/PrintDialog.svelte';
  import HelpDialog from './components/HelpDialog.svelte';

  onMount(() => {
    app.init().then(async () => {
      // parámetros de prueba (solo en desarrollo): ?ex=archivo.json&t=2.5&sel=n4&iso=n2
      if (!import.meta.env.DEV) return;
      const q = new URLSearchParams(location.search);
      if (q.has('ex')) await app.loadExample(q.get('ex'));
      if (q.has('sel')) app.select(q.get('sel'));
      if (q.has('t')) app.seek(parseFloat(q.get('t')));
      if (q.has('iso')) app.isolate(q.get('iso'));
      if (q.has('dlg')) app.dialog = q.get('dlg');
    }).catch((e) => app.notify(e.message));
  });

  $effect(() => {
    const t = app.settings.tema;
    if (t === 'auto') {
      const dark = matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    } else document.documentElement.dataset.theme = t;
  });

  function onkey(e) {
    const tag = e.target?.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (e.key === 'F1') { e.preventDefault(); app.dialog = app.dialog === 'ayuda' ? null : 'ayuda'; return; }
    if (app.dialog === 'ayuda') return;
    if ((e.ctrlKey || e.metaKey) && !typing) {
      if (e.key === 'z') { e.preventDefault(); e.shiftKey ? app.redo() : app.undo(); }
      else if (e.key === 'y') { e.preventDefault(); app.redo(); }
      return;
    }
    if (typing) return;
    if (e.key === ' ') { e.preventDefault(); app.toggle(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); app.step('op', 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); app.step('op', -1); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && app.selectedId && app.selectedId !== app.doc.raiz.id) {
      e.preventDefault();
      app.removeSelected();
    } else if (e.key === 'Escape') {
      app.select(null);
      app.dialog = null;
    }
  }
</script>

<svelte:window onkeydown={onkey} />

<main>
  <TopBar />
  <SceneView />
  <GraphView />
  <Inspector />
  <Timeline />

  {#if app.dialog === 'ejemplos'}<ExamplesDialog />{/if}
  {#if app.dialog === 'generar'}<GenerateDialog />{/if}
  {#if app.dialog === 'imprimir'}<PrintDialog />{/if}
  {#if app.dialog === 'ayuda'}<HelpDialog />{/if}
  {#if app.toast}<div class="toast" role="status">{app.toast}</div>{/if}
</main>

<style>
  main {
    height: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr 340px;
    grid-template-rows: 46px minmax(0, 1fr) auto;
  }
  main > :global(.inspector) {
    grid-column: 3;
    grid-row: 2 / 4;
  }
  .toast {
    position: fixed;
    bottom: 90px;
    left: 50%;
    transform: translateX(-50%);
    background: #1f2430;
    color: #fff;
    padding: 8px 16px;
    border-radius: 8px;
    z-index: 100;
    box-shadow: 0 6px 20px rgb(0 0 0 / 0.3);
  }
</style>
