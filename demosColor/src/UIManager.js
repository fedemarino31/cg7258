// src/UIManager.js
import GUI from 'lil-gui';
import * as constants from './constants.js';

export class UIManager {
	constructor(sceneManager) {
		// colorSpace parameter removed
		this.sceneManager = sceneManager;
		// this.colorSpace = colorSpace; // Removed, SceneManager handles active ColorSpace instance
		this.gui = new GUI();
		this.limits = {
			// RGB
			rMin: 0,
			rMax: 1,
			gMin: 0,
			gMax: 1,
			bMin: 0,
			bMax: 1,
			// CMY
			cMin: 0,
			cMax: 1,
			mMin: 0,
			mMax: 1,
			yMin: 0,
			yMax: 1,
			// HSV
			hMin: 0,
			hMax: 360,
			sMin: 0,
			sMax: 1,
			vMin: 0,
			vMax: 1,
			// HSL
			hMinHSL: 0,
			hMaxHSL: 360, // Renamed to avoid conflict with HSV hMin/hMax in the limits object
			sMinHSL: 0,
			sMaxHSL: 1,
			lMin: 0,
			lMax: 1,
		};
		this.currentModel = constants.initialModel; // Default model
		this.showEdges = true;

		this.initUI();
	}

	initUI() {
		// UI elements will be initialized here
		this.rgbFolder = null;
		this.cmyFolder = null;
		this.hsvFolder = null;
		this.hslFolder = null;

		this.setupModelSelector();
		this.setupLimitsControls();
		this.setupCommandButtons();

		this.updateLimitsFolderVisibility(); // Show RGB by default
		console.log('UIManager UI initialized');
	}

	setupModelSelector() {
		const modelOptions = { RGB: 'RGB', CMY: 'CMY', HSV: 'HSV', HSL: 'HSL' };
		this.gui
			.add(this, 'currentModel', modelOptions)
			.name('Modelo de Color')
			.onChange((model) => {
				console.log('UIManager: Model selector changed to:', model);
				// SceneManager will coordinate the rest, including telling UIManager to update its state.
				this.sceneManager.setColorModel(model);
			});
	}

	setupLimitsControls() {
		const limitsFolder = this.gui.addFolder('Límites');

		// RGB Sliders
		this.rgbFolder = limitsFolder.addFolder('RGB');
		this.rgbFolder
			.add(this.limits, 'rMin', 0, 1, 0.01)
			.name('R Min')
			.onChange(() => this.notifySubspaceChangeWithDebounce());
		this.rgbFolder
			.add(this.limits, 'rMax', 0, 1, 0.01)
			.name('R Max')
			.onChange(() => this.notifySubspaceChangeWithDebounce());
		this.rgbFolder
			.add(this.limits, 'gMin', 0, 1, 0.01)
			.name('G Min')
			.onChange(() => this.notifySubspaceChangeWithDebounce());
		this.rgbFolder
			.add(this.limits, 'gMax', 0, 1, 0.01)
			.name('G Max')
			.onChange(() => this.notifySubspaceChangeWithDebounce());
		this.rgbFolder
			.add(this.limits, 'bMin', 0, 1, 0.01)
			.name('B Min')
			.onChange(() => this.notifySubspaceChangeWithDebounce());
		this.rgbFolder
			.add(this.limits, 'bMax', 0, 1, 0.01)
			.name('B Max')
			.onChange(() => this.notifySubspaceChangeWithDebounce());

		// CMY Sliders (initially hidden)
		this.cmyFolder = limitsFolder.addFolder('CMY');
		this.cmyFolder
			.add(this.limits, 'cMin', 0, 1, 0.01)
			.name('C Min')
			.onChange(() => this.notifySubspaceChangeWithDebounce());
		this.cmyFolder
			.add(this.limits, 'cMax', 0, 1, 0.01)
			.name('C Max')
			.onChange(() => this.notifySubspaceChangeWithDebounce());
		this.cmyFolder
			.add(this.limits, 'mMin', 0, 1, 0.01)
			.name('M Min')
			.onChange(() => this.notifySubspaceChangeWithDebounce());
		this.cmyFolder
			.add(this.limits, 'mMax', 0, 1, 0.01)
			.name('M Max')
			.onChange(() => this.notifySubspaceChangeWithDebounce());
		this.cmyFolder
			.add(this.limits, 'yMin', 0, 1, 0.01)
			.name('Y Min')
			.onChange(() => this.notifySubspaceChangeWithDebounce());
		this.cmyFolder
			.add(this.limits, 'yMax', 0, 1, 0.01)
			.name('Y Max')
			.onChange(() => this.notifySubspaceChangeWithDebounce());

		// HSV Sliders (initially hidden)
		this.hsvFolder = limitsFolder.addFolder('HSV');
		this.hsvFolder
			.add(this.limits, 'hMin', 0, 360, 1)
			.name('H Min')
			.onChange(() => this.notifySubspaceChangeWithDebounce());
		this.hsvFolder
			.add(this.limits, 'hMax', 0, 360, 1)
			.name('H Max')
			.onChange(() => this.notifySubspaceChangeWithDebounce());
		this.hsvFolder
			.add(this.limits, 'sMin', 0, 1, 0.01)
			.name('S Min')
			.onChange(() => this.notifySubspaceChangeWithDebounce());
		this.hsvFolder
			.add(this.limits, 'sMax', 0, 1, 0.01)
			.name('S Max')
			.onChange(() => this.notifySubspaceChangeWithDebounce());
		this.hsvFolder
			.add(this.limits, 'vMin', 0, 1, 0.01)
			.name('V Min')
			.onChange(() => this.notifySubspaceChangeWithDebounce());
		this.hsvFolder
			.add(this.limits, 'vMax', 0, 1, 0.01)
			.name('V Max')
			.onChange(() => this.notifySubspaceChangeWithDebounce());

		// HSL Sliders (initially hidden)
		this.hslFolder = limitsFolder.addFolder('HSL');
		this.hslFolder
			.add(this.limits, 'hMinHSL', 0, 360, 1)
			.name('H Min')
			.onChange(() => this.notifySubspaceChangeWithDebounce());
		this.hslFolder
			.add(this.limits, 'hMaxHSL', 0, 360, 1)
			.name('H Max')
			.onChange(() => this.notifySubspaceChangeWithDebounce());
		this.hslFolder
			.add(this.limits, 'sMinHSL', 0, 1, 0.01)
			.name('S Min')
			.onChange(() => this.notifySubspaceChangeWithDebounce());
		this.hslFolder
			.add(this.limits, 'sMaxHSL', 0, 1, 0.01)
			.name('S Max')
			.onChange(() => this.notifySubspaceChangeWithDebounce());
		this.hslFolder
			.add(this.limits, 'lMin', 0, 1, 0.01)
			.name('L Min')
			.onChange(() => this.notifySubspaceChangeWithDebounce());
		this.hslFolder
			.add(this.limits, 'lMax', 0, 1, 0.01)
			.name('L Max')
			.onChange(() => this.notifySubspaceChangeWithDebounce());
	}

	updateLimitsFolderVisibility() {
		this.rgbFolder.domElement.style.display = this.currentModel === 'RGB' ? '' : 'none';
		this.cmyFolder.domElement.style.display = this.currentModel === 'CMY' ? '' : 'none';
		this.hsvFolder.domElement.style.display = this.currentModel === 'HSV' ? '' : 'none';
		this.hslFolder.domElement.style.display = this.currentModel === 'HSL' ? '' : 'none';
	}

	setupCommandButtons() {
		const commandsFolder = this.gui.addFolder('Comandos');
		commandsFolder.add(this, 'resetCurrentLimits').name('Reset Límites');
		commandsFolder.add(this.sceneManager, 'fitCameraToCurrentSpace').name('Ajustar Vista');
		commandsFolder
			.add(this, 'showEdges')
			.name('Mostrar Bordes')
			.onChange((value) => this.sceneManager.setEdgesVisible(value));
	}

	resetLimitsToDefault(model) {
		const defaults = {
			RGB: { rMin: 0, rMax: 1, gMin: 0, gMax: 1, bMin: 0, bMax: 1 },
			CMY: { cMin: 0, cMax: 1, mMin: 0, mMax: 1, yMin: 0, yMax: 1 },
			HSV: { hMin: 0, hMax: 360, sMin: 0, sMax: 1, vMin: 0, vMax: 1 },
			HSL: { hMinHSL: 0, hMaxHSL: 360, sMinHSL: 0, sMaxHSL: 1, lMin: 0, lMax: 1 },
		};
		if (defaults[model]) {
			for (const key in defaults[model]) {
				this.limits[key] = defaults[model][key];
			}
		}
		// Refresh GUI to show new values
		this.gui.controllersRecursive().forEach((controller) => controller.updateDisplay());
	}

	resetCurrentLimits() {
		this.resetLimitsToDefault(this.currentModel);
		this.notifySubspaceChange(); // Update visuals after reset
	}

	getCurrentLimits() {
		// Returns an object with the nested structure { component: { min: value, max: value } }
		// Also normalizes Hue for HSL/HSV to [0, 1] for shader compatibility.
		let currentLimits = {};
		switch (this.currentModel) {
			case 'RGB':
				currentLimits = {
					r: { min: this.limits.rMin, max: this.limits.rMax },
					g: { min: this.limits.gMin, max: this.limits.gMax },
					b: { min: this.limits.bMin, max: this.limits.bMax },
				};
				break;
			case 'CMY':
				currentLimits = {
					c: { min: this.limits.cMin, max: this.limits.cMax },
					m: { min: this.limits.mMin, max: this.limits.mMax },
					y: { min: this.limits.yMin, max: this.limits.yMax },
				};
				break;
			case 'HSV': // Assuming HSV also needs H normalized and nested structure
				currentLimits = {
					h: { min: this.limits.hMin / 360, max: this.limits.hMax / 360 },
					s: { min: this.limits.sMin, max: this.limits.sMax },
					v: { min: this.limits.vMin, max: this.limits.vMax },
				};
				break;
			case 'HSL':
				currentLimits = {
					h: { min: this.limits.hMinHSL / 360, max: this.limits.hMaxHSL / 360 },
					s: { min: this.limits.sMinHSL, max: this.limits.sMaxHSL },
					l: { min: this.limits.lMin, max: this.limits.lMax },
				};
				break;
			default:
				console.error(`UIManager: Unknown model type ${this.currentModel} in getCurrentLimits`);
				// Return a default safe structure or throw error
				currentLimits = { r: { min: 0, max: 1 }, g: { min: 0, max: 1 }, b: { min: 0, max: 1 } };
		}
		return currentLimits;
	}

	notifySubspaceChange() {
		const limits = this.getCurrentLimits();
		this.sceneManager.updateColorSubspace(limits);
		// The line below was removed.
		// sceneManager.updateColorSubspace now calls refreshSubSpaceVolume on the active ColorSpace instance.
		// If the model changed, sceneManager.setModel would have already called display() on the new space.
		// this.colorSpace.displaySpace(this.currentModel, limits);
	}

	// Debounce implementation
	debounceTimeout = null;
	setCurrentModelAndResetLimits(modelType) {
		console.log(`UIManager: Setting current model to ${modelType} and resetting limits.`);
		this.currentModel = modelType; // Ensure this.currentModel is updated before getCurrentLimits is called indirectly
		this.resetLimitsToDefault(modelType);
		this.updateLimitsFolderVisibility();
		// Notify that the subspace should be updated with these new default limits
		this.notifySubspaceChange();
	}

	notifySubspaceChangeWithDebounce() {
		clearTimeout(this.debounceTimeout);
		this.debounceTimeout = setTimeout(() => {
			this.notifySubspaceChange();
		}, 100); // 500ms debounce
	}
}
