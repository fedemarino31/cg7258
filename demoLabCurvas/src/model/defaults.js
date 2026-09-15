export const SETTINGS = {
  creationDegree: 3,
  creationMode: 'independent',
  curveVisible: true,
  controlsVisible: true,
  pointsVisible: true,
  labelsVisible: true,
  gridVisible: true,
  axesVisible: true,
  casteljauVisible: false,
  vectorsVisible: true,
  firstDerivativeVisible: false,
  secondDerivativeVisible: false,
  normalVisible: false,
  osculatingCircleVisible: false,
  hullVisible: false,
  samplesVisible: false,
  referencesVisible: true,
  probesVisible: true,
  samplingMode: 'smooth',
  samplingStrategy: 'parameter',
  subdivisions: 8,
  adaptiveTolerancePx: 1,
  snapToGrid: false,
  snapStep: 0.25,
  dragAxis: 'free',
  curveColor: '#2563eb',
  curveWidth: 3,
  referenceColor: '#bfdbfe',
  referenceOpacity: 0.7,
  samplingColor: '#db2777',
  controlColor: '#64748b',
  controlWidth: 1.5,
  pointRadius: 5,
  evaluatedColor: '#dc2626',
  evaluatedRadius: 7,
  tangentColor: '#d97706',
  unitTangentColor: '#0891b2',
  normalColor: '#059669',
  secondColor: '#7c3aed',
  labelColor: '#172033',
  labelSize: 15,
  vectorScale: 30,
  unitVectorLength: 70,
  gridOpacity: 0.9,
  fadeOthers: false,
  autoSave: true,
  absTol: 1e-9,
  relTol: 1e-7,
  angleDeg: 0.01,
  continuityMode: 'global',
  includeDraftsInExport: false,
};

export const makeId = (prefix = 'id') => `${prefix}-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

export function createScene(title = 'Laboratorio Bézier') {
  return {
    format: 'bezier-lab-scene', version: 1, title,
    geometry: { points: [], segments: [], chains: [{ id: makeId('chain'), name: 'Cadena 1', segmentIds: [] }], drafts: [], constraints: [] },
    presentation: {
      camera: { centerX: 2, centerY: 1.5, pixelsPerUnit: 100 }, settings: { ...SETTINGS },
      selection: { segmentId: null, pointIds: [], chainId: null },
      playhead: { chainId: null, segmentId: null, scope: 'local', u: 0.35, boundarySide: 'right', speedMode: 'parameter', speed: 1, loop: true },
      probes: [], labelOffsets: [], references: [], savedViews: [], isolationSegmentId: null,
    },
    metadata: { description: '', tags: [] },
  };
}

export function hydrateScene(scene) {
  const base = createScene(scene?.title || 'Laboratorio Bézier');
  return {
    ...base, ...scene,
    geometry: { ...base.geometry, ...(scene?.geometry || {}) },
    presentation: {
      ...base.presentation, ...(scene?.presentation || {}),
      camera: { ...base.presentation.camera, ...(scene?.presentation?.camera || {}) },
      settings: { ...SETTINGS, ...(scene?.presentation?.settings || {}) },
      selection: { ...base.presentation.selection, ...(scene?.presentation?.selection || {}) },
      playhead: { ...base.presentation.playhead, ...(scene?.presentation?.playhead || {}) },
    },
    metadata: { ...base.metadata, ...(scene?.metadata || {}) },
  };
}
