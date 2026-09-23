import { mkdir, writeFile } from 'node:fs/promises';
import { builtInExamples } from '../src/model/examples.js';

const output = new URL('../public/examples/', import.meta.url);
await mkdir(output, { recursive: true });
const entries = builtInExamples();
for (const entry of entries) await writeFile(new URL(`${entry.id}.json`, output), `${JSON.stringify(entry.scene, null, 2)}\n`, 'utf8');
const catalog = { format: 'bezier-lab-catalog', version: 1, title: 'Casos docentes de curvas Bézier', examples: entries.map(({ id, title, description, howTo, scene }) => ({ id, title, description, howTo, tags: scene.metadata.tags || [], scene, expected: scene.metadata.expected || {} })) };
await writeFile(new URL('catalog.json', output), `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
console.log(`Generados ${entries.length} ejemplos y catalog.json`);
