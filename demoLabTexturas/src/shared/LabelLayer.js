import * as THREE from 'three';

export class LabelLayer {
	constructor(container) {
		this.el = document.createElement('div');
		this.el.className = 'label-layer';
		container.appendChild(this.el);
		this.items = new Map();
		this._v = new THREE.Vector3();
	}

	set(key, { html, color, position, visible = true, offset = [8, -8] }) {
		let it = this.items.get(key);
		if (!it) {
			const el = document.createElement('div');
			el.className = 'lbl';
			this.el.appendChild(el);
			it = { el, pos: new THREE.Vector3(), visible: true, html: '', offset };
			this.items.set(key, it);
		}
		if (html !== undefined && html !== it.html) {
			it.html = html;
			it.el.innerHTML = html;
		}
		if (color) it.el.style.setProperty('--c', color);
		if (position) it.pos.copy(position);
		it.visible = visible;
		it.offset = offset;
	}

	hide(key) {
		const it = this.items.get(key);
		if (it) it.visible = false;
	}

	update(camera, w, h) {
		for (const it of this.items.values()) {
			if (!it.visible) {
				it.el.style.display = 'none';
				continue;
			}
			this._v.copy(it.pos).project(camera);
			if (this._v.z > 1 || this._v.z < -1) {
				it.el.style.display = 'none';
				continue;
			}
			it.el.style.display = '';
			const x = (this._v.x * 0.5 + 0.5) * w + it.offset[0];
			const y = (-this._v.y * 0.5 + 0.5) * h + it.offset[1];
			it.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
		}
	}

	dispose() {
		this.el.remove();
		this.items.clear();
	}
}
