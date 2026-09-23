// Utilidades de dibujo 2D compartidas por las vistas de espacio de textura.

function niceStep(scale) {
	for (const s of [1, 0.5, 0.25, 0.1, 0.05, 0.025, 0.01, 0.005, 0.0025, 0.001])
		if (s * scale >= 46) return s;
	return 0.001;
}

// Regla con ticks en los bordes del canvas, siempre visible aunque se haga zoom.
export function drawRuler(ctx, view) {
	const { u0, u1, v0, v1 } = view.visibleRange();
	const step = niceStep(view.scale);
	ctx.save();
	ctx.font = '11px sans-serif';
	ctx.fillStyle = 'rgba(10,12,16,0.75)';
	ctx.fillRect(0, view.h - 20, view.w, 20);
	ctx.fillRect(0, 0, 26, view.h - 20);
	ctx.textBaseline = 'middle';
	ctx.textAlign = 'center';
	for (let u = Math.ceil(u0 / step) * step; u <= u1; u += step) {
		const x = view.toPx(u, 0)[0];
		if (x < 28) continue;
		const key = Math.abs(u) < 1e-9 || Math.abs(u - 1) < 1e-9;
		ctx.strokeStyle = key ? '#ffd84d' : '#8a93a3';
		ctx.fillStyle = key ? '#ffd84d' : '#aab2c0';
		ctx.beginPath();
		ctx.moveTo(x, view.h - 20);
		ctx.lineTo(x, view.h - 15);
		ctx.stroke();
		ctx.fillText(+u.toFixed(4) + '', x, view.h - 8);
	}
	ctx.textAlign = 'right';
	for (let v = Math.ceil(v0 / step) * step; v <= v1; v += step) {
		const y = view.toPx(0, v)[1];
		if (y > view.h - 22 || y < 26) continue;
		const key = Math.abs(v) < 1e-9 || Math.abs(v - 1) < 1e-9;
		ctx.strokeStyle = key ? '#ffd84d' : '#8a93a3';
		ctx.fillStyle = key ? '#ffd84d' : '#aab2c0';
		ctx.beginPath();
		ctx.moveTo(26, y);
		ctx.lineTo(21, y);
		ctx.stroke();
		ctx.fillText(+v.toFixed(4) + '', 19, y);
	}
	ctx.font = 'bold 13px sans-serif';
	ctx.fillStyle = '#5b9cff';
	ctx.textAlign = 'right';
	ctx.fillText('U →', view.w - 8, view.h - 8);
	ctx.textAlign = 'center';
	ctx.fillText('V ↑', 13, 12);
	ctx.restore();
}

export function drawUnitSquare(ctx, view, color = 'rgba(255,255,255,0.9)') {
	const [x0, y0] = view.toPx(0, 1);
	const s = view.scale;
	ctx.save();
	ctx.strokeStyle = color;
	ctx.lineWidth = 1.5;
	ctx.strokeRect(x0, y0, s, s);
	ctx.restore();
}

export function drawGridLines(ctx, view, divisions = 8, color = 'rgba(255,255,255,0.25)') {
	ctx.save();
	ctx.strokeStyle = color;
	ctx.lineWidth = 1;
	ctx.beginPath();
	for (let i = 1; i < divisions; i++) {
		const t = i / divisions;
		const a = view.toPx(t, 0);
		const b = view.toPx(t, 1);
		ctx.moveTo(a[0], a[1]);
		ctx.lineTo(b[0], b[1]);
		const c = view.toPx(0, t);
		const d = view.toPx(1, t);
		ctx.moveTo(c[0], c[1]);
		ctx.lineTo(d[0], d[1]);
	}
	ctx.stroke();
	ctx.restore();
}

export function drawTexelGrid(ctx, view, n, color = 'rgba(255,255,255,0.3)') {
	const px = view.scale / n;
	if (px < 6) return false;
	const { u0, u1, v0, v1 } = view.visibleRange();
	ctx.save();
	ctx.strokeStyle = color;
	ctx.lineWidth = 1;
	ctx.beginPath();
	const iA = Math.max(0, Math.floor(u0 * n));
	const iB = Math.min(n, Math.ceil(u1 * n));
	const jA = Math.max(0, Math.floor(v0 * n));
	const jB = Math.min(n, Math.ceil(v1 * n));
	for (let i = iA; i <= iB; i++) {
		const a = view.toPx(i / n, Math.max(0, v0));
		const b = view.toPx(i / n, Math.min(1, v1));
		ctx.moveTo(a[0], a[1]);
		ctx.lineTo(b[0], b[1]);
	}
	for (let j = jA; j <= jB; j++) {
		const a = view.toPx(Math.max(0, u0), j / n);
		const b = view.toPx(Math.min(1, u1), j / n);
		ctx.moveTo(a[0], a[1]);
		ctx.lineTo(b[0], b[1]);
	}
	ctx.stroke();
	ctx.restore();
	return true;
}

export function fillTexel(ctx, view, n, i, j, style, stroke) {
	const [x, y] = view.toPx(i / n, (j + 1) / n);
	const s = view.scale / n;
	ctx.save();
	if (style) {
		ctx.fillStyle = style;
		ctx.fillRect(x, y, s, s);
	}
	if (stroke) {
		ctx.strokeStyle = stroke;
		ctx.lineWidth = 2;
		ctx.strokeRect(x, y, s, s);
	}
	ctx.restore();
}

// Dibuja la textura con el modo de wrapping visible en todo el dominio del canvas.
export function drawTextureWrapped(ctx, view, tex, wrap, { dimOutside = true, smooth } = {}) {
	const img = tex.canvas;
	const n = tex.size;
	const { u0, u1, v0, v1 } = view.visibleRange();
	const s = view.scale;
	ctx.save();
	ctx.imageSmoothingEnabled = smooth ?? s / n < 2.5;
	const rect = (i, j) => {
		const [x, y] = view.toPx(i, j + 1);
		return [x, y];
	};
	if (wrap === 'clamp') {
		const [x, y] = rect(0, 0);
		ctx.drawImage(img, x, y, s, s);
		const L = view.toPx(u0, 0)[0];
		const R = view.toPx(u1, 0)[0];
		const T = view.toPx(0, v1)[1];
		const B = view.toPx(0, v0)[1];
		if (u0 < 0) ctx.drawImage(img, 0, 0, 1, n, L, y, x - L, s);
		if (u1 > 1) ctx.drawImage(img, n - 1, 0, 1, n, x + s, y, R - x - s, s);
		if (v1 > 1) ctx.drawImage(img, 0, 0, n, 1, x, T, s, y - T);
		if (v0 < 0) ctx.drawImage(img, 0, n - 1, n, 1, x, y + s, s, B - y - s);
		if (u0 < 0 && v1 > 1) ctx.drawImage(img, 0, 0, 1, 1, L, T, x - L, y - T);
		if (u1 > 1 && v1 > 1) ctx.drawImage(img, n - 1, 0, 1, 1, x + s, T, R - x - s, y - T);
		if (u0 < 0 && v0 < 0) ctx.drawImage(img, 0, n - 1, 1, 1, L, y + s, x - L, B - y - s);
		if (u1 > 1 && v0 < 0) ctx.drawImage(img, n - 1, n - 1, 1, 1, x + s, y + s, R - x - s, B - y - s);
	} else {
		const iA = Math.floor(u0);
		const iB = Math.floor(u1);
		const jA = Math.floor(v0);
		const jB = Math.floor(v1);
		for (let i = iA; i <= iB; i++)
			for (let j = jA; j <= jB; j++) {
				const [x, y] = rect(i, j);
				ctx.save();
				ctx.translate(x, y);
				let sx = 1,
					sy = 1,
					tx = 0,
					ty = 0;
				if (wrap === 'mirror') {
					if (((i % 2) + 2) % 2 === 1) {
						sx = -1;
						tx = s;
					}
					if (((j % 2) + 2) % 2 === 1) {
						sy = -1;
						ty = s;
					}
				}
				ctx.translate(tx, ty);
				ctx.scale(sx, sy);
				ctx.drawImage(img, 0, 0, s, s);
				ctx.restore();
			}
	}
	if (dimOutside) {
		const [x, y] = view.toPx(0, 1);
		ctx.fillStyle = 'rgba(8,10,14,0.42)';
		ctx.beginPath();
		ctx.rect(0, 0, view.w, view.h);
		ctx.rect(x, y, s, s);
		ctx.fill('evenodd');
	}
	ctx.restore();
}

export function pathTriangle(ctx, view, uvs) {
	ctx.beginPath();
	uvs.forEach((p, i) => {
		const [x, y] = view.toPx(p[0], p[1]);
		if (i) ctx.lineTo(x, y);
		else ctx.moveTo(x, y);
	});
	ctx.closePath();
}

export function drawHandle(ctx, x, y, color, label, { r = 9, ring = true, textColor = '#fff', big = false } = {}) {
	ctx.save();
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.fillStyle = color;
	ctx.fill();
	ctx.lineWidth = 2;
	ctx.strokeStyle = '#fff';
	ctx.stroke();
	if (ring) {
		ctx.strokeStyle = 'rgba(0,0,0,0.6)';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.arc(x, y, r + 2, 0, Math.PI * 2);
		ctx.stroke();
	}
	if (label) {
		ctx.font = `bold ${big ? 14 : 12}px sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillStyle = textColor;
		ctx.fillText(label, x, y + 0.5);
	}
	ctx.restore();
}

export function drawTag(ctx, text, x, y, { color = '#fff', align = 'left', bg = 'rgba(10,12,16,0.78)' } = {}) {
	ctx.save();
	ctx.font = '12px sans-serif';
	const lines = Array.isArray(text) ? text : [text];
	const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 10;
	const h = lines.length * 15 + 4;
	const x0 = align === 'right' ? x - w : x;
	ctx.fillStyle = bg;
	ctx.fillRect(x0, y, w, h);
	ctx.fillStyle = color;
	ctx.textBaseline = 'top';
	ctx.textAlign = 'left';
	lines.forEach((l, i) => ctx.fillText(l, x0 + 5, y + 3 + i * 15));
	ctx.restore();
}

export function drawLine(ctx, a, b, color, width = 1.5, dash = null) {
	ctx.save();
	ctx.strokeStyle = color;
	ctx.lineWidth = width;
	if (dash) ctx.setLineDash(dash);
	ctx.beginPath();
	ctx.moveTo(a[0], a[1]);
	ctx.lineTo(b[0], b[1]);
	ctx.stroke();
	ctx.restore();
}

export const fmt = (x, d = 2) => (Math.abs(x) < 0.5 * 10 ** -d ? 0 : x).toFixed(d);
