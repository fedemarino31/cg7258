import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LabelLayer } from './LabelLayer.js';

export class Scene3DView {
	constructor(container, opts = {}) {
		const {
			fov = 45,
			background = 0x12141a,
			position = [4, 3, 6],
			target = [0, 0, 0],
			minDistance = 2,
			maxDistance = 20,
			panLimit = 2,
			onInvalidate = () => {},
			tag = null,
		} = opts;
		this.container = container;
		this.onInvalidate = onInvalidate;
		this.home = { position: new THREE.Vector3(...position), target: new THREE.Vector3(...target) };

		this.renderer = new THREE.WebGLRenderer({ antialias: true });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.setClearColor(background);
		this.dom = this.renderer.domElement;
		container.appendChild(this.dom);

		this.scene = new THREE.Scene();
		this.camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 200);

		this.controls = new OrbitControls(this.camera, this.dom);
		this.controls.minDistance = minDistance;
		this.controls.maxDistance = maxDistance;
		this.controls.addEventListener('change', () => {
			this.controls.target.clampLength(0, panLimit);
			this.onInvalidate();
		});

		this.labels = new LabelLayer(container);
		this.raycaster = new THREE.Raycaster();
		this._ndc = new THREE.Vector2();

		this.resetBtn = document.createElement('button');
		this.resetBtn.className = 'btn view-btn';
		this.resetBtn.textContent = 'Restablecer cámara';
		this.resetBtn.addEventListener('click', () => this.resetCamera());
		container.appendChild(this.resetBtn);

		if (tag) {
			this.tagEl = document.createElement('div');
			this.tagEl.className = 'view-tag';
			this.tagEl.textContent = tag;
			container.appendChild(this.tagEl);
		}

		this.ro = new ResizeObserver(() => this.resize());
		this.ro.observe(container);
		this.resetCamera();
		this.resize();
	}

	resetCamera() {
		this.camera.position.copy(this.home.position);
		this.controls.target.copy(this.home.target);
		this.camera.lookAt(this.home.target);
		this.controls.update();
		this.onInvalidate();
	}

	resize() {
		const w = Math.max(1, this.container.clientWidth);
		const h = Math.max(1, this.container.clientHeight);
		this.w = w;
		this.h = h;
		this.renderer.setSize(w, h, false);
		this.camera.aspect = w / h;
		this.camera.updateProjectionMatrix();
		this.onInvalidate();
	}

	pointerNDC(e) {
		const r = this.dom.getBoundingClientRect();
		this._ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
		return this._ndc;
	}

	rayFromEvent(e) {
		this.raycaster.setFromCamera(this.pointerNDC(e), this.camera);
		return this.raycaster.ray;
	}

	raycast(e, objects, recursive = false) {
		this.rayFromEvent(e);
		return this.raycaster.intersectObjects(objects, recursive);
	}

	render() {
		this.labels.update(this.camera, this.w, this.h);
		this.renderer.render(this.scene, this.camera);
	}

	dispose() {
		this.ro.disconnect();
		this.controls.dispose();
		this.scene.traverse((o) => {
			if (o.geometry) o.geometry.dispose();
			if (o.material) {
				for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
					for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose();
					if (m.uniforms) for (const k in m.uniforms) if (m.uniforms[k].value?.isTexture) m.uniforms[k].value.dispose();
					m.dispose();
				}
			}
			if (o.dispose && o.isTransformControls) o.dispose();
		});
		this.labels.dispose();
		this.resetBtn.remove();
		this.tagEl?.remove();
		this.renderer.dispose();
		this.renderer.forceContextLoss();
		this.dom.remove();
	}
}
