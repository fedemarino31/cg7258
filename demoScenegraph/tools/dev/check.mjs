import { readFileSync, readdirSync } from 'node:fs';
import { validate } from '../../src/core/collide.js';
import { allPolygons } from '../../src/core/evaluate.js';
const dir = 'public/ejemplos/';
for (const f of readdirSync(dir).filter((f) => f.startsWith('ejercicio'))) {
  const d = JSON.parse(readFileSync(dir + f, 'utf8'));
  const v = validate(d);
  if (!v.ok) console.log(f, 'solapes:', v.overlaps.map((o) => `${o.a}-${o.b} (${o.area.toFixed(1)})`).join(', '), 'fuera:', v.outside.join(','));
}
console.log('listo');
