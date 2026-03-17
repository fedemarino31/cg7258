// src/UIManager.js
import { Pane } from 'tweakpane';
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';
import * as constants from './constants.js';

// Valores por defecto para cada modelo (internos, antes de normalización)
const MODEL_DEFAULTS = {
	RGB: { r: { min: 0, max: 1 }, g: { min: 0, max: 1 }, b: { min: 0, max: 1 } },
	CMY: { c: { min: 0, max: 1 }, m: { min: 0, max: 1 }, y: { min: 0, max: 1 } },
	HSV: { h: { min: 0, max: 360 }, s: { min: 0, max: 1 }, v: { min: 0, max: 1 } },
	HSL: { h: { min: 0, max: 360 }, s: { min: 0, max: 1 }, l: { min: 0, max: 1 } },
};

// Rangos permitidos para el slider de cada componente: [min, max, step]
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

		// Estado de límites: objetos {min, max} anidados por modelo y componente
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

		this.initUI();
	}

	initUI() {
		this.pane = new Pane({ title: 'Controles' });
		this.pane.registerPlugin(EssentialsPlugin);

		this._setupModelSelector();
		this._setupLimitsControls();
		this._setupCommandButtons();
		this._updateModelFolderVisibility();

		console.log('UIManager UI initialized');
	}

	_setupModelSelector() {
		this.pane
			.addBinding(this._modelParams, 'model', {
				label: 'Modelo de Color',
				options: { RGB: 'RGB', CMY: 'CMY', HSV: 'HSV', HSL: 'HSL' },
			})
			.on('change', (ev) => {
				this.sceneManager.setColorModel(ev.value);
			});
	}

	_setupLimitsControls() {
		const limitsFolder = this.pane.addFolder({ title: 'Límites' });

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
		const commandsFolder = this.pane.addFolder({ title: 'Comandos' });

		commandsFolder.addButton({ title: 'Reset Límites' }).on('click', () => this.resetCurrentLimits());
		commandsFolder
			.addButton({ title: 'Ajustar Vista' })
			.on('click', () => this.sceneManager.fitCameraToCurrentSpace());

		const edgesParams = { showEdges: this.showEdges };
		commandsFolder
			.addBinding(edgesParams, 'showEdges', { label: 'Mostrar Bordes' })
			.on('change', (ev) => {
				this.showEdges = ev.value;
				this.sceneManager.setEdgesVisible(ev.value);
			});
		this._edgesParams = edgesParams;
	}

	_updateModelFolderVisibility() {
		for (const model of ['RGB', 'CMY', 'HSV', 'HSL']) {
			this.modelFolders[model].hidden = model !== this.currentModel;
		}
	}

	// Llamado por SceneManager al cambiar de modelo
	setCurrentModelAndResetLimits(modelType) {
		console.log(`UIManager: Setting current model to ${modelType} and resetting limits.`);
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
		// Retorna estructura { componente: { min, max } } normalizada para shaders.
		// H en HSV/HSL se normaliza de [0,360] a [0,1].
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
