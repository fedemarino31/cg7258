import * as THREE from 'three';

/**
 * Wrapper visual del Rover (vehículo lunar).
 *
 * La parte FÍSICA del vehículo (chasis dinámico + VehicleController + ruedas
 * con suspensión) la maneja PhysicsSimulator. Esta clase solo se ocupa de:
 *   - construir los meshes de Three.js (chasis + 4 ruedas + faro frontal),
 *   - sincronizar cada frame su transform con el estado físico del simulador.
 *
 * El Rover se controla con W A S D (acelerar / dirección), Espacio (freno) y
 * R (reset). Esos eventos los registra PhysicsSimulator.setupEventListeners.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  CÓMO REEMPLAZAR LA GEOMETRÍA POR UN MODELO EXTERNO (GLTF / OBJ / FBX ...)
 * ═══════════════════════════════════════════════════════════════════════════
 * El Rover tiene DOS puntos de reemplazo independientes porque sus partes se
 * mueven por separado:
 *   (1) el CHASIS (un solo Object3D, puede contener un sub-árbol)
 *   (2) las 4 RUEDAS (cada una un Object3D independiente, posicionada por
 *       el físico una por una)
 *
 * Las dos formas soportadas son:
 *
 *  A) Por constructor, pasando `chassisMesh` y/o `wheelMeshes` en options.
 *  B) En tiempo de ejecución, con `rover.setChassisMesh(obj)` y
 *     `rover.setWheelMesh(index, obj)`.
 *
 * Ejemplo con GLTFLoader (async, típicamente desde LunarSimulator):
 *
 *     import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
 *     const loader = new GLTFLoader();
 *     const [chassisGltf, wheelGltf] = await Promise.all([
 *         loader.loadAsync('assets/rover_chassis.glb'),
 *         loader.loadAsync('assets/rover_wheel.glb'),
 *     ]);
 *     const rover = new Rover(scene, physics, {
 *         chassisMesh: chassisGltf.scene,
 *         wheelMeshes: [0, 1, 2, 3].map(() => wheelGltf.scene.clone(true)),
 *     });
 *
 * Restricciones de los modelos externos:
 *   - Chasis: debe estar centrado en su origen local (ese origen coincide
 *     con el centro del RigidBody). El "frente" del rover es -Z (hacia donde
 *     apunta el faro); orientar el modelo en consecuencia.
 *   - Rueda: su eje de giro DEBE estar alineado con el eje X local (es el
 *     axle que declara PhysicsSimulator.addWheels). Si el modelo viene con
 *     el eje en Y (lo más común en assets), pre-rotarlo:
 *         wheelGltf.scene.rotateZ(Math.PI * 0.5)
 *   - El transform inicial (posición/rotación) de cada Object3D se sobreescribe
 *     cada frame desde el físico, así que es irrelevante.
 */
export class Rover {
    constructor(scene, physicsSimulator, {
        color = 0xff0000,
        wheelRadius = 0.6,
        wheelWidth = 0.4,
        // ── Hooks de reemplazo de geometría (ver JSDoc de la clase) ──
        chassisMesh = null,     // Object3D para el chasis, o null → box por defecto.
        wheelMeshes = null,     // Array de 4 Object3D para las ruedas, o null → cilindros.
    } = {}) {
        this.scene = scene;
        this.physicsSimulator = physicsSimulator;
        this.wheels = [];

        this._buildChassis(color, chassisMesh);
        this._attachChassisAccessories();
        this._buildWheels(wheelRadius, wheelWidth, wheelMeshes);
    }

    // ─────────────────────────────────────────────────────────────────────
    // PUNTO DE REEMPLAZO 1 — CHASIS
    // Si llega un Object3D por parámetro, se usa tal cual. Si no, se crea
    // la caja roja de la demo. El resultado queda en this.chassis y se
    // agrega a la escena.
    // ─────────────────────────────────────────────────────────────────────
    _buildChassis(color, externalMesh) {
        if (externalMesh) {
            this.chassis = externalMesh;
        } else {
            const chassisGeo = new THREE.BoxGeometry(2, 1, 4);
            const chassisMat = new THREE.MeshPhongMaterial({ color });
            this.chassis = new THREE.Mesh(chassisGeo, chassisMat);
        }
        this.scene.add(this.chassis);
    }

    // Accesorios que deben viajar con el chasis independientemente de qué
    // geometría lo represente (faro frontal + AxesHelper de debug). Se
    // re-adjuntan al chasis nuevo cuando se llama setChassisMesh().
    _attachChassisAccessories() {
        this.chassis.add(new THREE.AxesHelper(5));

        const headlight = new THREE.SpotLight(0xffdd99, 100);
        headlight.decay = 1;
        headlight.penumbra = 0.5;
        headlight.position.set(0, 0, -2);
        headlight.target.position.set(0, 0, -10);
        this.chassis.add(headlight);
        this.chassis.add(headlight.target);
    }

    // ─────────────────────────────────────────────────────────────────────
    // PUNTO DE REEMPLAZO 2 — RUEDAS
    // Si llega un array de 4 Object3D, se usan en ese orden. Si no, se
    // crean cilindros wireframe. El orden de índice es el que usa
    // PhysicsSimulator (ver wheelPositions):
    //     0 = trasera izquierda    1 = trasera derecha
    //     2 = delantera izquierda  3 = delantera derecha
    // ─────────────────────────────────────────────────────────────────────
    _buildWheels(wheelRadius, wheelWidth, externalMeshes) {
        const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 16);
        // Rotamos la geometría por defecto para alinear el eje del cilindro
        // con X (convención del axle en el VehicleController de Rapier).
        // Los modelos externos deben venir ya orientados así (ver JSDoc).
        wheelGeo.rotateZ(Math.PI * 0.5);
        const wheelMat = new THREE.MeshPhongMaterial({ color: 0x000000, wireframe: true });

        for (let i = 0; i < 4; i++) {
            const wheel = externalMeshes?.[i] ?? new THREE.Mesh(wheelGeo, wheelMat);
            this.chassis.add(wheel);
            this.wheels.push(wheel);
        }
    }

    /**
     * Reemplaza el mesh del chasis en tiempo de ejecución por uno cargado
     * externamente (p. ej. la escena devuelta por GLTFLoader.loadAsync).
     * Preserva faro, helper y las 4 ruedas migrándolos al nuevo chasis.
     */
    setChassisMesh(mesh) {
        const accessories = this.chassis.children.filter(c => !this.wheels.includes(c));
        this.scene.remove(this.chassis);
        this.chassis = mesh;
        this.scene.add(this.chassis);
        for (const a of accessories) this.chassis.add(a);
        for (const w of this.wheels) this.chassis.add(w);
    }

    /**
     * Reemplaza la rueda en la posición `index` (0..3) por el Object3D dado.
     * Ver el JSDoc de la clase para los requisitos de orientación del modelo.
     */
    setWheelMesh(index, mesh) {
        const old = this.wheels[index];
        if (old && old.parent) old.parent.remove(old);
        this.wheels[index] = mesh;
        this.chassis.add(mesh);
    }

    /**
     * Copia el transform del cuerpo físico (chasis) y de cada rueda al mesh
     * visual correspondiente. Debe llamarse una vez por frame, después de
     * physicsSimulator.update().
     */
    update() {
        const vt = this.physicsSimulator.getVehicleTransform();
        if (!vt) return;

        this.chassis.position.set(vt.position.x, vt.position.y, vt.position.z);
        this.chassis.quaternion.set(vt.quaternion.x, vt.quaternion.y, vt.quaternion.z, vt.quaternion.w);

        this.wheels.forEach((wheel, i) => {
            const wt = this.physicsSimulator.getWheelTransform(i);
            if (!wt) return;
            wheel.position.set(wt.position.x, wt.position.y, wt.position.z);
            wheel.quaternion.set(wt.quaternion.x, wt.quaternion.y, wt.quaternion.z, wt.quaternion.w);
        });
    }
}
