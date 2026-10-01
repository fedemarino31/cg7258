// Vista 2D ortográfica del espacio de textura (canvas 2D) con zoom y paneo.
export class TextureSpaceView {
	constructor(container, opts = {}) {
		const { center = [0.5, 0.5], extent = 1.3, onInvalidate = () => {}, tag = null } = opts;
		this.container = container;
		this.onInvalidate = onInvalidate;
		this.home = { center, extent };
		this.canvas = document.createElement('canvas');
		container.appendChild(this.canvas);
		this.ctx = this.canvas.getContext('2d');
		this.drawFn = () => {};
		this.handlers = {};
		this.cursor = 'default';

		if (tag) {
			const t = document.createElement('div');
			t.className = 'view-tag';
			t.textContent = tag;
			container.appendChild(t);
			this.tagEl = t;
		}
		this.resetBtn = document.createElement('button');
		this.resetBtn.className = 'btn view-btn';
		this.resetBtn.textContent = 'Restablecer vista';
		this.resetBtn.addEventListener('click', () => this.resetView());
		container.appendChild(this.resetBtn);

		this._bind();
		this.ro = new ResizeObserver(() => this.resize());
		this.ro.observe(container);
		this.resize();
		this.resetView();
	}

	resetView() {
		this.cx = this.home.center[0];
		this.cy = this.home.center[1];
		this.scale = Math.min(this.w, this.h) / this.home.extent;
		this.baseScale = this.scale;
		this.onInvalidate();
	}

	resize() {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		this.w = Math.max(1, this.container.clientWidth);
		this.h = Math.max(1, this.container.clientHeight);
		this.dpr = dpr;
		this.canvas.width = Math.round(this.w * dpr);
		this.canvas.height = Math.round(this.h * dpr);
		if (this.home && this.baseScale) {
			const ratio = this.scale / this.baseScale;
			this.baseScale = Math.min(this.w, this.h) / this.home.extent;
			this.scale = this.baseScale * ratio;
		}
		this.onInvalidate();
	}

	toPx(u, v) {
		return [(u - this.cx) * this.scale + this.w / 2, this.h / 2 - (v - this.cy) * this.scale];
	}

	toUV(x, y) {
		return [(x - this.w / 2) / this.scale + this.cx, (this.h / 2 - y) / this.scale + this.cy];
	}

	visibleRange() {
		const [u0, v1] = this.toUV(0, 0);
		const [u1, v0] = this.toUV(this.w, this.h);
		return { u0, u1, v0, v1 };
	}

	eventUV(e) {
		const r = this.canvas.getBoundingClientRect();
		const x = e.clientX - r.left;
		const y = e.clientY - r.top;
		return { x, y, uv: this.toUV(x, y) };
	}

	_bind() {
		const c = this.canvas;
		let panning = null;
		let captured = false;
		c.addEventListener('contextmenu', (e) => e.preventDefault());
		c.addEventListener('wheel', (e) => {
			e.preventDefault();
			const { x, y, uv } = this.eventUV(e);
			const k = Math.exp(-e.deltaY * 0.0015);
			this.scale = Math.min(this.baseScale * 60, Math.max(this.baseScale * 0.5, this.scale * k));
			this.cx = uv[0] - (x - this.w / 2) / this.scale;
			this.cy = uv[1] - (this.h / 2 - y) / this.scale;
			this.onInvalidate();
		}, { passive: false });
		c.addEventListener('pointerdown', (e) => {
			const p = this.eventUV(e);
			captured = false;
			if (e.button === 0 && this.handlers.down) captured = !!this.handlers.down(p.uv, e, p);
			if (captured) {
				c.setPointerCapture(e.pointerId);
			} else {
				panning = { x: e.clientX, y: e.clientY, cx: this.cx, cy: this.cy };
				c.setPointerCapture(e.pointerId);
			}
		});
		c.addEventListener('pointermove', (e) => {
			const p = this.eventUV(e);
			if (panning) {
				this.cx = panning.cx - (e.clientX - panning.x) / this.scale;
				this.cy = panning.cy + (e.clientY - panning.y) / this.scale;
				this.onInvalidate();
			} else {
				this.handlers.move?.(p.uv, e, p, captured);
			}
			if (captured) this.handlers.drag?.(p.uv, e, p);
			if (!panning && !captured) this.canvas.style.cursor = this.handlers.cursorAt?.(p.uv, p) || this.cursor;
		});
		const end = (e) => {
			const p = this.eventUV(e);
			if (captured) this.handlers.up?.(p.uv, e, p);
			captured = false;
			panning = null;
		};
		c.addEventListener('pointerup', end);
		c.addEventListener('pointercancel', end);
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
		this.resetBtn.remove();
		this.tagEl?.remove();
	}
}
