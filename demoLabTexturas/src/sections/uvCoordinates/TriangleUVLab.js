import * as THREE from 'three';
import { TriangleBase, DEFAULT_POS } from './TriangleBase.js';

const DEFAULT_UV = [
	[0, 0],
	[1, 0],
	[0.5, 1],
];

export class TriangleUVLab extends TriangleBase {
	static help = [
		'Arrastrá las esferas A, B, C en la escena 3D: cambia la forma del triángulo, pero sus UV no se tocan.',
		'Arrastrá A′, B′, C′ en el espacio UV (incluso fuera de [0,1]): la geometría 3D queda quieta y la textura sobre el triángulo cambia.',
		'Fuera de [0,1] se ve el efecto del wrapping elegido (Clamp / Repeat / Mirrored Repeat).',
		'Rueda: zoom en el espacio UV. Botón derecho: paneo.',
	];

	constructor(layout) {
		super(layout, {
			defaultUV: DEFAULT_UV,
			uvExtent: 2.6,
			texSize: 256,
			vertexDrag3D: true,
			tag3d: 'Arrastrar vértices: mover · fondo: orbitar',
			idea: 'Cada vértice almacena una posición 3D y una coordenada UV. Modificar un atributo no modifica automáticamente el otro.',
		});
		this.start();
	}

	buildControlsBody(p) {
		this.commonSelectors(p, { wrap: true });
		p.title('Visualización');
		p.checkbox('showXYZ', 'Mostrar posiciones XYZ');
		p.checkbox('showUV', 'Mostrar coordenadas UV');
		p.checkbox('wire', 'Mostrar wireframe');
		p.buttons({
			label: 'UV predeterminados',
			onClick: () => {
				this.uv = DEFAULT_UV.map((u) => [...u]);
				this.updateGeometry();
			},
		});
		p.buttons({
			label: 'Triángulo predeterminado',
			onClick: () => {
				this.pos = DEFAULT_POS.map((q) => new THREE.Vector3(...q));
				this.updateGeometry();
			},
		});
	}
}
