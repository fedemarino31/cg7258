// Genera ejercicios en JSON (formato v2) sin superposiciones.
//
// Uso:
//   node tools/generar.js --n 10 --seed 42 --dificultad media --out public/ejemplos
//
// Opciones:
//   --n N                cantidad de ejercicios (default 1)
//   --seed S             semilla del primero; los siguientes usan S+1, S+2… (default: al azar)
//   --dificultad D       facil | media | dificil (default media)
//   --modelos N          cantidad de modelos (default 3)
//   --formas MIN[-MAX]   cantidad de formas en el árbol (default 5-8)
//   --profundidad N      niveles máximos (default 3)
//   --tipos a,b,c        primitivas permitidas (default rectangulo,circulo,triangulo)
//   --out DIR            carpeta de salida (default public/ejemplos)
//
// Si DIR contiene index.json, los ejercicios se agregan al índice (grupo "Generados").

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULTS, DIFICULTADES, generate } from '../src/core/generator.js';
import { PRIMITIVE_IDS } from '../src/core/primitives.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) a[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') || argv[i + 1] == null ? true : argv[++i];
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(0, 19).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(0);
}

const n = parseInt(args.n ?? '1', 10);
const seed0 = args.seed != null ? parseInt(args.seed, 10) : Math.floor(Math.random() * 1e6);
const dificultad = args.dificultad ?? DEFAULTS.dificultad;
if (!DIFICULTADES.includes(dificultad)) {
  console.error(`Dificultad inválida: ${dificultad} (${DIFICULTADES.join(' | ')})`);
  process.exit(1);
}
const tipos = args.tipos ? String(args.tipos).split(',') : DEFAULTS.tipos;
const bad = tipos.filter((t) => !PRIMITIVE_IDS.includes(t));
if (bad.length) {
  console.error(`Primitivas desconocidas: ${bad.join(', ')}. Disponibles: ${PRIMITIVE_IDS.join(', ')}`);
  process.exit(1);
}
const [fMin, fMax] = String(args.formas ?? `${DEFAULTS.formasMin}-${DEFAULTS.formasMax}`)
  .split('-')
  .map((v) => parseInt(v, 10));

const out = resolve(args.out ?? join(root, 'public', 'ejemplos'));
mkdirSync(out, { recursive: true });
const indexFile = join(out, 'index.json');
const index = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, 'utf8')) : null;

let ok = 0;
for (let i = 0; i < n; i++) {
  const seed = seed0 + i;
  try {
    const doc = generate({
      seed,
      dificultad,
      tipos,
      nModelos: parseInt(args.modelos ?? DEFAULTS.nModelos, 10),
      formasMin: fMin,
      formasMax: fMax ?? fMin,
      profundidad: parseInt(args.profundidad ?? DEFAULTS.profundidad, 10),
    });
    const archivo = `gen-${dificultad}-${seed}.json`;
    writeFileSync(join(out, archivo), JSON.stringify(doc, null, 2));
    if (index) {
      const entry = { archivo, titulo: `Generado · ${dificultad} · semilla ${seed}`, grupo: 'Generados' };
      const at = index.findIndex((e) => e.archivo === archivo);
      if (at >= 0) index[at] = entry;
      else index.push(entry);
    }
    ok++;
    console.log(`✓ ${archivo}`);
  } catch (e) {
    console.error(`✗ semilla ${seed}: ${e.message}`);
  }
}
if (index) writeFileSync(indexFile, JSON.stringify(index, null, 2));
console.log(`${ok}/${n} ejercicios en ${relative(process.cwd(), out) || '.'}`);
process.exit(ok === n ? 0 : 1);
