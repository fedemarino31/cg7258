export class Lab {
	constructor() {
		this.dirty = true;
		this.animating = false;
		this._disposers = [];
		this._last = performance.now();
		this.invalidate = () => {
			this.dirty = true;
		};
	}

	listen(target, type, fn, opts) {
		target.addEventListener(type, fn, opts);
		this._disposers.push(() => target.removeEventListener(type, fn, opts));
	}

	own(disposable) {
		this._disposers.push(() => disposable.dispose && disposable.dispose());
		return disposable;
	}

	tick(now) {
		const dt = Math.min(0.1, (now - this._last) / 1000);
		this._last = now;
		if (this.animating) this.update?.(dt);
		if (this.dirty || this.animating) {
			this.dirty = false;
			this.render(dt);
		}
	}

	dispose() {
		this._disposers.forEach((d) => d());
		this._disposers = [];
	}
}

// Distingue un clic de un arrastre (para no confundir con la órbita de cámara).
export function onClick(lab, el, fn, tolerance = 4) {
	let sx = 0,
		sy = 0,
		down = false;
	lab.listen(el, 'pointerdown', (e) => {
		if (e.button !== 0) return;
		down = true;
		sx = e.clientX;
		sy = e.clientY;
	});
	lab.listen(el, 'pointerup', (e) => {
		if (!down) return;
		down = false;
		if (Math.hypot(e.clientX - sx, e.clientY - sy) <= tolerance) fn(e);
	});
}
