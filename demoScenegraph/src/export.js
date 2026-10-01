// Descargas y exportación de SVG/PNG desde el navegador.

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(filename, text, type = 'text/plain') {
  downloadBlob(filename, new Blob([text], { type: `${type};charset=utf-8` }));
}

const PAINT_ATTRS = ['fill', 'stroke', 'stop-color', 'color'];

/**
 * Serializa un <svg> del DOM a un SVG autónomo: resuelve las variables CSS
 * (var(--x)) a sus colores actuales y fija el tamaño en píxeles.
 */
export function serializeSvg(svgEl, widthPx = 1000) {
  const clone = svgEl.cloneNode(true);
  const src = [svgEl, ...svgEl.querySelectorAll('*')];
  const dst = [clone, ...clone.querySelectorAll('*')];
  src.forEach((el, i) => {
    const cs = getComputedStyle(el);
    for (const attr of PAINT_ATTRS) {
      const v = dst[i].getAttribute(attr);
      if (v && v.includes('var(')) {
        dst[i].setAttribute(
          attr,
          v.replace(/var\((--[\w-]+)\)/g, (_, name) => cs.getPropertyValue(name).trim() || 'currentColor')
        );
      }
    }
  });
  const vb = svgEl.viewBox.baseVal;
  const ratio = vb && vb.width ? vb.height / vb.width : 1;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(widthPx));
  clone.setAttribute('height', String(Math.round(widthPx * ratio)));
  clone.removeAttribute('style');
  clone.removeAttribute('class');
  clone.setAttribute('font-family', 'system-ui, Arial, sans-serif');
  return new XMLSerializer().serializeToString(clone);
}

export function downloadSvg(filename, svgEl, widthPx = 1000) {
  downloadText(filename, serializeSvg(svgEl, widthPx), 'image/svg+xml');
}

export async function downloadPng(filename, svgEl, widthPx = 2000) {
  const text = serializeSvg(svgEl, widthPx);
  const vb = svgEl.viewBox.baseVal;
  const h = Math.round(widthPx * (vb.height / vb.width));
  const img = new Image();
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml;charset=utf-8' }));
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('No se pudo rasterizar el SVG'));
    img.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, widthPx, h);
  ctx.drawImage(img, 0, 0, widthPx, h);
  URL.revokeObjectURL(url);
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  downloadBlob(filename, blob);
}
