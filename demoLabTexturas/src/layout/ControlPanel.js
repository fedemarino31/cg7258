// Constructor de controles ligados a un store: cambiar el control actualiza el store y viceversa.
let uid = 0;

export class ControlPanel {
	constructor(el, store) {
		this.el = el;
		this.store = store;
		this.refs = [];
		this.unsub = store.subscribe(() => this.sync());
	}

	_wrap(cls = '') {
		const d = document.createElement('div');
		d.className = 'ctl ' + cls;
		this.el.appendChild(d);
		return d;
	}

	idea(text) {
		const d = document.createElement('div');
		d.className = 'idea';
		d.innerHTML = `<b>Idea principal</b>${text}`;
		this.el.appendChild(d);
	}

	title(text) {
		const d = document.createElement('div');
		d.className = 'ctl-title';
		d.textContent = text;
		this.el.appendChild(d);
	}

	select(key, label, options) {
		const id = 'c' + uid++;
		const w = this._wrap();
		w.innerHTML = `<label for="${id}">${label}</label><select id="${id}"></select>`;
		const sel = w.querySelector('select');
		options.forEach((o) => sel.add(new Option(o.label, o.value)));
		sel.value = this.store.state[key];
		sel.addEventListener('change', () => this.store.set({ [key]: sel.value }));
		this.refs.push(() => (sel.value = this.store.state[key]));
		return sel;
	}

	segmented(key, label, options) {
		const w = this._wrap();
		w.innerHTML = `<label>${label}</label><div class="seg"></div>`;
		const seg = w.querySelector('.seg');
		const btns = options.map((o) => {
			const b = document.createElement('button');
			b.className = 'btn';
			b.textContent = o.label;
			b.addEventListener('click', () => this.store.set({ [key]: o.value }));
			seg.appendChild(b);
			return [o.value, b];
		});
		const upd = () => btns.forEach(([v, b]) => b.classList.toggle('on', this.store.state[key] === v));
		upd();
		this.refs.push(upd);
		return seg;
	}

	checkbox(key, label) {
		const id = 'c' + uid++;
		const w = this._wrap('check');
		w.innerHTML = `<input type="checkbox" id="${id}"><label for="${id}">${label}</label>`;
		const cb = w.querySelector('input');
		cb.checked = !!this.store.state[key];
		cb.addEventListener('change', () => this.store.set({ [key]: cb.checked }));
		this.refs.push(() => (cb.checked = !!this.store.state[key]));
		return cb;
	}

	slider(key, label, { min = 0, max = 1, step = 0.01, digits = 2 } = {}) {
		const id = 'c' + uid++;
		const w = this._wrap();
		w.innerHTML = `<label for="${id}">${label}: <span class="val"></span></label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}">`;
		const r = w.querySelector('input');
		const val = w.querySelector('.val');
		const upd = () => {
			r.value = this.store.state[key];
			val.textContent = (+this.store.state[key]).toFixed(digits);
		};
		r.addEventListener('input', () => this.store.set({ [key]: parseFloat(r.value) }));
		upd();
		this.refs.push(upd);
		return r;
	}

	buttons(...defs) {
		const w = this._wrap();
		const row = document.createElement('div');
		row.className = defs.length > 1 && defs.length < 3 ? 'btn-row' : 'seg';
		w.appendChild(row);
		return defs.map((d) => {
			const b = document.createElement('button');
			b.className = 'btn';
			b.textContent = d.label;
			b.addEventListener('click', d.onClick);
			row.appendChild(b);
			return b;
		});
	}

	readout() {
		const d = document.createElement('div');
		d.className = 'readout';
		this.el.appendChild(d);
		return d;
	}

	html(markup) {
		const d = document.createElement('div');
		d.className = 'ctl';
		d.innerHTML = markup;
		this.el.appendChild(d);
		return d;
	}

	sync() {
		this.refs.forEach((f) => f());
	}

	dispose() {
		this.unsub();
	}
}
