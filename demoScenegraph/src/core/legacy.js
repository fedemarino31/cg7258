// Importación del formato viejo (generadorEjerciciosParcial/ejercicios/**/transformaciones*.json).

import { createDoc } from './doc.js';
import { parse } from './formula.js';
import { defaultParams } from './primitives.js';

const TIPOS = {
  rectangulo: 'rectangulo',
  circulo: 'circulo',
  triangulo: 'triangulo',
};

function hexColor(c) {
  const n = typeof c === 'number' ? c : parseInt(String(c), 16) || parseInt(String(c));
  return '#' + (n & 0xffffff).toString(16).padStart(6, '0').toUpperCase();
}

export function isLegacy(data) {
  return !!data && typeof data === 'object' && 'arbol' in data && 'formas' in data;
}

export function importLegacy(data, titulo = 'Ejercicio importado') {
  const doc = createDoc(titulo);
  const nameToLetter = {};
  let i = 0;

  for (const [nombre, f] of Object.entries(data.formas ?? {})) {
    const tipo = TIPOS[f.tipo];
    if (!tipo) throw new Error(`Tipo de forma no soportado: ${f.tipo}`);
    // "modeloA" -> "A"; si no tiene ese formato, se asigna por orden
    const m = /^modelo([A-Z])$/.exec(nombre);
    const letra = m ? m[1] : String.fromCharCode(65 + i);
    i++;
    nameToLetter[nombre] = letra;
    const params = { ...defaultParams(tipo) };
    for (const k of Object.keys(params)) if (f[k] != null) params[k] = parseFloat(f[k]);
    const modelo = { tipo, params, color: hexColor(f.color) };
    if (f.pivot && (f.pivot[0] || f.pivot[1])) modelo.pivot = [f.pivot[0], f.pivot[1]];
    doc.modelos[letra] = modelo;
  }

  let n = 0;
  const conv = (src) => {
    const { ops, error } = parse(src.t ?? '');
    if (error) throw new Error(`Fórmula inválida "${src.t}": ${error}`);
    const node = {
      id: 'n' + ++n,
      nombre: '', // los nombres viejos (A, B, F…) no se mostraban y se confunden con las letras de los modelos
      modelo: src.forma ? nameToLetter[src.forma] ?? null : null,
      t: ops,
      hijos: [],
    };
    for (const h of src.hijos ?? []) node.hijos.push(conv(h));
    return node;
  };
  doc.raiz.hijos.push(conv(data.arbol));
  return doc;
}
