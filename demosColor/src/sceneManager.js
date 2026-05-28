import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBColorSpace } from './RGBColorSpace.js';
import { CMYColorSpace } from './CMYColorSpace.js';
import { HSVColorSpace } from './HSVColorSpace.js';
import { HSLColorSpace } from './HSLColorSpace.js';
import { DotsRenderer } from './DotsRenderer.js';

export class SceneManager {
    constructor(scene, camera, renderer, controls) {
        this.scene = scene;
        this.renderer = renderer;

        // Perspective camera (original)
        this.perspCamera = camera;
        this.perspControls = controls;

        // Orthographic camera (created on demand)
        this.orthoCamera = null;
        this.orthoControls = null;

        // Active camera & controls (start with perspective)
        this.activeCamera = camera;
        this.activeControls = controls;
        this.currentView = 'perspective'; // 'perspective'|'top'|'left'|'front'

        this.uiManager = null;
        this.activeColorSpace = null;
        this.currentModelType = '';
        this._settingModel = false;
        this.showEdges = true;

        // Dots rendering params
        this.renderingMode = 'solid';
        this.dotsParams = { dotsPerSide: 40, dotRadius: 0.0055 };
        this.dotsSubset = 'all';
        this.dotsTolerance = 0.4;
    }

    setUIManager(uiManager) {
        this.uiManager = uiManager;
    }

    // ── Active camera/controls accessors used by main.js animate loop ──
    getActiveCamera() { return this.activeCamera; }
    getActiveControls() { return this.activeControls; }

    setColorModel(modelType) {
        if (this.currentModelType === modelType && this.activeColorSpace) return;

        // Guard against re-entrancy: setCurrentModelAndResetLimits() calls
        // pane.refresh(), which fires the model dropdown's 'change' event and
        // re-invokes setColorModel() while activeColorSpace is momentarily null,
        // otherwise stacking multiple color-space visuals on top of each other.
        if (this._settingModel) return;
        this._settingModel = true;

        try {
            if (this.activeColorSpace) {
                this.activeColorSpace.dispose();
                this.activeColorSpace = null;
            }

            this.currentModelType = modelType;

            if (this.uiManager && typeof this.uiManager.setCurrentModelAndResetLimits === 'function') {
                this.uiManager.setCurrentModelAndResetLimits(modelType);
            } else {
                console.error('UIManager or setCurrentModelAndResetLimits not available.');
                return;
            }

            const initialLimits = this.uiManager.getCurrentLimits();

            switch (modelType) {
                case 'RGB': this.activeColorSpace = new RGBColorSpace(this.scene); break;
                case 'CMY': this.activeColorSpace = new CMYColorSpace(this.scene); break;
                case 'HSV': this.activeColorSpace = new HSVColorSpace(this.scene); break;
                case 'HSL': this.activeColorSpace = new HSLColorSpace(this.scene); break;
                default:
                    console.error(`Unsupported color model: ${modelType}`);
                    return;
            }

            this.activeColorSpace.showEdges = this.showEdges;
            this.activeColorSpace.renderingMode = this.renderingMode;

            if (this.renderingMode === 'dots') {
                const dr = new DotsRenderer(modelType, this.dotsParams, this.dotsSubset, this.dotsTolerance);
                this.activeColorSpace.dotsRenderer = dr;
            }

            this.activeColorSpace.display(initialLimits);
            this.fitCameraToCurrentSpace();
        } finally {
            this._settingModel = false;
        }
    }

    setEdgesVisible(visible) {
        this.showEdges = visible;
        if (this.activeColorSpace) this.activeColorSpace.setEdgesVisible(visible);
    }

    setAxesVisible(visible) {
        if (this.activeColorSpace) this.activeColorSpace.setAxesVisible(visible);
    }

    setVolumeVisible(visible) {
        if (this.activeColorSpace) this.activeColorSpace.setVolumeVisible(visible);
    }

    updateColorSubspace(limits) {
        if (this.activeColorSpace) {
            this.activeColorSpace.refreshSubSpaceVolume(limits);
            this.updateOrbitControlsTarget();
        }
    }

    // ── Rendering mode ────────────────────────────────────────────
    setRenderingMode(mode) {
        if (this.renderingMode === mode) return;
        this.renderingMode = mode;

        if (!this.activeColorSpace || !this.uiManager) return;
        const limits = this.uiManager.getCurrentLimits();

        let dotsRenderer = null;
        if (mode === 'dots') {
            dotsRenderer = new DotsRenderer(this.currentModelType, this.dotsParams, this.dotsSubset, this.dotsTolerance);
        }
        this.activeColorSpace.setRenderingMode(mode, dotsRenderer, limits);
    }

    setDotsSubset(subset) {
        this.dotsSubset = subset;
        if (this.renderingMode === 'dots' && this.activeColorSpace?.dotsRenderer && this.uiManager) {
            this.activeColorSpace.dotsRenderer.setSubset(subset);
            this.activeColorSpace.dotsRenderer.update(this.uiManager.getCurrentLimits());
        }
    }

    setDotsTolerance(tolerance) {
        this.dotsTolerance = tolerance;
        if (this.renderingMode === 'dots' && this.activeColorSpace?.dotsRenderer && this.uiManager) {
            this.activeColorSpace.dotsRenderer.setTolerance(tolerance);
            this.activeColorSpace.dotsRenderer.update(this.uiManager.getCurrentLimits());
        }
    }

    updateDotsParams(params) {
        Object.assign(this.dotsParams, params);
        if (this.renderingMode === 'dots' && this.activeColorSpace?.dotsRenderer) {
            const limits = this.uiManager.getCurrentLimits();
            this.activeColorSpace.dotsRenderer.rebuild(this.currentModelType, this.dotsParams);
            this.activeColorSpace.dotsRenderer.update(limits);
        }
    }

    // ── Camera views ──────────────────────────────────────────────
    switchView(type) {
        this.currentView = type;

        const center = this._getSceneCenter();
        const boundingBox = this.activeColorSpace?.getCurrentSpaceBoundingBox();
        const size = boundingBox ? new THREE.Vector3() : null;
        if (size) boundingBox.getSize(size);
        const maxDim = size ? Math.max(size.x, size.y, size.z) : 1.5;
        const orthoHalfSize = maxDim * 1.2;
        const dist = maxDim * 3;

        if (type === 'perspective') {
            // Restore perspective camera
            this.activeCamera = this.perspCamera;
            this.activeControls = this.perspControls;
            this.perspControls.enableRotate = true;
            this.fitCameraToCurrentSpace();
            return;
        }

        // Build ortho camera if needed
        this._ensureOrthoCamera(orthoHalfSize);

        // Position based on view
        switch (type) {
            case 'top':
                this.orthoCamera.position.set(center.x, center.y + dist, center.z);
                this.orthoCamera.up.set(0, 0, -1);
                break;
            case 'left':
                this.orthoCamera.position.set(center.x - dist, center.y, center.z);
                this.orthoCamera.up.set(0, 1, 0);
                break;
            case 'front':
                this.orthoCamera.position.set(center.x, center.y, center.z + dist);
                this.orthoCamera.up.set(0, 1, 0);
                break;
        }
        this.orthoCamera.lookAt(center);
        this.orthoCamera.updateProjectionMatrix();

        this.orthoControls.target.copy(center);
        this.orthoControls.enableRotate = false;
        this.orthoControls.update();

        this.activeCamera = this.orthoCamera;
        this.activeControls = this.orthoControls;
    }

    _ensureOrthoCamera(halfSize) {
        const aspect = this.renderer.domElement.clientWidth / this.renderer.domElement.clientHeight;
        const h = halfSize;
        const w = h * aspect;

        if (!this.orthoCamera) {
            this.orthoCamera = new THREE.OrthographicCamera(-w, w, h, -h, 0.01, 1000);

            this.orthoControls = new OrbitControls(this.orthoCamera, this.renderer.domElement);
            this.orthoControls.enableRotate = false;
            this.orthoControls.enableDamping = true;
            this.orthoControls.dampingFactor = 0.2;
            this.orthoControls.screenSpacePanning = true;
        } else {
            // Update frustum for new size
            this.orthoCamera.left   = -w;
            this.orthoCamera.right  =  w;
            this.orthoCamera.top    =  h;
            this.orthoCamera.bottom = -h;
            this.orthoCamera.updateProjectionMatrix();
        }
    }

    _getSceneCenter() {
        if (!this.activeColorSpace) return new THREE.Vector3(0, 0.5, 0);
        if (this.currentModelType === 'HSV' || this.currentModelType === 'HSL') {
            return new THREE.Vector3(0, 0.5, 0);
        }
        const bb = this.activeColorSpace.getCurrentSpaceBoundingBox();
        const c = new THREE.Vector3();
        if (bb) bb.getCenter(c);
        return c;
    }

    updateOrbitControlsTarget() {
        const center = this._getSceneCenter();
        this.activeControls.target.copy(center);
        this.activeControls.update();
    }

    fitCameraToCurrentSpace() {
        if (!this.activeColorSpace) return;
        const boundingBox = this.activeColorSpace.getCurrentSpaceBoundingBox();
        if (!boundingBox) return;

        const center = this._getSceneCenter();
        this.perspControls.target.copy(center);

        const size = new THREE.Vector3();
        boundingBox.getSize(size);

        if (size.x === 0 && size.y === 0 && size.z === 0) {
            this.perspControls.target.set(0, 0.5, 0);
            this.perspCamera.position.set(2, 2, 2);
            this.perspCamera.lookAt(this.perspControls.target);
            this.perspControls.update();
            return;
        }

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.perspCamera.fov * (Math.PI / 180);
        let distance = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 2.5;

        const offsetDirection = new THREE.Vector3(1, 1, 1).normalize();
        this.perspCamera.position.copy(center).addScaledVector(offsetDirection, distance);
        this.perspControls.target.copy(center);
        this.perspControls.update();
        this.perspCamera.lookAt(center);
        this.perspCamera.updateProjectionMatrix();
    }

    onResize(width, height) {
        const aspect = width / height;

        this.perspCamera.aspect = aspect;
        this.perspCamera.updateProjectionMatrix();

        if (this.orthoCamera) {
            const h = (this.orthoCamera.top - this.orthoCamera.bottom) / 2;
            const w = h * aspect;
            this.orthoCamera.left   = -w;
            this.orthoCamera.right  =  w;
            this.orthoCamera.updateProjectionMatrix();
        }
    }

    animate() {
        // Empty — OrbitControls updates happen in main.js via getActiveControls()
    }
}
