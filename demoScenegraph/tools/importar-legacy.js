// Convierte los transformaciones*.json del formato viejo a formato v2 en
// public/ejemplos/ y genera index.json (el manifiesto del diálogo "Abrir ejemplo").
//
// Uso: node tools/importar-legacy.js [carpeta-origen] [carpeta-destino]

import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importLegacy } from '../src/core/legacy.js';
import { repair } from '../src/core/repair.js';
import { validate } from '../src/core/collide.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(process.argv[2] ?? join(root, 'generadorEjerciciosParcial', 'ejercicios'));
const dst = resolve(process.argv[3] ?? join(root, 'public', 'ejemplos'));

function* files(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/^transformaciones\d+\.json$/.test(f)) yield p;
  }
}

mkdirSync(dst, { recursive: true });

// Orden cronológico por carpeta (año, cuatrimestre) y número; después se numeran sin esa referencia.
const sortKey = (f) => {
  const rel = relative(src, f).split(sep);
  const m = /^(\d)c(\d+)$/.exec(rel[0] ?? '');
  const num = parseInt(basename(f).match(/\d+/)[0], 10);
  return [m ? +m[2] : 0, m ? +m[1] : 0, num];
};
const sorted = [...files(src)].sort((a, b) => {
  const [a1, a2, a3] = sortKey(a);
  const [b1, b2, b3] = sortKey(b);
  return a1 - b1 || a2 - b2 || a3 - b3;
});

const index = [];
sorted.forEach((file, i) => {
  const n = i + 1;
  const titulo = `Ejercicio ${n}`;
  try {
    let doc = importLegacy(JSON.parse(readFileSync(file, 'utf8')), titulo);
    if (!validate(doc).ok) {
      const r = repair(doc); // los ejemplos viejos tenían algunas superposiciones
      if (r.ok) doc = r.doc;
      console.log(`${r.ok ? '↻ reparado' : '✗ sin reparar'}: ${titulo}`);
    }
    const archivo = `ejercicio-${String(n).padStart(2, '0')}.json`;
    writeFileSync(join(dst, archivo), JSON.stringify(doc, null, 2));
    index.push({ archivo, titulo, grupo: 'Ejemplos' });
  } catch (e) {
    console.error(`✗ ${relative(src, file)}: ${e.message}`);
  }
});

writeFileSync(join(dst, 'index.json'), JSON.stringify(index, null, 2));
console.log(`✓ ${index.length} ejercicios importados en ${relative(root, dst)}`);
