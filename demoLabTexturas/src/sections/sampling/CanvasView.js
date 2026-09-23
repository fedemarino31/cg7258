// Canvas 2D que ocupa un contenedor, con escala por devicePixelRatio y eventos en píxeles CSS.
export class CanvasView {
	constructor(container, { onInvalidate = () => {}, tag = null } = {}) {
		this.container = container;
		this.onInvalidate = onInvalidate;
		this.canvas = document.createElement('canvas');
		container.appendChild(this.canvas);
		this.ctx = this.canvas.getContext('2d');
		this.drawFn = () => {};
		if (tag) {
			this.tagEl = document.createElement('div');
			this.tagEl.className = 'view-tag';
			this.tagEl.textContent = tag;
			container.appendChild(this.tagEl);
		}
		this.ro = new ResizeObserver(() => this.resize());
		this.ro.observe(container);
		this.resize();
	}

	resize() {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		this.w = Math.max(1, this.container.clientWidth);
		this.h = Math.max(1, this.container.clientHeight);
		this.dpr = dpr;
		this.canvas.width = Math.round(this.w * dpr);
		this.canvas.height = Math.round(this.h * dpr);
		this.onInvalidate();
	}

	pos(e) {
		const r = this.canvas.getBoundingClientRect();
		return [e.clientX - r.left, e.clientY - r.top];
	}

	render() {
		const { ctx, dpr } = this;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, this.w, this.h);
		this.drawFn(ctx, this);
	}

	dispose() {
		this.ro.disconnect();
		this.canvas.remove();
		this.tagEl?.remove();
	}
}
