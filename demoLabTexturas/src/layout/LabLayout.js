// `views` (opcional) reemplaza las dos columnas clásicas por N columnas: [{ title, stack }].
export function buildLabLayout(stage, { leftTitle = 'Escena 3D', centerTitle = 'Espacio de textura', centerStack = false, views = null } = {}) {
	const root = document.createElement('div');
	const cols = views || [
		{ title: leftTitle, stack: false },
		{ title: centerTitle, stack: centerStack },
	];
	root.className = 'lab' + (views ? ` cols-${cols.length}` : '');
	root.innerHTML = `
		${cols.map((c, i) => `<section class="col col-view"><div class="col-title"></div><div class="${c.stack ? 'stack' : 'view'}" data-i="${i}"></div></section>`).join('')}
		<aside class="col col-controls" aria-label="Controles"><button class="btn controls-toggle" type="button" aria-expanded="true" title="Ocultar controles"><span aria-hidden="true">›</span><em>Ocultar controles</em></button></aside>`;
	const titles = root.querySelectorAll('.col-title');
	cols.forEach((c, i) => (titles[i].textContent = c.title));
	const els = [...root.querySelectorAll('[data-i]')];
	stage.appendChild(root);
	const toggle = root.querySelector('.controls-toggle');
	toggle.addEventListener('click', () => {
		const collapsed = root.classList.toggle('controls-collapsed');
		toggle.setAttribute('aria-expanded', String(!collapsed));
		toggle.title = collapsed ? 'Mostrar controles' : 'Ocultar controles';
		toggle.querySelector('span').textContent = collapsed ? '‹' : '›';
		toggle.querySelector('em').textContent = collapsed ? 'Mostrar controles' : 'Ocultar controles';
	});
	return {
		root,
		views: els,
		left: els[0],
		center: els[1] || els[0],
		controls: root.querySelector('.col-controls'),
		addCenterView(flex = 1) {
			const v = document.createElement('div');
			v.className = 'view';
			v.style.flex = String(flex);
			(els[1] || els[0]).appendChild(v);
			return v;
		},
		dispose() {
			root.remove();
		},
	};
}
