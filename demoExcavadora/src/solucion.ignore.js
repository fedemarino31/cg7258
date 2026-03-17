import * as THREE from 'three';

function armarRueda(cubierta, llanta, tuerca) {
	let rueda = new THREE.Group();
	rueda.add(cubierta);
	cubierta.position.set(0, 0, 0);
	rueda.add(llanta);
	llanta.position.set(0, 0, 0);
	for (let i = 0; i < Math.PI * 2; i += Math.PI / 4) {
		let t = tuerca.clone();

		let x = Math.cos(i) * 7;
		let y = Math.sin(i) * 7;
		t.position.set(x, y, 3);
		rueda.add(t);
	}
	return rueda;
}

export function armarSolucion(partes) {
	partes.chasis.position.set(0, 0, 0);

	partes.chasis.add(partes.cabina);
	partes.cabina.position.set(0, 25, 0);

	partes.cabina.add(partes.brazo);
	partes.brazo.position.set(20, 20, -10);
	partes.brazo.rotation.y = 0;

	partes.brazo.add(partes.antebrazo);
	partes.antebrazo.position.set(-102, 0, 0);
	partes.antebrazo.rotation.y = 0;

	partes.antebrazo.add(partes.pala);
	partes.pala.rotation.y = 0;
	partes.pala.position.set(-60, 0, 0);

	let rueda1 = armarRueda(partes.cubierta.clone(), partes.llanta.clone(), partes.tuerca.clone());
	rueda1.position.set(0, 0, -27);
	rueda1.rotation.y = Math.PI;
	partes.eje.add(rueda1);

	let rueda2 = rueda1.clone();
	rueda2.position.set(0, 0, 27);
	rueda2.rotation.y = Math.PI;
	partes.eje.add(rueda2);

	partes.eje.position.set(20, 5, 0);
	partes.chasis.add(partes.eje);

	let eje2 = partes.eje.clone();
	eje2.position.set(-20, 5, 0);
	partes.chasis.add(eje2);

	partes.cubierta.visible = false;
	partes.llanta.visible = false;
	partes.tuerca.visible = false;

	partes.vehiculo.add(partes.cabina);
	partes.vehiculo.add(partes.chasis);
}
