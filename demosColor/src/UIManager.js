// src/UIManager.js
import { Pane } from 'tweakpane';
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';
import * as constants from './constants.js';

const MODEL_DEFAULTS = {
	RGB: { r: { min: 0, max: 1 }, g: { min: 0, max: 1 }, b: { min: 0, max: 1 } },
	CMY: { c: { min: 0, max: 1 }, m: { min: 0, max: 1 }, y: { min: 0, max: 1 } },
	HSV: { h: { min: 0, max: 360 }, s: { min: 0, max: 1 }, v: { min: 0, max: 1 } },
	HSL: { h: { min: 0, max: 360 }, s: { min: 0, max: 1 }, l: { min: 0, max: 1 } },
};

const RADIUS_MIN = 0.001;
const RADIUS_MAX = 0.02;

const MODEL_RANGES = {
	RGB: { r: [0, 1, 0.01], g: [0, 1, 0.01], b: [0, 1, 0.01] },
	CMY: { c: [0, 1, 0.01], m: [0, 1, 0.01], y: [0, 1, 0.01] },
	HSV: { h: [0, 360, 1], s: [0, 1, 0.01], v: [0, 1, 0.01] },
	HSL: { h: [0, 360, 1], s: [0, 1, 0.01], l: [0, 1, 0.01] },
};

export class UIManager {
	constructor(sceneManager) {
		this.sceneManager = sceneManager;
		this.currentModel = constants.initialModel;
		this.showEdges = true;

		this.limits = {};
		for (const model in MODEL_DEFAULTS) {
			this.limits[model] = {};
			for (const comp in MODEL_DEFAULTS[model]) {
				this.limits[model][comp] = { ...MODEL_DEFAULTS[model][comp] };
			}
		}

		this.debounceTimeout = null;
		this.modelFolders = {};
		this._modelParams = { model: this.currentModel };
		this._dotsFolder = null;
		// Real dot radius spans [RADIUS_MIN, RADIUS_MAX]; the UI slider is
		// normalized to [0,1] (dotRadiusNorm) and mapped to the real value.
		this.dotsParams = { dotsPerSide: 40, dotRadius: 0.0055, dotRadiusNorm: 0.5 };

		this.initUI();
	}

	initUI() {
		this.pane = new Pane({ title: 'Controls' });
		this.pane.registerPlugin(EssentialsPlugin);

		// Widen the panel 50% over the default (256px → 384px) and push it well
		// clear of the right viewport edge so the interval-slider number boxes
		// are never clipped against the screen edge.
		// pane.element is the inner .tp-rotv (position: static); the positioned
		// wrapper is its parent .tp-dfwv, so width/right must go on the wrapper.
		const wrapper = this.pane.element.parentElement;
		wrapper.style.width = '25vw';
		wrapper.style.right = '0';
		wrapper.style.top = '0';

		this._setupModelSelector();
		this._setupLimitsControls();
		this._setupCommandButtons();
		this._setupDotsFolder();
		this._updateModelFolderVisibility();
	}

	_setupModelSelector() {
		this.pane
			.addBinding(this._modelParams, 'model', {
				label: 'Color Model',
				options: { RGB: 'RGB', CMY: 'CMY', HSV: 'HSV', HSL: 'HSL' },
			})
			.on('change', (ev) => {
				this.sceneManager.setColorModel(ev.value);
			});
	}

	_setupLimitsControls() {
		const limitsFolder = this.pane.addFolder({ title: 'Limits' });

		for (const model of ['RGB', 'CMY', 'HSV', 'HSL']) {
			const folder = limitsFolder.addFolder({ title: model });
			this.modelFolders[model] = folder;

			const ranges = MODEL_RANGES[model];
			const state = this.limits[model];

			for (const comp of Object.keys(ranges)) {
				const [rangeMin, rangeMax, step] = ranges[comp];
				folder
					.addBinding(state, comp, {
						view: 'intervalSlider',
						min: rangeMin,
						max: rangeMax,
						step,
						label: comp.toUpperCase(),
					})
					.on('change', () => this.notifySubspaceChangeWithDebounce());
			}
		}
	}

	_setupCommandButtons() {
		const commandsFolder = this.pane.addFolder({ title: 'Commands' });

		commandsFolder.addButton({ title: 'Reset Limits' }).on('click', () => this.resetCurrentLimits());
		commandsFolder
			.addButton({ title: 'Fit View' })
			.on('click', () => this.sceneManager.fitCameraToCurrentSpace());

		const edgesParams = { showEdges: this.showEdges };
		commandsFolder
			.addBinding(edgesParams, 'showEdges', { label: 'Show Edges' })
			.on('change', (ev) => {
				this.showEdges = ev.value;
				this.sceneManager.setEdgesVisible(ev.value);
			});
		this._edgesParams = edgesParams;

		const volParams = { showVolume: true };
		commandsFolder
			.addBinding(volParams, 'showVolume', { label: 'Show Volume' })
			.on('change', (ev) => this.sceneManager.setVolumeVisible(ev.value));

		const axesParams = { showAxes: true };
		commandsFolder
			.addBinding(axesParams, 'showAxes', { label: 'Show Axes' })
			.on('change', (ev) => this.sceneManager.setAxesVisible(ev.value));
	}

	_setupDotsFolder() {
		this._dotsFolder = this.pane.addFolder({ title: 'Dots', expanded: true });
		this._dotsFolder.hidden = true;

		this._dotsFolder
			.addBinding(this.dotsParams, 'dotsPerSide', {
				label: 'Dots per side',
				min: 40, max: 100, step: 1,
			})
			.on('change', () => this._notifyDotsParamsChange());

		this._dotsFolder
			.addBinding(this.dotsParams, 'dotRadiusNorm', {
				label: 'Dot radius',
				min: 0, max: 1, step: 0.01,
			})
			.on('change', () => this._notifyDotsParamsChange());
	}

	_notifyDotsParamsChange() {
		// Map the normalized [0,1] radius slider to the real radius range.
		this.dotsParams.dotRadius = RADIUS_MIN + this.dotsParams.dotRadiusNorm * (RADIUS_MAX - RADIUS_MIN);

		clearTimeout(this.debounceTimeout);
		this.debounceTimeout = setTimeout(() => {
			const { dotsPerSide, dotRadius } = this.dotsParams;
			this.sceneManager.updateDotsParams({ dotsPerSide, dotRadius });
		}, 150);
	}

	setDotsControlsVisible(visible) {
		if (this._dotsFolder) this._dotsFolder.hidden = !visible;
	}

	_updateModelFolderVisibility() {
		for (const model of ['RGB', 'CMY', 'HSV', 'HSL']) {
			this.modelFolders[model].hidden = model !== this.currentModel;
		}
	}

	setCurrentModelAndResetLimits(modelType) {
		this.currentModel = modelType;
		this._modelParams.model = modelType;
		this.pane.refresh();
		this.resetLimitsToDefault(modelType);
		this._updateModelFolderVisibility();
		this.notifySubspaceChange();
	}

	resetLimitsToDefault(model) {
		const defaults = MODEL_DEFAULTS[model];
		if (!defaults) return;
		const state = this.limits[model];
		for (const comp in defaults) {
			state[comp].min = defaults[comp].min;
			state[comp].max = defaults[comp].max;
		}
		this.pane.refresh();
	}

	resetCurrentLimits() {
		this.resetLimitsToDefault(this.currentModel);
		this.notifySubspaceChange();
	}

	getCurrentLimits() {
		const state = this.limits[this.currentModel];
		switch (this.currentModel) {
			case 'HSV':
				return {
					h: { min: state.h.min / 360, max: state.h.max / 360 },
					s: { ...state.s },
					v: { ...state.v },
				};
			case 'HSL':
				return {
					h: { min: state.h.min / 360, max: state.h.max / 360 },
					s: { ...state.s },
					l: { ...state.l },
				};
			default: {
				const result = {};
				for (const comp in state) result[comp] = { ...state[comp] };
				return result;
			}
		}
	}

	notifySubspaceChange() {
		const limits = this.getCurrentLimits();
		this.sceneManager.updateColorSubspace(limits);
	}

	notifySubspaceChangeWithDebounce() {
		clearTimeout(this.debounceTimeout);
		this.debounceTimeout = setTimeout(() => this.notifySubspaceChange(), 100);
	}
}
