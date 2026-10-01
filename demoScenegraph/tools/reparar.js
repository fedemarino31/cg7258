// Repara ejercicios con superposiciones o formas fuera de la grilla.
// Uso: node tools/reparar.js [archivo.json ...]   (sin argumentos: todos los de public/ejemplos/)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repair } from '../src/core/repair.js';
import { validate } from '../src/core/collide.js';
import { format } from '../src/core/formula.js';
import { findNode } from '../src/core/doc.js';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'ejemplos');
const files = process.argv.length > 2 ? process.argv.slice(2) : readdirSync(dir).filter((f) => /^(ejercicio|gen)-.*\.json$/.test(f)).map((f) => join(dir, f));

let bad = 0;
for (const f of files) {
  const doc = JSON.parse(readFileSync(f, 'utf8'));
  if (validate(doc).ok) continue;
  const { doc: fixed, cambios, ok } = repair(doc);
  const lines = cambios.map((c) => {
    const a = format(findNode(doc, c.id).t) || 'identidad';
    const b = format(findNode(fixed, c.id).t);
    return `   ${c.id}: ${a}  →  ${b}`;
  });
  console.log(`${ok ? '✓ reparado' : '✗ sin resolver'}: ${f}\n${lines.join('\n')}`);
  if (ok) writeFileSync(f, JSON.stringify(fixed, null, 2));
  else bad++;
}
console.log('listo');
process.exit(bad ? 1 : 0);
