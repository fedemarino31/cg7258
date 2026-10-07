import { createScene, hydrateScene } from './defaults.js';
import { split, elevateDegree } from '../math/bezier.js';
import { catmullRomToBezier, knotIntervals } from '../math/catmullRom.js';

const SPECS = [
  ['01-lineal', 'Lineal', [[0, 0], [4, 2]], { u: 0.5, expected: "C'=(4,2), C''=0, curvatura=0" }],
  ['02-cuadratica', 'Cuadrática', [[0, 0], [2, 3], [4, 0]], { u: 0.5, expected: 'C=(2,1.5), curvatura=.75' }],
  ['03-cubica-casteljau', 'Cúbica · De Casteljau', [[0, 0], [1, 3], [3, 3], [4, 0]], { u: 0.5, expected: 'C=(2,2.25)' }],
  ['09-inflexion', 'Inflexión', [[0, 0], [1, 2], [2, -2], [3, 0]], { u: 0.5, expected: 'Curvatura con signo cero' }],
  ['10-cuspide', 'Cúspide', [[0.25, -0.125], [-1 / 12, 0.125], [-1 / 12, -0.125], [0.25, 0.125]], { u: 0.5, expected: 'Velocidad nula' }],
  ['11-constante', 'Curva constante', [[2, 1], [2, 1], [2, 1], [2, 1]], { u: 0.5, expected: 'Longitud cero' }],
  ['12-discretizacion', 'Discretización N=4', [[0, 0], [1, 3], [3, 3], [4, 0]], { u: 0.5, sampling: true }],
  ['13-casco-convexo', 'Casco convexo', [[0, 0], [4, 3], [0, 3], [4, 0]], { u: 0.5, hull: true }],
  ['16-velocidad', 'Velocidad variable', [[0, 0], [0.1, 0], [0.2, 0], [5, 0]], { u: 0.5 }],
];

const JOINS = [
  ['04-sin-c0', 'Sin C0', [[4, 0], [5, -2], [6, -2], [7, 0]], [false, false, false, false], false],
  ['05-c0-esquina', 'C0 con esquina', [[3, 0], [4, 2], [5, 2], [6, 0]], [true, false, false, false], false],
  ['06-g1-sin-c1', 'G1 sin C1', [[3, 0], [5, -4], [6, -3], [7, 0]], [true, true, false, false], false],
  ['07-c1-sin-c2', 'C1 sin C2', [[3, 0], [4, -2], [5, -2], [6, 0]], [true, true, true, false], false],
  ['08-c2', 'C2', [[3, 0], [4, -2], [5, -6], [6, -4]], [true, true, true, true], false],
  ['18-compartidos', 'Extremo compartido', [[3, 0], [4, -2], [5, -2], [6, 0]], [true, true, true, false], true],
  ['19-sentidos-opuestos', 'Sentidos opuestos', [[3, 0], [2, 2], [4, 3], [6, 0]], [true, false, false, false], false],
];

const EXPLANATIONS = {
  '01-lineal': { description: 'Verificá que una Bézier lineal es el segmento entre sus dos controles y tiene derivada constante.', howTo: 'Mové el parámetro u y observá que la tangente no cambia.' },
  '02-cuadratica': { description: 'Estudia una cuadrática simétrica y su marco de curvatura en el punto medio.', howTo: 'Ubicá u=0,5 y activá normal y círculo osculador.' },
  '03-cubica-casteljau': { description: 'Muestra cómo De Casteljau construye una cúbica mediante interpolaciones lineales sucesivas.', howTo: 'Activá De Casteljau y recorré u con el slider.' },
  '04-sin-c0': { description: 'Los extremos de A y B están separados: la cadena no tiene continuidad posicional.', howTo: 'Abrí Continuidad y compará la separación antes y después de Ajustar C0.' },
  '05-c0-esquina': { description: 'Los tramos se tocan, pero sus tangentes forman una esquina.', howTo: 'Compará C0 con G1 y superponé los vectores de ambos lados.' },
  '06-g1-sin-c1': { description: 'Las tangentes tienen la misma dirección, pero distinta magnitud paramétrica.', howTo: 'Alterná el diagnóstico global/local y aplicá Ajustar C1.' },
  '07-c1-sin-c2': { description: 'Las posiciones y primeras derivadas coinciden; las segundas derivadas no.', howTo: 'Observá C1 verdadero y C2 falso en la tabla de continuidad.' },
  '08-c2': { description: 'Caso de referencia donde la unión cumple C0, G1, C1 y C2.', howTo: 'Cambiá la duración de un tramo para ver cómo afecta la continuidad global.' },
  '09-inflexion': { description: 'La curvatura con signo cambia de orientación al atravesar la inflexión.', howTo: 'Recorré u alrededor de 0,5 y observá el signo de κs.' },
  '10-cuspide': { description: 'En u=0,5 la velocidad se anula y el marco de Frenet deja de estar definido.', howTo: 'Compará C\'(u), C\'\'(u), la tangente y la curvatura en u=0,5.' },
  '11-constante': { description: 'Todos los controles coinciden: la curva tiene longitud y derivadas nulas.', howTo: 'Recorré todo u y comprobá que las mediciones permanecen finitas.' },
  '12-discretizacion': { description: 'Compara la curva exacta con una discretización manual de cuatro aristas.', howTo: 'Cambiá N entre 1, 4 y 16 y observá la polilínea magenta y sus muestras.' },
  '13-casco-convexo': { description: 'Ilustra que una Bézier permanece contenida en el casco convexo de sus controles.', howTo: 'Arrastrá controles con el casco visible y comprobá que la curva queda dentro.' },
  '14-subdivision': { description: 'La curva original fue dividida exactamente en u=0,25 sin cambiar su forma ni su parámetro global.', howTo: 'Compará continuidad global y local en la nueva unión.' },
  '15-elevacion': { description: 'Una cuadrática y su elevación cúbica representan exactamente la misma geometría.', howTo: 'Mové u y compará la cúbica con la referencia congelada.' },
  '16-velocidad': { description: 'La geometría es una recta, pero la rapidez paramétrica varía a lo largo del tramo.', howTo: 'Recorré u y mirá |C\'(u)|: cambia aunque la curvatura sea cero.' },
  '17-mixta': { description: 'Una lineal y una cuadrática pueden formar una cadena continua pese a tener grados distintos.', howTo: 'Revisá C0, G1, C1 y C2 en la tabla.' },
  '18-compartidos': { description: 'Los dos tramos referencian el mismo ID en su extremo común, no solo la misma coordenada.', howTo: 'Arrastrá el extremo compartido: ambos tramos se mueven juntos y C0 se conserva.' },
  '19-sentidos-opuestos': { description: 'Los extremos coinciden, pero las tangentes apuntan en sentidos opuestos.', howTo: 'Observá por qué C0 es verdadero mientras G1, C1 y C2 son falsos.' },
  '21-cr-tramo': { description: 'Un tramo Catmull-Rom usa cuatro puntos P0..P3 pero solo interpola de P1 a P2: P0 y P3 fijan las tangentes de los extremos.', howTo: 'Mové P0 y P3 y mirá cómo cambian la forma y la Bézier equivalente (cuadrados violetas) sin que se muevan los extremos del tramo.' },
  '22-cr-cadena': { description: 'Siete puntos encadenados generan cuatro tramos; cada tramo comparte tres puntos con el siguiente.', howTo: 'Abrí Continuidad: todas las uniones son C1 pero no C2. Elegí Agregar en modo Catmull-Rom encadenado y cada clic suma un tramo.' },
  '23-cr-tension': { description: 'La tensión τ escala las tangentes por (1−τ). La referencia gris es la misma cadena con τ=0.', howTo: 'Cambiá τ del tramo y aplicalo a la cadena: τ=1 da la poligonal, τ<0 exagera las curvas.' },
  '24-cr-alfa': { description: 'Las tres cadenas comparten los mismos puntos y solo difieren en α: uniforme (rojo), centrípeta (azul) y cordal (verde).', howTo: 'La uniforme forma un lazo entre P1 y P2, que están muy juntos; la centrípeta lo evita. Arrastrá P2 y comparalas.' },
  '25-cr-extremos': { description: 'Una cadena abierta no pasa por su primer y último punto. Arriba se duplican los extremos; abajo se agregan puntos reflejados 2P0−P1.', howTo: 'Compará las tangentes de los extremos en ambas cadenas y mové los puntos fantasma de la cadena inferior.' },
  '26-cr-cerrada': { description: 'Una curva cerrada repite los tres primeros puntos al final de la secuencia: todos los puntos se interpolan y el lazo es C1.', howTo: 'Usá Abrir curva y Cerrar curva en Controles; insertá un punto con Insertar punto aquí.' },
  '27-cr-bases': { description: 'Los pesos de Catmull-Rom suman 1 pero pueden ser negativos, así que la curva puede salir del casco convexo de sus puntos.', howTo: 'Abrí Bases y recorré u: w0 y w3 son negativos. Observá que la curva baja por debajo del casco.' },
  '28-cr-local': { description: 'Control local: se movió P4 respecto de la referencia; solo cambian los cuatro tramos que lo usan.', howTo: 'Arrastrá cualquier punto y contá cuántos tramos se apartan de la referencia punteada.' },
  '29-cr-c1-sin-c2': { description: 'Dos tramos uniformes comparten tres puntos: la primera derivada coincide en la unión, la segunda no.', howTo: 'Con u=1 compará C\'\' a cada lado de la unión y mirá la tabla de Continuidad.' },
  '30-cr-tension-mixta': { description: 'Los tramos comparten puntos pero tienen distinta tensión: la tangente conserva la dirección y cambia de módulo.', howTo: 'La unión es G1 sin C1. Usá Igualar α/τ en Continuidad para recuperar C1.' },
  '31-cr-nodos': { description: 'En la parametrización centrípeta, la continuidad C1 vale en el parámetro nodal t: cada tramo dura su intervalo |P2−P1|^α.', howTo: 'Alterná la comparación entre Global t (C1 ✓) y Local u (C1 ×). Probá h = intervalo nodal tras mover puntos.' },
  '32-mixta-bezier-cr': { description: 'Una cúbica de Bézier continúa en una cadena Catmull-Rom que empieza con sus dos últimos controles.', howTo: 'La unión Bézier→Catmull-Rom es G1 sin C1; las uniones entre tramos Catmull-Rom son C1.' },
  '33-cr-borrador': { description: 'Una cadena Catmull-Rom y un borrador con dos de los cuatro puntos que necesita un tramo independiente.', howTo: 'Hacé dos clics con Agregar para completarlo. Luego elegí Encadenado: cada clic agrega un tramo nuevo.' },
  '20-borrador': { description: 'Combina un tramo completo con dos puntos pendientes de una nueva cúbica independiente.', howTo: 'Elegí Agregar y hacé dos clics más para completar el borrador.' },
};

function oneSegment(id, title, coords, options = {}) {
  const scene = createScene(title); const chain = scene.geometry.chains[0];
  chain.id = `${id}-chain`; chain.name = 'Cadena principal';
  const points = coords.map(([x, y], i) => ({ id: `${id}-p${i}`, x, y }));
  const segment = { id: `${id}-s0`, name: 'S0', degree: coords.length - 1, pointIds: points.map((p) => p.id), duration: 1, sampling: null, style: null, visible: true };
  scene.geometry.points = points; scene.geometry.segments = [segment]; chain.segmentIds = [segment.id];
  scene.presentation.selection = { segmentId: segment.id, pointIds: [], chainId: chain.id };
  scene.presentation.playhead = { ...scene.presentation.playhead, segmentId: segment.id, chainId: chain.id, u: options.u ?? 0.5 };
  if (options.sampling) Object.assign(scene.presentation.settings, { samplingMode: 'manual', subdivisions: 4, samplesVisible: true });
  if (options.hull) scene.presentation.settings.hullVisible = true;
  scene.metadata = { description: options.expected || title, tags: ['catálogo'], expected: options.expected || '' };
  return scene;
}

function joined(id, title, rightCoords, expected, shared) {
  const scene = oneSegment(id, title, [[0, 0], [1, 2], [2, 2], [3, 0]], { u: 1 });
  const left = scene.geometry.segments[0]; left.id = `${id}-a`; left.name = 'A';
  const rightPoints = rightCoords.map(([x, y], i) => {
    if (i === 0 && shared) return scene.geometry.points.at(-1);
    return { id: `${id}-b${i}`, x, y };
  });
  scene.geometry.points.push(...rightPoints.filter((p) => !scene.geometry.points.some((q) => q.id === p.id)));
  const right = { id: `${id}-b`, name: 'B', degree: 3, pointIds: rightPoints.map((p) => p.id), duration: 1, sampling: null, style: null, visible: true };
  scene.geometry.segments.push(right); scene.geometry.chains[0].segmentIds = [left.id, right.id];
  scene.presentation.selection.segmentId = left.id; scene.presentation.playhead.segmentId = left.id;
  scene.metadata.expected = { c0: expected[0], g1: expected[1], c1: expected[2], c2: expected[3] };
  return scene;
}

/** Tramos Catmull-Rom de una secuencia de IDs: el tramo k usa los puntos k..k+3. */
function crSegments(prefix, sequence, params, names = (k) => `S${k}`) {
  return Array.from({ length: sequence.length - 3 }, (_, k) => ({ id: `${prefix}-s${k}`, name: names(k), type: 'catmullRom', degree: 3, pointIds: sequence.slice(k, k + 4), params: { ...params }, duration: 1, sampling: null, style: null, visible: true }));
}

function knotDurations(scene, segments) {
  const pm = new Map(scene.geometry.points.map((p) => [p.id, p]));
  segments.forEach((s) => { s.duration = knotIntervals(s.pointIds.map((id) => pm.get(id)), s.params.alpha)[1]; });
}

function referenceOf(scene, segments, name) {
  const pm = new Map(scene.geometry.points.map((p) => [p.id, p]));
  return { id: `${segments[0].id}-ref`, name, color: '#64748b', opacity: .45, visible: true, segments: segments.map((s) => ({ degree: 3, points: catmullRomToBezier(s.pointIds.map((id) => pm.get(id)), s.params) })) };
}

/** Escena con una o varias cadenas Catmull-Rom. `chains`: [{ name, sequence (índices en coords o IDs), params, color, closed }]. */
function crScene(id, title, coords, chains, options = {}) {
  const scene = createScene(title); scene.geometry.points = coords.map(([x, y], i) => ({ id: `${id}-p${i}`, x, y })); scene.geometry.chains = []; scene.geometry.segments = [];
  chains.forEach((spec, c) => {
    const base = (spec.sequence || coords.map((_, i) => i)).map((v) => (typeof v === 'number' ? `${id}-p${v}` : v));
    const sequence = spec.closed ? [...base, ...base.slice(0, 3)] : base;
    const segments = crSegments(`${id}-c${c}`, sequence, spec.params, spec.names);
    if (spec.color) segments.forEach((s) => { s.style = { color: spec.color }; });
    scene.geometry.segments.push(...segments); scene.geometry.chains.push({ id: `${id}-chain${c}`, name: spec.name || `Cadena ${c + 1}`, segmentIds: segments.map((s) => s.id) });
    if (spec.knotDurations) knotDurations(scene, segments);
  });
  const first = scene.geometry.segments[options.select ?? 0]; const chain = scene.geometry.chains.find((c) => c.segmentIds.includes(first.id));
  scene.presentation.selection = { segmentId: first.id, pointIds: [], chainId: chain.id };
  scene.presentation.playhead = { ...scene.presentation.playhead, segmentId: first.id, chainId: chain.id, u: options.u ?? 0.5 };
  Object.assign(scene.presentation.settings, { creationCurveType: 'catmullRom', creationMode: 'chained' }, options.settings || {});
  scene.metadata = { description: title, tags: ['catálogo', 'catmull-rom'], expected: options.expected || '' };
  return scene;
}

function catmullRomExamples() {
  const uniform = { alpha: 0, tension: 0 }, centripetal = { alpha: 0.5, tension: 0 };
  const out = [];
  const add = (scene) => out.push({ id: scene.geometry.chains[0].id.split('-chain')[0], title: scene.title, scene });
  add(crScene('21-cr-tramo', 'CR · Un tramo', [[0, 0], [1, 2], [3, 2], [4, 0]], [{ params: uniform, name: 'Cadena principal' }], { settings: { equivalentBezierVisible: true }, expected: 'C(0)=P1, C(1)=P2' }));
  add(crScene('22-cr-cadena', 'CR · Varios tramos', [[0, 0], [1, 2], [2.5, 2.5], [4, 1], [5, -0.5], [6.5, 0], [7.5, 1.5]], [{ params: uniform, name: 'Cadena principal' }], { expected: { c0: true, g1: true, c1: true, c2: false } }));
  const tension = crScene('23-cr-tension', 'CR · Tensión', [[0, 0], [1, 2], [2, 0], [3, 2], [4, 0], [5, 2]], [{ params: { alpha: 0, tension: 0.5 }, name: 'Cadena principal' }], { expected: 'τ=0,5 achata las tangentes a la mitad' });
  const relaxed = tension.geometry.segments.map((s) => ({ ...s, params: uniform })); tension.presentation.references = [referenceOf(tension, relaxed, 'τ = 0')]; add(tension);
  const sameIds = [0, 1, 2, 3, 4, 5];
  add(crScene('24-cr-alfa', 'CR · Uniforme, centrípeta y cordal', [[0, 0], [1, 3], [1.15, 3.05], [2.5, 0], [4, 0], [2, -1.5]], [
    { params: uniform, sequence: sameIds, color: '#dc2626', name: 'Uniforme α=0', names: (k) => `U${k}` },
    { params: centripetal, sequence: sameIds, color: '#2563eb', name: 'Centrípeta α=0,5', names: (k) => `Ce${k}` },
    { params: { alpha: 1, tension: 0 }, sequence: sameIds, color: '#059669', name: 'Cordal α=1', names: (k) => `Co${k}` },
  ], { settings: { labelsVisible: true, vectorsVisible: false }, expected: 'Solo la uniforme se autointersecta' }));
  const ends = [[0, 3], [1.5, 4.5], [3, 3.5], [4.5, 4.5], [6, 3]]; const reflected = [[0, 0], [1.5, 1.5], [3, 0.5], [4.5, 1.5], [6, 0]];
  const mirror = (a, b) => [2 * a[0] - b[0], 2 * a[1] - b[1]];
  add(crScene('25-cr-extremos', 'CR · Extremos duplicados y reflejados', [...ends, ...reflected, mirror(reflected[0], reflected[1]), mirror(reflected[4], reflected[3])], [
    { params: centripetal, sequence: [0, 0, 1, 2, 3, 4, 4], name: 'Duplicados', names: (k) => `D${k}` },
    { params: centripetal, sequence: [10, 5, 6, 7, 8, 9, 11], name: 'Reflejados', names: (k) => `R${k}` },
  ], { u: 0, expected: 'Ambas cadenas pasan por su primer y último punto' }));
  add(crScene('26-cr-cerrada', 'CR · Curva cerrada', [[0, 0], [2, -1], [4, 0], [4.5, 2], [2.5, 3.5], [0.5, 2.5]], [{ params: centripetal, closed: true, knotDurations: true, name: 'Lazo' }], { expected: { c0: true, g1: true, c1: true } }));
  add(crScene('27-cr-bases', 'CR · Pesos negativos', [[0, 3], [1, 0], [3, 0], [4, 3]], [{ params: uniform, name: 'Cadena principal' }], { u: 0.25, settings: { hullVisible: true }, expected: 'w0 y w3 son negativos en el interior del tramo' }));
  const wave = [[0, 0], [1, 1], [2, 0], [3, 1], [4, 0], [5, 1], [6, 0], [7, 1], [8, 0]];
  const local = crScene('28-cr-local', 'CR · Control local', wave, [{ params: uniform, name: 'Cadena principal' }], { select: 2, expected: 'S0 y S5 coinciden con la referencia' });
  local.presentation.references = [referenceOf(local, local.geometry.segments, 'Antes de mover P4')]; local.geometry.points[4].y = 1.8; add(local);
  add(crScene('29-cr-c1-sin-c2', 'CR · C1 sin C2', [[0, 0], [1, 2], [2.5, 2], [3.5, 0], [5, 1]], [{ params: uniform, name: 'Cadena principal' }], { u: 1, settings: { firstDerivativeVisible: true, secondDerivativeVisible: true }, expected: { c0: true, g1: true, c1: true, c2: false } }));
  const mixedTension = crScene('30-cr-tension-mixta', 'CR · Tensión distinta entre tramos', [[0, 0], [1, 2], [2.5, 2], [3.5, 0], [5, 1]], [{ params: uniform, name: 'Cadena principal' }], { u: 1, settings: { firstDerivativeVisible: true }, expected: { c0: true, g1: true, c1: false, c2: false } });
  mixedTension.geometry.segments[1].params.tension = 0.6; add(mixedTension);
  add(crScene('31-cr-nodos', 'CR · Duración = intervalo nodal', [[0, 0], [0.5, 1], [3, 1.5], [3.5, 0], [6, -0.5], [6.5, 1]], [{ params: centripetal, knotDurations: true, name: 'Cadena principal' }], { settings: { continuityMode: 'global' }, expected: { c0: true, g1: true, c1: true } }));
  const mixed = crScene('32-mixta-bezier-cr', 'Cadena Bézier + Catmull-Rom', [[0, 0], [1, 2], [2, 2], [3, 0], [4.5, -3], [6, -2], [7, 0]], [{ params: uniform, sequence: [2, 3, 4, 5, 6], name: 'Cadena mixta' }], { u: 1, expected: { c0: true, g1: true, c1: false } });
  const bez = { id: '32-mixta-bezier-cr-bezier', name: 'Bézier', degree: 3, pointIds: [0, 1, 2, 3].map((i) => `32-mixta-bezier-cr-p${i}`), duration: 1, sampling: null, style: null, visible: true };
  mixed.geometry.segments.unshift(bez); mixed.geometry.chains[0].segmentIds.unshift(bez.id); mixed.presentation.selection.segmentId = bez.id; mixed.presentation.playhead.segmentId = bez.id; add(mixed);
  const draft = crScene('33-cr-borrador', 'CR · Borrador', [[0, 0], [1, 1.5], [2.5, 1.5], [3.5, 0], [5, 0.5], [6, 2], [7, 2.5]], [{ params: centripetal, sequence: [0, 1, 2, 3, 4], name: 'Cadena principal' }], { settings: { creationMode: 'independent' } });
  draft.geometry.drafts.push({ id: '33-draft', chainId: draft.geometry.chains[0].id, type: 'catmullRom', degree: 3, creationMode: 'independent', pointIds: ['33-cr-borrador-p5', '33-cr-borrador-p6'], seedSegmentId: null, orderIndex: 2 }); add(draft);
  return out;
}

export function builtInExamples() {
  const entries = [...SPECS.map(([id, title, coords, opt]) => ({ id, title, scene: oneSegment(id, title, coords, opt) })), ...JOINS.map(([id, title, coords, expected, shared]) => ({ id, title, scene: joined(id, title, coords, expected, shared) }))];
  const source = oneSegment('14-source', 'Subdivisión exacta', [[0, 0], [1, 3], [3, 3], [4, 0]], { u: 0.25 });
  const sourcePoints = source.geometry.points; const halves = split(sourcePoints, 0.25);
  source.geometry.points = []; source.geometry.segments = [];
  const ids = halves.left.map((p, i) => { const id = `14-p${i}`; source.geometry.points.push({ id, ...p }); return id; });
  const rightIds = halves.right.map((p, i) => { if (i === 0) return ids.at(-1); const id = `14-r${i}`; source.geometry.points.push({ id, ...p }); return id; });
  source.geometry.segments = [{ id: '14-left', name: 'Izquierda', degree: 3, pointIds: ids, duration: .25, sampling: null, style: null, visible: true }, { id: '14-right', name: 'Derecha', degree: 3, pointIds: rightIds, duration: .75, sampling: null, style: null, visible: true }];
  source.geometry.chains[0].segmentIds = ['14-left', '14-right']; source.presentation.selection.segmentId = '14-left'; source.presentation.playhead.segmentId = '14-left';
  entries.push({ id: '14-subdivision', title: source.title, scene: source });
  const elevated = oneSegment('15-elevacion', 'Elevación de grado', [[0, 0], [2, 3], [4, 0]], { u: .5 });
  const ep = elevateDegree(elevated.geometry.points); elevated.presentation.references = [{ id: '15-ref', name: 'Cuadrática original', color: '#64748b', opacity: .45, segments: [{ degree: 2, points: elevated.geometry.points.map(({ x, y }) => ({ x, y })) }] }];
  elevated.geometry.points = ep.map((p, i) => ({ id: `15-e${i}`, ...p })); elevated.geometry.segments[0] = { ...elevated.geometry.segments[0], degree: 3, pointIds: elevated.geometry.points.map((p) => p.id) };
  entries.push({ id: '15-elevacion', title: elevated.title, scene: elevated });
  const mixed = createScene('Cadena mixta'); mixed.geometry.points = [{ id: '17-p0', x: 0, y: 0 }, { id: '17-p1', x: 1, y: 0 }, { id: '17-p2', x: 1.5, y: 0 }, { id: '17-p3', x: 2, y: 1 }];
  mixed.geometry.segments = [{ id: '17-a', name: 'Lineal', degree: 1, pointIds: ['17-p0', '17-p1'], duration: 1, sampling: null, style: null, visible: true }, { id: '17-b', name: 'Cuadrática', degree: 2, pointIds: ['17-p1', '17-p2', '17-p3'], duration: 1, sampling: null, style: null, visible: true }]; mixed.geometry.chains[0].segmentIds = ['17-a', '17-b']; mixed.presentation.selection.segmentId = '17-a'; mixed.presentation.playhead.segmentId = '17-a'; entries.push({ id: '17-mixta', title: mixed.title, scene: mixed });
  const draft = oneSegment('20-borrador', 'Borrador persistente', [[0, 0], [1, 3], [3, 3], [4, 0]], { u: .35 }); draft.geometry.points.push({ id: '20-d0', x: 5, y: 0 }, { id: '20-d1', x: 6, y: 2 }); draft.geometry.drafts.push({ id: '20-draft', chainId: draft.geometry.chains[0].id, degree: 3, creationMode: 'independent', pointIds: ['20-d0', '20-d1'], seedSegmentId: null, orderIndex: 1 }); entries.push({ id: '20-borrador', title: draft.title, scene: draft });
  entries.push(...catmullRomExamples());
  return entries.map((entry) => {
    const explanation = EXPLANATIONS[entry.id];
    if (explanation) Object.assign(entry.scene.metadata, explanation);
    return { ...entry, description: entry.scene.metadata.description || entry.title, howTo: entry.scene.metadata.howTo || '', scene: hydrateScene(entry.scene) };
  }).sort((a, b) => a.id.localeCompare(b.id));
}

export const initialScene = () => {
  const scene = structuredClone(builtInExamples().find((e) => e.id === '03-cubica-casteljau').scene);
  scene.presentation.playhead.u = 0.35; scene.presentation.settings.casteljauVisible = false; scene.presentation.settings.vectorsVisible = true;
  return scene;
};
