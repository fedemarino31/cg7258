export class TopologyView {
 constructor(canvas, info) {
  this.canvas = canvas;
  this.context = canvas.getContext('2d');
  this.info = info;
 }
 draw(manager) {
  const { model, count, selected, selectionEnabled } = manager;
  const { rows, columns, triangles } = model;
  const width = this.canvas.clientWidth, height = this.canvas.clientHeight;
  if (!width || !height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (this.canvas.width !== Math.round(width * dpr) || this.canvas.height !== Math.round(height * dpr)) {
   this.canvas.width = Math.round(width * dpr);
   this.canvas.height = Math.round(height * dpr);
  }
  const ctx = this.context;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const left = 76, top = 66, right = 24, bottom = 26;
  const cell = Math.max(1, Math.min((width - left - right) / (columns - 1), (height - top - bottom) / (rows - 1)));
  const gridWidth = cell * (columns - 1), gridHeight = cell * (rows - 1);
  const x0 = left + Math.max(0, (width - left - right - gridWidth) / 2);
  const y0 = top + Math.max(0, (height - top - bottom - gridHeight) / 2);
  const point = id => [x0 + (id % columns) * cell, y0 + Math.floor(id / columns) * cell];
  const trianglePath = t => {
   ctx.beginPath();
   t.vertices.forEach((id, i) => { const [x, y] = point(id); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
   ctx.closePath();
  };
  const drawTexturedTriangle = triangle => {
   const texture = manager.materialType === 'earth' ? manager.earthTexture : manager.texture;
   const image = texture && texture.image, uv = model.geometry.attributes.uv;
   if (!image || !image.complete || !image.width || !image.height || !uv) return false;
   const screen = triangle.vertices.map(point);
   const source = triangle.vertices.map(id => [uv.getX(id) * image.width, (1 - uv.getY(id)) * image.height]);
   const [s0, s1, s2] = source, [q0, q1, q2] = screen;
   const det = s0[0] * (s1[1] - s2[1]) + s1[0] * (s2[1] - s0[1]) + s2[0] * (s0[1] - s1[1]);
   if (Math.abs(det) < 1e-8) return false;
   const affine = (axis) => [
    (axis[0] * (s1[1] - s2[1]) + axis[1] * (s2[1] - s0[1]) + axis[2] * (s0[1] - s1[1])) / det,
    (axis[0] * (s2[0] - s1[0]) + axis[1] * (s0[0] - s2[0]) + axis[2] * (s1[0] - s0[0])) / det,
    (axis[0] * (s1[0] * s2[1] - s2[0] * s1[1]) + axis[1] * (s2[0] * s0[1] - s0[0] * s2[1]) + axis[2] * (s0[0] * s1[1] - s1[0] * s0[1])) / det
   ];
   const ax = affine([q0[0], q1[0], q2[0]]), ay = affine([q0[1], q1[1], q2[1]]);
   trianglePath(triangle); ctx.save(); ctx.clip(); ctx.setTransform(ax[0], ay[0], ax[1], ay[1], ax[2], ay[2]); ctx.drawImage(image, 0, 0); ctx.restore(); return true;
  };
  const texturedMaterial = manager.materialType === 'uv' || manager.materialType === 'earth';
  ctx.fillStyle = '#a1bac9';
  for (let i = 0; i < count; i++) {
   const triangle = triangles[i];
   if (!(texturedMaterial && manager.topologyTexture && drawTexturedTriangle(triangle))) { trianglePath(triangle); ctx.fill(); }
  }
  if (count && count < triangles.length) {
   ctx.fillStyle = '#d5b58a';
   const start = Math.floor(count / (2 * (columns - 1))) * 2 * (columns - 1);
   for (let i = start; i < count; i++) {
    if (!(texturedMaterial && manager.topologyTexture && drawTexturedTriangle(triangles[i]))) { trianglePath(triangles[i]); ctx.fill(); }
   }
  }
  if (selected) {
   ctx.fillStyle = 'rgba(224,65,65,0.40)';
   ctx.fillRect(x0, y0 + selected.row * cell, gridWidth, cell);
   ctx.fillStyle = 'rgba(35,166,91,0.40)';
   ctx.fillRect(x0 + selected.column * cell, y0, cell, gridHeight);
  }
  ctx.strokeStyle = '#687d8c55';
  ctx.lineWidth = 0.65;
  ctx.beginPath();
  for (let r = 0; r < rows; r++) { ctx.moveTo(x0, y0 + r * cell); ctx.lineTo(x0 + gridWidth, y0 + r * cell); }
  for (let c = 0; c < columns; c++) { ctx.moveTo(x0 + c * cell, y0); ctx.lineTo(x0 + c * cell, y0 + gridHeight); }
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < columns - 1; c++) {
   ctx.moveTo(x0 + (c + 1) * cell, y0 + r * cell);
   ctx.lineTo(x0 + c * cell, y0 + (r + 1) * cell);
  }
  ctx.stroke();
  ctx.fillStyle = '#657888';
  for (let i = 0; i < rows * columns; i++) {
   const [x, y] = point(i); ctx.beginPath(); ctx.arc(x, y, cell < 8 ? 0.8 : 1.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.font = '10px system-ui';
  ctx.textAlign = 'center';
  const step = Math.max(1, Math.ceil(22 / cell));
  for (let c = 0; c < columns; c++) if (c % step === 0 || c === columns - 1) ctx.fillText(c, x0 + c * cell, y0 - 10);
  ctx.textAlign = 'right';
  for (let r = 0; r < rows; r++) if (r % step === 0 || r === rows - 1) ctx.fillText(r, x0 - 10, y0 + r * cell + 3);
  if (selected) {
   trianglePath(selected);
   ctx.fillStyle = '#ffdd45'; ctx.fill(); ctx.strokeStyle = '#866507'; ctx.lineWidth = 2; ctx.stroke();
   ctx.textAlign = 'center'; ctx.font = 'bold 11px system-ui';
   const corners = selected.vertices.map(point);
   const cx = corners.reduce((sum, p) => sum + p[0], 0) / 3;
   const cy = corners.reduce((sum, p) => sum + p[1], 0) / 3;
   selected.vertices.forEach((id, i) => {
    const [x, y] = corners[i];
    const distance = Math.hypot(x - cx, y - cy) || 1;
    const labelWidth = ctx.measureText(String(id)).width + 8;
    const lx = Math.max(labelWidth / 2, Math.min(width - labelWidth / 2, x + (x - cx) / distance * 22));
    const ly = Math.max(9, Math.min(height - 9, y + (y - cy) / distance * 22));
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(lx, ly);
    ctx.strokeStyle = '#866507'; ctx.lineWidth = 0.7; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(lx - labelWidth / 2, ly - 7, labelWidth, 14);
    ctx.fillStyle = '#4b3d12'; ctx.fillText(id, lx, ly + 4);
   });
  }
  // U sigue las columnas; V sigue las filas, cuyos indices crecen hacia abajo.
  ctx.save();
  const axisY = y0 - 32, axisX = x0 - 40;
  ctx.strokeStyle = '#435c6e';
  ctx.fillStyle = '#435c6e';
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(x0, axisY); ctx.lineTo(x0 + gridWidth + 8, axisY);
  ctx.moveTo(x0 + gridWidth + 3, axisY - 4);
  ctx.lineTo(x0 + gridWidth + 8, axisY);
  ctx.lineTo(x0 + gridWidth + 3, axisY + 4);
  ctx.moveTo(axisX, y0); ctx.lineTo(axisX, y0 + gridHeight + 8);
  ctx.moveTo(axisX - 4, y0 + gridHeight + 3);
  ctx.lineTo(axisX, y0 + gridHeight + 8);
  ctx.lineTo(axisX + 4, y0 + gridHeight + 3);
  for (const x of [x0, x0 + gridWidth]) {
   ctx.moveTo(x, axisY - 3); ctx.lineTo(x, axisY + 3);
  }
  for (const y of [y0, y0 + gridHeight]) {
   ctx.moveTo(axisX - 3, y); ctx.lineTo(axisX + 3, y);
  }
  ctx.stroke();
  ctx.font = '11px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('0', x0, axisY - 5);
  ctx.fillText('1', x0 + gridWidth, axisY - 5);
  ctx.font = 'bold 12px system-ui';
  ctx.fillText('U', x0 + gridWidth / 2, axisY - 5);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = '11px system-ui';
  ctx.fillText('0', axisX - 7, y0);
  ctx.fillText('1', axisX - 7, y0 + gridHeight);
  ctx.font = 'bold 12px system-ui';
  ctx.fillText('V', axisX - 7, y0 + gridHeight / 2);
  ctx.restore();
  const key = selected ? selected.id + ':' + model.triangles.length + ':' + model.positions[selected.vertices[0] * 3] : String(selectionEnabled);
  if (key !== this.infoKey) {
   this.infoKey = key;
   if (!selected) {
    this.info.innerHTML = '<div class="info-title">Inspección de triángulos</div><p>' +
     (selectionEnabled ? 'Hacé clic sobre la superficie 3D para seleccionar un triángulo.' : 'Activá «Seleccionar triángulo» en el menú para inspeccionar la superficie.') +
     '</p><small>Triángulos, vértices, filas y columnas numerados desde 0.</small>';
   } else {
    this.info.innerHTML = '<div class="info-title">Triángulo ' + selected.id + '</div>' +
     '<p><span class="row-color">Fila ' + selected.row + '</span> · <span class="column-color">Columna ' + selected.column +
     '</span> · ' + (selected.half === 0 ? 'Primer' : 'Segundo') + ' triángulo de la celda</p>' +
     '<table><thead><tr><th>Vértice</th><th>Índice</th><th>X</th><th>Y</th><th>Z</th></tr></thead><tbody>' +
     selected.vertices.map((v, i) => '<tr><th>i' + (i + 1) + '</th><td>' + v + '</td>' +
      Array.from(model.positions.subarray(v * 3, v * 3 + 3), value => '<td>' + value.toFixed(3) + '</td>').join('') + '</tr>').join('') +
     '</tbody></table><small>Índices desde 0 · Coordenadas de la superficie</small>';
   }
  }
 }
}

