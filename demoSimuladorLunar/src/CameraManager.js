import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Maneja una única PerspectiveCamera y alterna entre tres modos cíclicamente
 * con la tecla C:
 *   0) Orbital  — controlada con el mouse vía OrbitControls.
 *   1) Rover    — cámara fija detrás del Rover (sigue su orientación).
 *   2) Lander   — cámara fija detrás de la nave (solo posición, sin rotar).
 */
export class CameraManager {
    constructor(renderer, scene, { rover, lander } = {}) {
        this.rover = rover;
        this.lander = lander;
        this.modes = ['orbital', 'rover', 'lander'];
        this.modeIndex = 0;

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
        this.camera.position.set(30, 30, 30);

        this.controls = new OrbitControls(this.camera, renderer.domElement);
        this.controls.target.set(0, 2, 0);
        this.controls.update();

        this.roverOffset = new THREE.Vector3(0, 3, 8);   // detrás (+Z local) y arriba
        this.landerOffset = new THREE.Vector3(0, 4, 10); // mundo: atrás y arriba

        window.addEventListener('keydown', (e) => {
            if (e.key === 'c' || e.key === 'C') this._cycleMode();
        });

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        });
    }

    _cycleMode() {
        this.modeIndex = (this.modeIndex + 1) % this.modes.length;
        this.controls.enabled = (this.modes[this.modeIndex] === 'orbital');
    }

    update() {
        const mode = this.modes[this.modeIndex];
        if (mode === 'orbital') {
            this.controls.update();
        } else if (mode === 'rover' && this.rover?.chassis) {
            const target = this.rover.chassis;
            const worldOffset = this.roverOffset.clone().applyQuaternion(target.quaternion);
            this.camera.position.copy(target.position).add(worldOffset);
            this.camera.lookAt(target.position);
        } else if (mode === 'lander' && this.lander?.root) {
            const target = this.lander.root;
            this.camera.position.copy(target.position).add(this.landerOffset);
            this.camera.lookAt(target.position);
        }
    }
}
