import * as THREE from 'three';
import { RGBColorSpace } from './RGBColorSpace.js';
import { CMYColorSpace } from './CMYColorSpace.js';
import { HSVColorSpace } from './HSVColorSpace.js';
import { HSLColorSpace } from './HSLColorSpace.js';

export class SceneManager {
    constructor(scene, camera, renderer, controls) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.controls = controls; // OrbitControls instance

        this.uiManager = null;  // Will be set by main.js or UIManager
        this.activeColorSpace = null; // Will hold the current ColorSpace instance (e.g., RGBColorSpace)
        this.currentModelType = ''; // To keep track of the current color model string ('RGB', 'CMY', etc.)
        this.showEdges = true; // Persists across model switches

        console.log('SceneManager initialized');
    }

    // Method to be called from main.js or UIManager to link UIManager
    setUIManager(uiManager) {
        this.uiManager = uiManager;
        console.log('SceneManager UIManager dependency set.');
    }

    setColorModel(modelType) {
        console.log(`SceneManager: Setting model to ${modelType}`);
        if (this.currentModelType === modelType && this.activeColorSpace) {
            console.log(`Model ${modelType} is already active.`);
            // Optionally, force a redisplay if needed, or just ensure UI is synced
            // this.activeColorSpace.display(this.uiManager.getCurrentLimits()); 
            return;
        }

        // Dispose of the old color space visuals if one exists
        if (this.activeColorSpace) {
            this.activeColorSpace.dispose();
            this.activeColorSpace = null;
        }

        this.currentModelType = modelType;

        // Step 1: Tell UIManager to update its internal state for the new model and reset its sliders
        if (this.uiManager && typeof this.uiManager.setCurrentModelAndResetLimits === 'function') {
            this.uiManager.setCurrentModelAndResetLimits(modelType);
        } else {
            console.error('UIManager or setCurrentModelAndResetLimits method is not available.');
            return; // Critical error, cannot proceed
        }

        // Step 2: Now that UIManager has updated its state and reset its limits, get those new default limits
        const initialLimits = this.uiManager.getCurrentLimits();

        switch (modelType) {
            case 'RGB':
                this.activeColorSpace = new RGBColorSpace(this.scene);
                break;
            case 'CMY':
                this.activeColorSpace = new CMYColorSpace(this.scene);
                break;
            case 'HSV':
                this.activeColorSpace = new HSVColorSpace(this.scene);
                break;
            case 'HSL':
                this.activeColorSpace = new HSLColorSpace(this.scene);
                break;
            default:
                console.error(`Unsupported color model type: ${modelType}`);
                return;
        }

        if (this.activeColorSpace) {
            console.log(`SceneManager: Created new ${this.activeColorSpace.constructor.name}`);
            this.activeColorSpace.showEdges = this.showEdges;
            this.activeColorSpace.display(initialLimits);
            // UIManager should have already been updated by its own model change handler
            // to show correct sliders and values. Now, ensure camera is adjusted.
            this.fitCameraToCurrentSpace(); 
        } else {
            console.error(`Failed to create color space for model: ${modelType}`);
        }
    }

    setEdgesVisible(visible) {
        this.showEdges = visible;
        if (this.activeColorSpace) {
            this.activeColorSpace.setEdgesVisible(visible);
        }
    }

    updateColorSubspace(limits) {
        // This method is called when sliders change values
        console.log(`SceneManager: Updating color subspace for ${this.currentModelType} with limits:`, limits);
        if (this.activeColorSpace) {
            this.activeColorSpace.refreshSubSpaceVolume(limits);
            // Update orbit controls target to keep focus on the center of the color model
            this.updateOrbitControlsTarget();
        } else {
            console.error('No active ColorSpace to update subspace volume.');
        }
    }

    // Method to update orbit controls target to the center of the current color model
    updateOrbitControlsTarget() {
        if (this.activeColorSpace && this.controls) {
            // For HSV and HSL models, we want to target the vertical middle (y=0.5)
            // instead of using the geometric center from the bounding box
            if (this.currentModelType === 'HSV' || this.currentModelType === 'HSL') {
                // Set target at the middle of the vertical axis (y=0.5)
                const center = new THREE.Vector3(0, 0.5, 0);
                this.controls.target.copy(center);
                this.controls.update();
                console.log(`SceneManager: Orbit controls target set to middle of ${this.currentModelType} model:`, center);
            } else {
                // For RGB and CMY models, use the bounding box center as before
                const boundingBox = this.activeColorSpace.getCurrentSpaceBoundingBox();
                if (boundingBox) {
                    const center = new THREE.Vector3();
                    boundingBox.getCenter(center);
                    this.controls.target.copy(center);
                    this.controls.update();
                    console.log('SceneManager: Orbit controls target updated to color model center:', center);
                }
            }
        }
    }

    fitCameraToCurrentSpace() {
        console.log('SceneManager: Adjusting camera to fit current space');
        if (this.activeColorSpace) {
            const boundingBox = this.activeColorSpace.getCurrentSpaceBoundingBox();
            if (boundingBox) {
                // For HSV and HSL models, set the target at the middle (y=0.5)
                // instead of using the bounding box center
                let center;
                if (this.currentModelType === 'HSV' || this.currentModelType === 'HSL') {
                    center = new THREE.Vector3(0, 0.5, 0);
                } else {
                    // For RGB and CMY models, use the bounding box center
                    center = new THREE.Vector3();
                    boundingBox.getCenter(center);
                }
                
                // Update the orbit controls target
                this.controls.target.copy(center);

                const size = new THREE.Vector3();
                boundingBox.getSize(size);

                // Handle cases where the bounding box might be empty or invalid
                if (size.x === 0 && size.y === 0 && size.z === 0) {
                    console.warn('Bounding box is empty. Cannot fit camera.');
                    // Set a default view
                    this.controls.target.copy(new THREE.Vector3(0.5, 0.5, 0.5)); // Default center
                    this.camera.position.set(2, 2, 2); // Default position
                    this.camera.lookAt(this.controls.target);
                    this.controls.update();
                    return;
                }

                const maxDim = Math.max(size.x, size.y, size.z);
                const fov = this.camera.fov * (Math.PI / 180);
                let distance = Math.abs(maxDim / 2 / Math.tan(fov / 2));
                
                distance *= 2.5; // Padding factor

                const offsetDirection = new THREE.Vector3(1, 1, 1).normalize();
                this.camera.position.copy(center).addScaledVector(offsetDirection, distance);
                this.controls.target.copy(center);
                this.controls.update();
                this.camera.lookAt(center);
                this.camera.updateProjectionMatrix();
                console.log('SceneManager: Camera adjusted.');
            } else {
                console.error('Could not get bounding box from active ColorSpace.');
            }
        } else {
            console.error('No active ColorSpace for fitCameraToCurrentSpace.');
        }
    }

    animate() {
        // For now, it's empty as OrbitControls.update() is in main.js's animate loop.
    }
}

