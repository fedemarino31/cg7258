import { Pane } from 'tweakpane';

function bind(folder, state, key, label, onChange, options = {}) {
	return folder.addBinding(state, key, { label, ...options }).on('change', () => onChange(key));
}

export function createUI(state, { onChange, onCamera, onResetLight }) {
	const pane = new Pane({
		title: 'NORMALES · FLAT / SMOOTH',
		expanded: true,
		container: document.getElementById('controls-panel'),
	});

	const geometry = pane.addFolder({ title: 'GEOMETRÍA' });
	bind(geometry, state, 'angle', 'Ángulo A/B', onChange, { min: 0, max: 100, step: 1 });
	bind(geometry, state, 'showTriangles', 'Diferenciar triángulos', onChange);
	bind(geometry, state, 'showEdges', 'Mostrar aristas', onChange);
	bind(geometry, state, 'showLabels', 'Mostrar etiquetas', onChange);

	const material = pane.addFolder({ title: 'MATERIAL PHONG' });
	bind(material, state, 'lighting', 'Iluminación', onChange);
	bind(material, state, 'solidSurface', 'Superficie sólida', onChange);
	bind(material, state, 'unifyMaterials', 'Unificar materiales A/B', onChange);
	bind(material, state, 'diffuseColor', 'Color difuso', onChange, { view: 'color' });
	bind(material, state, 'glossiness', 'Glossiness', onChange, { min: 1, max: 256, step: 1 });
	bind(material, state, 'wireframe', 'Wireframe', onChange);

	const light = pane.addFolder({ title: 'LUZ OMNIDIRECCIONAL' });
	bind(light, state, 'pointLightIntensity', 'Intensidad', onChange, { min: 0, max: 80, step: 1 });
	bind(light, state, 'showLightControl', 'Transform control', onChange);
	light.addButton({ title: 'Centrar sobre la superficie', label: 'Posición' }).on('click', onResetLight);

	const normals = pane.addFolder({ title: 'NORMALES' });
	bind(normals, state, 'showVertexNormals', 'Normales de vértices', onChange);
	bind(normals, state, 'showFaceNormals', 'De cara (calculadas)', onChange);
	bind(normals, state, 'showInterpolatedNormals', 'Normales interpoladas', onChange);

	const inspection = pane.addFolder({ title: 'INSPECCIÓN', expanded: false });
	bind(inspection, state, 'inspectionMode', 'Modo interactivo', onChange);
	bind(inspection, state, 'showSelectedPoint', 'Punto seleccionado', onChange);
	bind(inspection, state, 'showSelectedNormal', 'Normal seleccionada', onChange);
	bind(inspection, state, 'showCalculation', 'Mostrar cálculo', onChange);

	const sampling = pane.addFolder({ title: 'MUESTREO', expanded: false });
	bind(sampling, state, 'showSamplingLine', 'Línea de muestreo', onChange);
	bind(sampling, state, 'showSamplingNormals', 'Normales de muestreo', onChange);
	bind(sampling, state, 'samplingPosition', 'Posición', onChange, { min: 0, max: 1, step: 0.01 });
	bind(sampling, state, 'sampleCount', 'Muestras', onChange, { min: 4, max: 48, step: 1 });

	const display = pane.addFolder({ title: 'VISUALIZACIÓN', expanded: false });
	bind(display, state, 'showLegend', 'Mostrar leyenda', onChange);

	const camera = pane.addFolder({ title: 'CÁMARA', expanded: false });
	for (const [title, view] of [
		['Vista 3D', 'threeD'],
		['Vista lateral', 'side'],
		['Vista superior', 'top'],
		['Reset', 'reset'],
	]) {
		camera.addButton({ title }).on('click', () => onCamera(view));
	}

	return pane;
}
