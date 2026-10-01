import { generate } from '../../src/core/generator.js';
import { allPolygons, bounds } from '../../src/core/evaluate.js';
let w=0,h=0,n=0,shapes=0,t0=Date.now(), models=0;
for (let seed=1; seed<=60; seed++) {
  const d = generate({seed, dificultad:['facil','media','dificil'][seed%3]});
  const polys = allPolygons(d); const b = bounds(polys.map(p=>p.poly));
  w+=b.x1-b.x0; h+=b.y1-b.y0; shapes+=polys.length; models+=Object.keys(d.modelos).length; n++;
}
console.log('prom ancho',(w/n).toFixed(0),'alto',(h/n).toFixed(0),'formas',(shapes/n).toFixed(1),'modelos',(models/n).toFixed(1),'ms/doc',((Date.now()-t0)/n).toFixed(0));
