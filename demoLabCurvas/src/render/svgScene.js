import { analyzeJoin, casteljauLevels, convexHull, curvatureFrame, evaluate, sampleAdaptive, sampleArcLength, sampleUniform } from '../math/bezier.js';
import { pointsFor, selectedSegment } from '../model/store.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}, text = '') => {
  const node = document.createElementNS(NS, name);
  Object.entries(attrs).forEach(([key, value]) => value !== undefined && node.setAttribute(key, String(value)));
  if (text) node.textContent = text;
  return node;
};
const fmt = (n) => Number.isFinite(n) ? Number(n.toFixed(5)) : 0;

export function worldToScreen(camera, width, height, p) {
  return { x: width / 2 + (p.x - camera.centerX) * camera.pixelsPerUnit, y: height / 2 - (p.y - camera.centerY) * camera.pixelsPerUnit };
}

export function screenToWorld(camera, width, height, p) {
  return { x: camera.centerX + (p.x - width / 2) / camera.pixelsPerUnit, y: camera.centerY - (p.y - height / 2) / camera.pixelsPerUnit };
}

const pathFor = (points, project) => {
  const p = points.map(project);
  if (p.length === 2) return `M ${fmt(p[0].x)} ${fmt(p[0].y)} L ${fmt(p[1].x)} ${fmt(p[1].y)}`;
  if (p.length === 3) return `M ${fmt(p[0].x)} ${fmt(p[0].y)} Q ${fmt(p[1].x)} ${fmt(p[1].y)} ${fmt(p[2].x)} ${fmt(p[2].y)}`;
  return `M ${fmt(p[0].x)} ${fmt(p[0].y)} C ${fmt(p[1].x)} ${fmt(p[1].y)} ${fmt(p[2].x)} ${fmt(p[2].y)} ${fmt(p[3].x)} ${fmt(p[3].y)}`;
};

function gridStep(scale) {
  const rough = 85 / scale; const power = 10 ** Math.floor(Math.log10(rough));
  return [1, 2, 5, 10].map((n) => n * power).find((n) => n * scale >= 60) || power * 10;
}

function arrow(group, from, vector, color, label, scalePx, maxPx = 240, options = {}) {
  const magnitude = Math.hypot(vector.x, vector.y); if (!magnitude) return;
  const raw = magnitude * scalePx; const display = Math.min(raw, maxPx); const unit = { x: vector.x / magnitude, y: -vector.y / magnitude };
  const to = { x: from.x + unit.x * display, y: from.y + unit.y * display };
  group.append(el('line', { x1: from.x, y1: from.y, x2: to.x, y2: to.y, stroke: color, 'stroke-width': 2, 'stroke-dasharray': options.dash, 'marker-end': `url(#arrow-${color.slice(1)})`, class: options.className }));
  group.append(el('text', { x: to.x + 7, y: to.y + (options.labelDy ?? -5), fill: color, class: 'vector-label' }, `${label} ${magnitude.toFixed(3)}${raw > maxPx ? ' ↯' : ''}`));
}

export class SvgSceneRenderer {
  constructor(svg, hooks = {}) { this.svg = svg; this.hooks = hooks; this.size = { width: 1, height: 1 }; }
  setSize(width, height) { this.size = { width: Math.max(1, width), height: Math.max(1, height) }; this.svg.setAttribute('viewBox', `0 0 ${this.size.width} ${this.size.height}`); }
  render(scene, options = {}) {
    const { width, height } = this.size; const camera = options.camera || scene.presentation.camera; const s = scene.presentation.settings;
    this.svg.replaceChildren(); this.svg.setAttribute('aria-label', `Escena: ${scene.title}`);
    const defs = el('defs');
    for (const color of [s.tangentColor, s.unitTangentColor, s.normalColor, s.secondColor]) {
      const marker = el('marker', { id: `arrow-${color.slice(1)}`, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' }); marker.append(el('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: color })); defs.append(marker);
    }
    this.svg.append(defs);
    const project = (p) => worldToScreen(camera, width, height, p);
    if (s.gridVisible) {
      const grid = el('g', { class: 'grid-layer', opacity: s.gridOpacity }); const step = gridStep(camera.pixelsPerUnit); const tl = screenToWorld(camera, width, height, { x: 0, y: 0 }); const br = screenToWorld(camera, width, height, { x: width, y: height });
      const startX = Math.floor(tl.x / step) * step; const endX = Math.ceil(br.x / step) * step; const startY = Math.floor(br.y / step) * step; const endY = Math.ceil(tl.y / step) * step;
      for (let x = startX; x <= endX + step / 2; x += step) { const px = project({ x, y: 0 }).x; grid.append(el('line', { x1: px, y1: 0, x2: px, y2: height, class: 'grid-line' })); if (Math.abs(x) > step / 100) grid.append(el('text', { x: px + 4, y: Math.min(height - 6, Math.max(14, project({ x: 0, y: 0 }).y - 5)), class: 'grid-label' }, fmt(x))); }
      for (let y = startY; y <= endY + step / 2; y += step) { const py = project({ x: 0, y }).y; grid.append(el('line', { x1: 0, y1: py, x2: width, y2: py, class: 'grid-line' })); if (Math.abs(y) > step / 100) grid.append(el('text', { x: Math.min(width - 28, Math.max(5, project({ x: 0, y: 0 }).x + 5)), y: py - 5, class: 'grid-label' }, fmt(y))); }
      if (s.axesVisible) { const origin = project({ x: 0, y: 0 }); grid.append(el('line', { x1: 0, y1: origin.y, x2: width, y2: origin.y, class: 'axis-line' }), el('line', { x1: origin.x, y1: 0, x2: origin.x, y2: height, class: 'axis-line' })); }
      this.svg.append(grid);
    }
    const refs = el('g', { class: 'reference-layer' });
    if (s.referencesVisible) for (const ref of scene.presentation.references.filter((r) => r.visible !== false)) for (const segment of ref.segments) refs.append(el('path', { d: pathFor(segment.points, project), fill: 'none', stroke: ref.color || '#64748b', 'stroke-width': 3, 'stroke-dasharray': '7 6', opacity: ref.opacity ?? .45 }));
    this.svg.append(refs);
    const hulls = el('g', { class: 'hull-layer' }); const curves = el('g', { class: 'curve-layer' }); const controls = el('g', { class: 'control-layer' }); const labels = el('g', { class: 'label-layer' });
    const active = selectedSegment(scene); const pointLabels = new Map();
    scene.geometry.segments.forEach((segment, segmentIndex) => {
      if (!segment.visible || (scene.presentation.isolationSegmentId && scene.presentation.isolationSegmentId !== segment.id)) return;
      const points = pointsFor(scene, segment); const opacity = s.fadeOthers && active && active.id !== segment.id ? .25 : 1; const style = segment.style || {};
      if (s.hullVisible) { const hp = convexHull(points).map(project); if (hp.length >= 3) hulls.append(el('polygon', { points: hp.map((p) => `${p.x},${p.y}`).join(' '), fill: '#2563eb', 'fill-opacity': .08, stroke: '#2563eb', 'stroke-opacity': .35 })); else if (hp.length === 2) hulls.append(el('line', { x1: hp[0].x, y1: hp[0].y, x2: hp[1].x, y2: hp[1].y, stroke: '#2563eb', 'stroke-opacity': .35 })); }
      if (s.controlsVisible) controls.append(el('polyline', { points: points.map(project).map((p) => `${p.x},${p.y}`).join(' '), fill: 'none', stroke: s.controlColor, 'stroke-width': s.controlWidth, 'stroke-dasharray': '5 5', opacity }));
      if (s.curveVisible) {
        const manual = s.samplingMode === 'manual';
        const exact = el('path', { d: pathFor(points, project), fill: 'none', stroke: manual ? s.referenceColor : style.color || s.curveColor, 'stroke-width': style.width || s.curveWidth, opacity: manual ? s.referenceOpacity : opacity, class: 'exact-curve', 'data-segment-id': segment.id, 'pointer-events': options.exporting ? 'none' : 'stroke' });
        if (s.samplingMode === 'smooth') curves.append(exact); else {
          let samples; if (s.samplingStrategy === 'arcLength') samples = sampleArcLength(points, s.subdivisions); else if (s.samplingStrategy === 'adaptive') samples = sampleAdaptive(points, camera.pixelsPerUnit, s.adaptiveTolerancePx).samples; else samples = sampleUniform(points, s.subdivisions);
          curves.append(exact, el('polyline', { points: samples.map(project).map((p) => `${p.x},${p.y}`).join(' '), fill: 'none', stroke: s.samplingColor, 'stroke-width': style.width || s.curveWidth, opacity, class: 'sampled-curve' }));
          if (s.samplesVisible) samples.forEach((p) => { const q = project(p); curves.append(el('circle', { cx: q.x, cy: q.y, r: 3, fill: '#fff', stroke: s.samplingColor, class: 'sampled-point' })); });
        }
      }
      if (s.pointsVisible) points.forEach((p, i) => { const q = project(p); controls.append(el('circle', { cx: q.x, cy: q.y, r: s.pointRadius, fill: ['#2563eb', '#d97706', '#059669', '#7c3aed'][i], stroke: '#fff', 'stroke-width': 1.5, class: 'control-point', 'data-point-id': p.id, tabindex: options.exporting ? undefined : 0, role: options.exporting ? undefined : 'button', 'aria-label': options.exporting ? undefined : `Punto P${segmentIndex},${i}` })); const prior = pointLabels.get(p.id); pointLabels.set(p.id, prior ? `${prior} / P${segmentIndex},${i}` : `P${segmentIndex},${i}`); });
      if (s.labelsVisible) { const mid = project(evaluate(points, .5)); labels.append(el('text', { x: mid.x + 14, y: mid.y + 26, class: 'segment-label', fill: style.color || s.curveColor }, segment.name || `S${segmentIndex}`)); }
    });
    this.svg.append(hulls, curves, controls);
    if (s.labelsVisible) { const occupied = new Map(); for (const [id, label] of pointLabels) { const p = scene.geometry.points.find((x) => x.id === id); const q = project(p); const key = `${Math.round(q.x / 8)},${Math.round(q.y / 8)}`, stack = occupied.get(key) || 0; occupied.set(key, stack + 1); const offset = scene.presentation.labelOffsets.find((o) => o.targetId === id && o.role === 'control') || { dx: 10, dy: -10 + stack * 17 }; labels.append(el('text', { x: q.x + offset.dx, y: q.y + offset.dy, fill: s.labelColor, 'font-size': s.labelSize, class: 'point-label' }, label)); } }
    this.svg.append(labels);
    for (const draft of scene.geometry.drafts) {
      const pm = new Map(scene.geometry.points.map((p) => [p.id, p])); const pts = draft.pointIds.map((id) => pm.get(id)).filter(Boolean); if (!pts.length) continue; const g = el('g', { class: 'draft-layer' }); g.append(el('polyline', { points: pts.map(project).map((p) => `${p.x},${p.y}`).join(' '), fill: 'none', stroke: '#94a3b8', 'stroke-width': 1.5, 'stroke-dasharray': '3 5' })); pts.forEach((p) => { const q = project(p); g.append(el('circle', { cx: q.x, cy: q.y, r: 4, fill: '#fff', stroke: '#94a3b8' })); }); const q = project(pts.at(-1)); g.append(el('text', { x: q.x + 10, y: q.y + 20, class: 'draft-label' }, `Faltan ${draft.degree + 1 - pts.length} puntos para completar el tramo`)); this.svg.append(g);
    }
    if (active) this.renderAnalysis(scene, active, project);
    if (s.probesVisible) for (const probe of scene.presentation.probes.filter((p) => p.visible !== false)) { const seg = scene.geometry.segments.find((x) => x.id === probe.segmentId); if (!seg) continue; const p = project(evaluate(pointsFor(scene, seg), probe.u)); this.svg.append(el('circle', { cx: p.x, cy: p.y, r: 5, fill: '#fff', stroke: s.evaluatedColor, 'stroke-width': 2 }), el('text', { x: p.x + 9, y: p.y + 18, class: 'probe-label' }, probe.label || `u=${probe.u.toFixed(3)}`)); }
    if (!options.exporting) this.bindEvents();
  }
  renderAnalysis(scene, segment, project) {
    const s = scene.presentation.settings; const points = pointsFor(scene, segment); const u = scene.presentation.playhead.u; const frame = curvatureFrame(points, u, s); const group = el('g', { class: 'analysis-layer' });
    if (s.casteljauVisible) { const levels = casteljauLevels(points, u); levels.slice(1, -1).forEach((level, i) => { const q = level.map(project); group.append(el('polyline', { points: q.map((p) => `${p.x},${p.y}`).join(' '), fill: 'none', stroke: ['#d97706', '#059669'][i] || '#7c3aed', 'stroke-width': 1.5 })); q.forEach((p, j) => group.append(el('circle', { cx: p.x, cy: p.y, r: 4, fill: '#fff', stroke: ['#d97706', '#059669'][i] }), el('text', { x: p.x + 6, y: p.y - 6, class: 'casteljau-label' }, `${['Q', 'R'][i] || 'L'}${j}`))); }); }
    const p = project(frame.position); group.append(el('circle', { cx: p.x, cy: p.y, r: s.evaluatedRadius, fill: s.evaluatedColor, stroke: '#fff', 'stroke-width': 2, class: 'evaluated-point' }));
    if (s.firstDerivativeVisible) arrow(group, p, frame.first, s.tangentColor, "C'", s.vectorScale, 240, { labelDy: -7, className: 'first-derivative-vector' });
    if (s.vectorsVisible && frame.defined) arrow(group, p, frame.tangent, s.unitTangentColor, 'T', s.unitVectorLength, 240, { dash: '6 4', labelDy: 15, className: 'unit-tangent-vector' });
    if (s.secondDerivativeVisible) arrow(group, p, frame.second, s.secondColor, "C''", s.vectorScale);
    if (s.normalVisible && frame.normalDefined) arrow(group, p, frame.normal, s.normalColor, 'N', s.unitVectorLength);
    if (s.osculatingCircleVisible && frame.normalDefined) { const center = project(frame.center); const radiusPx = frame.radius * scene.presentation.camera.pixelsPerUnit; if (radiusPx < 1e7) group.prepend(el('circle', { cx: center.x, cy: center.y, r: radiusPx, fill: 'none', stroke: s.normalColor, 'stroke-width': 1.5, 'stroke-dasharray': '7 5', opacity: .75 })); }
    this.svg.append(group);
  }
  bindEvents() {
    this.svg.querySelectorAll('[data-segment-id]').forEach((node) => node.addEventListener('pointerdown', (event) => this.hooks.onSegmentPointer?.(event, node.dataset.segmentId)));
    this.svg.querySelectorAll('[data-point-id]').forEach((node) => node.addEventListener('pointerdown', (event) => this.hooks.onPointPointer?.(event, node.dataset.pointId)));
  }
  serialize(scene, { width = 1920, height = 1080, transparent = false } = {}) {
    const temp = document.createElementNS(NS, 'svg'); temp.setAttribute('xmlns', NS); temp.setAttribute('width', width); temp.setAttribute('height', height); temp.setAttribute('viewBox', `0 0 ${width} ${height}`); temp.classList.add('export-scene');
    const prior = this.svg; const priorSize = this.size; this.svg = temp; this.size = { width, height }; this.render(scene, { exporting: true });
    const style = el('style', {}, `.grid-line{stroke:#e5e7eb;stroke-width:1}.axis-line{stroke:#94a3b8;stroke-width:1}.grid-label{fill:#94a3b8;font:11px sans-serif}.point-label,.segment-label,.probe-label,.draft-label,.casteljau-label,.vector-label{font-family:Arial,sans-serif;font-size:15px}.draft-label{fill:#64748b}.segment-label{font-weight:700}`); temp.prepend(style); if (!transparent) temp.insertBefore(el('rect', { width: '100%', height: '100%', fill: '#fff' }), temp.children[1] || null);
    const result = new XMLSerializer().serializeToString(temp); this.svg = prior; this.size = priorSize; return result;
  }
}

export function joinsFor(scene) {
  const sm = new Map(scene.geometry.segments.map((s) => [s.id, s]));
  return scene.geometry.chains.flatMap((chain) => chain.segmentIds.slice(0, -1).map((id, i) => {
    const left = sm.get(id); const right = sm.get(chain.segmentIds[i + 1]);
    return { chain, left, right, result: analyzeJoin({ points: pointsFor(scene, left), duration: left.duration }, { points: pointsFor(scene, right), duration: right.duration }, scene.presentation.settings.continuityMode, scene.presentation.settings) };
  }));
}
