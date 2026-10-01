// Documento del ejercicio (formato v2) y operaciones sobre el árbol.
// Las funciones de edición MUTAN el documento que reciben; el store se encarga
// de clonar antes para el historial de deshacer.

import { defaultParams, nextModelColor, nextModelLetter } from './primitives.js';

export const FORMAT = 'grafo-escena-2d';
export const VERSION = 2;

export const DEFAULT_GRID = { min: -100, max: 100, paso: 10 };

export function createDoc(titulo = 'Ejercicio nuevo') {
  return {
    formato: FORMAT,
    version: VERSION,
    titulo,
    grilla: { ...DEFAULT_GRID },
    modelos: {},
    raiz: { id: 'n0', nombre: 'Raíz', hijos: [] },
  };
}

export function clone(doc) {
  return structuredClone(doc);
}

export function* walk(node, parent = null, depth = 0) {
  yield { node, parent, depth };
  for (const h of node.hijos ?? []) yield* walk(h, node, depth + 1);
}

export function findNode(doc, id) {
  for (const { node } of walk(doc.raiz)) if (node.id === id) return node;
  return null;
}

export function findParent(doc, id) {
  for (const { node, parent } of walk(doc.raiz)) if (node.id === id) return parent;
  return null;
}

/** Camino de nodos desde la raíz hasta el nodo (ambos incluidos). */
export function pathTo(doc, id) {
  const path = [];
  const rec = (n) => {
    path.push(n);
    if (n.id === id) return true;
    for (const h of n.hijos ?? []) if (rec(h)) return true;
    path.pop();
    return false;
  };
  return rec(doc.raiz) ? path : [];
}

export function nextNodeId(doc) {
  let max = 0;
  for (const { node } of walk(doc.raiz)) {
    const m = /^n(\d+)$/.exec(node.id);
    if (m) max = Math.max(max, +m[1]);
  }
  return 'n' + (max + 1);
}

/** Etiqueta mostrable de un nodo: letra del modelo, nombre o "Contenedor". */
export function nodeLabel(node) {
  if (node.id === 'n0') return 'Raíz';
  if (node.modelo) return node.modelo;
  return node.nombre || 'Contenedor';
}

export function isLeaf(node) {
  return !node.hijos || node.hijos.length === 0;
}

// ---------- edición del árbol ----------

export function addChild(doc, parentId, { modelo = null, t = [], nombre = '' } = {}) {
  const parent = findNode(doc, parentId);
  if (!parent) return null;
  const node = { id: nextNodeId(doc), nombre, modelo, t, hijos: [] };
  parent.hijos.push(node);
  return node;
}

export function removeNode(doc, id) {
  if (id === doc.raiz.id) return false;
  const parent = findParent(doc, id);
  if (!parent) return false;
  parent.hijos = parent.hijos.filter((h) => h.id !== id);
  return true;
}

/** Duplica un subárbol como hermano siguiente. Devuelve el nodo nuevo. */
export function duplicateNode(doc, id) {
  if (id === doc.raiz.id) return null;
  const parent = findParent(doc, id);
  const orig = findNode(doc, id);
  if (!parent || !orig) return null;
  const copy = structuredClone(orig);
  let n = Number(nextNodeId(doc).slice(1));
  for (const { node } of walk(copy)) node.id = 'n' + n++;
  const idx = parent.hijos.findIndex((h) => h.id === id);
  parent.hijos.splice(idx + 1, 0, copy);
  return copy;
}

export function isDescendant(doc, ancestorId, id) {
  const anc = findNode(doc, ancestorId);
  if (!anc) return false;
  for (const { node } of walk(anc)) if (node.id === id) return true;
  return false;
}

/** Mueve un nodo (con su subárbol) a otro padre, en la posición index. */
export function moveNode(doc, id, newParentId, index = null) {
  if (id === doc.raiz.id || id === newParentId) return false;
  if (isDescendant(doc, id, newParentId)) return false;
  const node = findNode(doc, id);
  const oldParent = findParent(doc, id);
  const newParent = findNode(doc, newParentId);
  if (!node || !oldParent || !newParent) return false;
  oldParent.hijos = oldParent.hijos.filter((h) => h.id !== id);
  const at = index == null ? newParent.hijos.length : Math.min(index, newParent.hijos.length);
  newParent.hijos.splice(at, 0, node);
  return true;
}

export function reorderChild(doc, id, delta) {
  const parent = findParent(doc, id);
  if (!parent) return false;
  const i = parent.hijos.findIndex((h) => h.id === id);
  const j = i + delta;
  if (j < 0 || j >= parent.hijos.length) return false;
  [parent.hijos[i], parent.hijos[j]] = [parent.hijos[j], parent.hijos[i]];
  return true;
}

// ---------- modelos ----------

export function addModel(doc, tipo, { letra, color, params } = {}) {
  const l = letra && !(letra in doc.modelos) ? letra : nextModelLetter(doc.modelos);
  doc.modelos[l] = {
    tipo,
    params: { ...defaultParams(tipo), ...(params ?? {}) },
    color: color ?? nextModelColor(doc.modelos),
  };
  return l;
}

export function removeModel(doc, letra) {
  delete doc.modelos[letra];
  for (const { node } of walk(doc.raiz)) if (node.modelo === letra) node.modelo = null;
}

export function renameModel(doc, from, to) {
  if (!to || from === to || to in doc.modelos || !(from in doc.modelos)) return false;
  const rebuilt = {};
  for (const [k, v] of Object.entries(doc.modelos)) rebuilt[k === from ? to : k] = v;
  doc.modelos = rebuilt;
  for (const { node } of walk(doc.raiz)) if (node.modelo === from) node.modelo = to;
  return true;
}

// ---------- validación de esquema ----------

export function validateSchema(doc) {
  const errors = [];
  if (!doc || doc.formato !== FORMAT) errors.push('No es un archivo de grafo de escena 2D');
  else {
    if (doc.version !== VERSION) errors.push(`Versión no soportada: ${doc.version}`);
    if (!doc.raiz) errors.push('Falta la raíz');
    if (!doc.modelos || typeof doc.modelos !== 'object') errors.push('Faltan los modelos');
  }
  if (errors.length) return errors;
  const ids = new Set();
  for (const { node } of walk(doc.raiz)) {
    if (ids.has(node.id)) errors.push(`Id repetido: ${node.id}`);
    ids.add(node.id);
    if (node.modelo && !(node.modelo in doc.modelos)) errors.push(`Modelo inexistente: ${node.modelo}`);
  }
  return errors;
}
