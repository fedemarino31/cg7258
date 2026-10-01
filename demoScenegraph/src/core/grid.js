// Trazados de la grilla y marcas de los ejes.

export function gridPaths(g) {
  let minor = '';
  for (let v = g.min; v <= g.max + 1e-9; v += g.paso) {
    if (Math.abs(v) < 1e-9) continue;
    minor += `M${v} ${g.min}V${g.max}M${g.min} ${v}H${g.max}`;
  }
  const major = `M0 ${g.min}V${g.max}M${g.min} 0H${g.max}`;
  return { minor, major };
}

export function gridTicks(g) {
  const out = [];
  for (let v = g.min; v <= g.max; v += g.paso * 2) if (Math.abs(v) > 1e-9) out.push(v);
  return out;
}
