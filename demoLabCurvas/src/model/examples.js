import { createScene, hydrateScene } from './defaults.js';
import { split, elevateDegree } from '../math/bezier.js';

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
