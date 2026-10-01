// Estado global de la aplicación (Svelte 5 runes).

import {
  addChild, addModel, clone, createDoc, duplicateNode, findNode, findParent, moveNode,
  removeModel, removeNode, renameModel, reorderChild, validateSchema, walk,
} from '../core/doc.js';
import { evaluate } from '../core/evaluate.js';
import { validate } from '../core/collide.js';
import { buildTimeline, staticItems, stateAt, stepTarget } from '../core/timeline.js';
import { importLegacy, isLegacy } from '../core/legacy.js';
import { generate } from '../core/generator.js';

const STORE_KEY = 'ge2d:doc:v2';
const MAX_HISTORY = 100;

const safe = (fn) => {
  try {
    return fn();
  } catch {
    return null;
  }
};

class App {
  doc = $state(createDoc());
  past = $state([]);
  future = $state([]);

  selectedId = $state(null);
  frameId = $state(null); // subárbol aislado (null = escena completa)

  mode = $state('editar'); // 'editar' | 'practica'
  practica = $state({ ocultarEscena: true, ocultarFormulas: false, revelado: false });
  docToken = $state(0); // cambia al cargar un documento nuevo (reencuadra el grafo)

  // reproducción
  t = $state(null); // null = vista estática (resultado final)
  playing = $state(false);
  speed = $state(1);

  settings = $state({ paso: '0.1', mostrarLetras: true, tema: 'auto' });
  ghost = $state(null); // { matrix, label } marco de un producto parcial (hover)
  hoverNodeId = $state(null);
  examples = $state([]);
  dialog = $state(null); // 'ejemplos' | 'generar' | 'imprimir' | null
  toast = $state('');

  evalMap = $derived(evaluate(this.doc, this.frameId));
  validation = $derived(validate(this.doc, this.frameId));
  timeline = $derived(buildTimeline(this.doc, this.frameId));
  anim = $derived(this.t == null ? null : stateAt(this.doc, this.timeline, this.t));
  items = $derived(this.anim ? this.anim.items : staticItems(this.doc, this.frameId));
  selected = $derived(this.selectedId ? findNode(this.doc, this.selectedId) : null);
  locked = $derived(this.mode === 'practica');
  // en modo práctica las fórmulas se ocultan (en grafo, línea de tiempo e inspector) hasta revelar
  ocultaFormulas = $derived(this.mode === 'practica' && this.practica.ocultarFormulas && !this.practica.revelado);

  #raf = 0;
  #last = 0;
  #coalesce = { key: null, at: 0 };
  #toastTimer = 0;

  // ---------- documento ----------

  /** Aplica una edición al documento con historial. coalesceKey agrupa ediciones seguidas. */
  edit(fn, coalesceKey = null) {
    if (this.locked) return;
    const now = performance.now();
    const same = coalesceKey && this.#coalesce.key === coalesceKey && now - this.#coalesce.at < 700;
    if (!same) {
      this.past.push($state.snapshot(this.doc));
      if (this.past.length > MAX_HISTORY) this.past.shift();
    }
    this.#coalesce = { key: coalesceKey, at: now };
    this.future = [];
    fn(this.doc);
    this.#afterChange();
  }

  undo() {
    if (!this.past.length) return;
    this.future.push($state.snapshot(this.doc));
    this.doc = this.past.pop();
    this.#coalesce = { key: null, at: 0 };
    this.#afterChange();
  }

  redo() {
    if (!this.future.length) return;
    this.past.push($state.snapshot(this.doc));
    this.doc = this.future.pop();
    this.#coalesce = { key: null, at: 0 };
    this.#afterChange();
  }

  #afterChange() {
    if (this.selectedId && !findNode(this.doc, this.selectedId)) this.selectedId = null;
    if (this.frameId && !findNode(this.doc, this.frameId)) this.frameId = null;
    if (this.t != null) this.t = Math.min(this.t, this.timeline.total);
    safe(() => localStorage.setItem(STORE_KEY, JSON.stringify($state.snapshot(this.doc))));
  }

  /** Reemplaza el documento (cargar, nuevo, importar). Reinicia historial y estado de vista. */
  setDoc(doc) {
    this.stop();
    this.doc = doc;
    this.past = [];
    this.future = [];
    this.selectedId = null;
    this.frameId = null;
    this.t = null;
    this.mode = 'editar';
    this.practica.revelado = false;
    this.docToken++;
    this.#afterChange();
  }

  newDoc() {
    this.setDoc(createDoc('Ejercicio nuevo'));
  }

  loadObject(data, titulo) {
    const doc = isLegacy(data) ? importLegacy(data, titulo) : data;
    const errors = validateSchema(doc);
    if (errors.length) throw new Error(errors.join('; '));
    this.setDoc(doc);
  }

  async loadExample(archivo) {
    const res = await fetch(`ejemplos/${archivo}`);
    if (!res.ok) throw new Error(`No se pudo cargar ${archivo}`);
    this.loadObject(await res.json());
  }

  async init() {
    try {
      this.examples = await (await fetch('ejemplos/index.json')).json();
    } catch {
      this.examples = [];
    }
    const saved = safe(() => JSON.parse(localStorage.getItem(STORE_KEY)));
    if (saved && !validateSchema(saved).length) {
      this.doc = saved;
    } else if (this.examples.length) {
      const first = this.examples.find((e) => e.archivo.includes('ejercicio-11')) ?? this.examples[0];
      await this.loadExample(first.archivo);
    }
  }

  generateDoc(opts) {
    const doc = generate(opts);
    this.setDoc(doc);
  }

  notify(msg) {
    this.toast = msg;
    clearTimeout(this.#toastTimer);
    this.#toastTimer = setTimeout(() => (this.toast = ''), 3500);
  }

  // ---------- selección y vista ----------

  select(id) {
    this.selectedId = id;
  }

  isolate(id) {
    const node = findNode(this.doc, id);
    if (!node || !(node.hijos?.length)) return;
    this.frameId = id === this.doc.raiz.id ? null : id;
    this.t = null;
    this.stop();
  }

  clearIsolation() {
    this.frameId = null;
    this.t = null;
    this.stop();
  }

  // ---------- ediciones de alto nivel ----------

  addChildTo(parentId, opts) {
    let created = null;
    this.edit((d) => (created = addChild(d, parentId, opts)));
    if (created) this.selectedId = created.id;
    return created;
  }

  removeSelected() {
    const id = this.selectedId;
    if (!id) return;
    this.edit((d) => removeNode(d, id));
  }

  duplicateSelected() {
    const id = this.selectedId;
    if (!id) return;
    let copy = null;
    this.edit((d) => (copy = duplicateNode(d, id)));
    if (copy) this.selectedId = copy.id;
  }

  move(id, parentId, index = null) {
    this.edit((d) => moveNode(d, id, parentId, index));
  }

  reorder(id, delta) {
    this.edit((d) => reorderChild(d, id, delta));
  }

  setOps(id, ops, coalesceKey = null) {
    this.edit((d) => {
      const n = findNode(d, id);
      if (n) n.t = ops;
    }, coalesceKey);
  }

  setModelOf(id, letra) {
    this.edit((d) => {
      const n = findNode(d, id);
      if (n) n.modelo = letra || null;
    });
  }

  setName(id, nombre) {
    this.edit((d) => {
      const n = findNode(d, id);
      if (n) n.nombre = nombre;
    }, 'name-' + id);
  }

  addModelOfType(tipo) {
    let letra = null;
    this.edit((d) => (letra = addModel(d, tipo)));
    return letra;
  }

  updateModel(letra, patch, coalesceKey = null) {
    this.edit((d) => {
      const m = d.modelos[letra];
      if (!m) return;
      if (patch.params) m.params = { ...m.params, ...patch.params };
      if (patch.color) m.color = patch.color;
      if (patch.pivot !== undefined) m.pivot = patch.pivot;
    }, coalesceKey);
  }

  deleteModel(letra) {
    this.edit((d) => removeModel(d, letra));
  }

  rename(from, to) {
    this.edit((d) => renameModel(d, from, to));
  }

  setTitle(titulo) {
    this.edit((d) => (d.titulo = titulo), 'titulo');
  }

  // ---------- reproducción ----------

  play() {
    if (this.timeline.total <= 0) return;
    if (this.t == null || this.t >= this.timeline.total - 1e-6) this.t = 0;
    this.playing = true;
    this.#last = performance.now();
    cancelAnimationFrame(this.#raf);
    const tick = (now) => {
      if (!this.playing) return;
      const dt = (now - this.#last) / 1000;
      this.#last = now;
      const next = (this.t ?? 0) + dt * this.speed;
      if (next >= this.timeline.total) {
        this.t = this.timeline.total;
        this.playing = false;
        return;
      }
      this.t = next;
      this.#raf = requestAnimationFrame(tick);
    };
    this.#raf = requestAnimationFrame(tick);
  }

  pause() {
    this.playing = false;
    cancelAnimationFrame(this.#raf);
  }

  stop() {
    this.pause();
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  seek(t) {
    this.t = Math.max(0, Math.min(this.timeline.total, t));
  }

  rewind() {
    this.pause();
    this.t = 0;
  }

  /** Vuelve a la vista estática (resultado final sin animación). */
  showFinal() {
    this.pause();
    this.t = null;
  }

  step(kind, dir) {
    this.pause();
    this.t = stepTarget(this.timeline, this.t ?? this.timeline.total, kind, dir);
  }

  // ---------- helpers ----------

  nodeCount() {
    let n = 0;
    for (const _ of walk(this.doc.raiz)) n++;
    return n;
  }

  parentOf(id) {
    return findParent(this.doc, id);
  }

  cloneDoc() {
    return clone($state.snapshot(this.doc));
  }
}

export const app = new App();
