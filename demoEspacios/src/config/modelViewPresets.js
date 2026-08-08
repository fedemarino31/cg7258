// Cámara del panel derecho cuando está activa la etapa MODEL.
// Las coordenadas están expresadas en el espacio local de cada modelo.
// `position` ubica la cámara y `target` indica el punto hacia el que mira.
export const MODEL_VIEW_PRESETS = {
	Terreno: {
		position: [8.5, 6.5, 8.5],
		target: [0, 0, 0],
		near: 0.01,
		far: 100,
	},
	Casa: {
		position: [3.4, 2.7, 4.1],
		target: [0, 0, 0],
		near: 0.01,
		far: 40,
	},
	Techo: {
		position: [3.2, 2.5, 3.8],
		target: [0, 0, 0],
		near: 0.01,
		far: 40,
	},
	Puerta: {
		position: [1.7, 1.4, 2.2],
		target: [0, 0, 0],
		near: 0.01,
		far: 25,
	},
	Tronco: {
		position: [2.4, 2.0, 3.0],
		target: [0, 0, 0],
		near: 0.01,
		far: 30,
	},
	Copa: {
		position: [3.2, 2.7, 3.8],
		target: [0, 0, 0],
		near: 0.01,
		far: 40,
	},
	Esfera: {
		position: [2.5, 2.0, 3.0],
		target: [0, 0, 0],
		near: 0.01,
		far: 30,
	},
	'Cono rosa': {
		position: [3.0, 2.2, 3.5],
		target: [0, 0, 0],
		near: 0.01,
		far: 35,
	},
};

export const DEFAULT_MODEL_VIEW_PRESET = {
	position: [3, 2.3, 3.5],
	target: [0, 0, 0],
	near: 0.01,
	far: 40,
};
