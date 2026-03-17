import * as THREE from 'three';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';

/** Función que carga archivos .dae y devuelve asincrónicamente los modelos de Three.js
 *
 * @param {string[]} filespaths
 * @param onLoadCallback Función callback que recibe una lista de los modelos de Three.js al terminal con todas las cargas
 */
export function loadModels(filespaths, onLoadCallback) {
	const manager = new THREE.LoadingManager();
	const models = [];

	manager.onProgress = (url, loadedCount, totalCount) => {
		console.info(`Cargados ${loadedCount} de ${totalCount}...`);
	};

	manager.onLoad = () => {
		console.info('Carga completa');
		onLoadCallback(models);
	};

	manager.onError = (url) => {
		console.error(`Error al cargar ${url}`);
	};

	filespaths.forEach((filepath) => {
		const loader = new ColladaLoader(manager);

		loader.load(filepath, (collada) => {
			const splitPath = filepath.split('/');
			const modelName = splitPath[splitPath.length - 1].split('.')[0];
			const model = collada.scene.children[0];
			model.name = modelName;
			models.push(model);
		});
	});
}
