import { RapierPhysics } from 'three/addons/physics/RapierPhysics.js';
import { RapierHelper } from 'three/addons/helpers/RapierHelper.js';
import * as THREE from 'three';


// Parámetros por defecto del vehículo. Se pueden sobreescribir pasando un
// objeto parcial al constructor de PhysicsSimulator (Object.assign los mezcla).
export const defaultVehicleParams = {
    wheelSeparation: 2.5,                     // separación lateral entre ruedas (eje X, en metros)
    axesSeparation: 3,                        // distancia entre eje delantero y trasero (eje Z, en metros)
    wheelRadius: 0.6,                         // radio de cada rueda (afecta el raycast de suspensión)
    wheelWidth: 0.4,                          // ancho visual de la rueda (no influye en la física)
    suspensionRestLength: 0.8,                // longitud del resorte de suspensión en reposo
    initialPosition:new THREE.Vector3(0,2,0), // posición inicial del chasis al crear/reiniciar el vehículo
    initialYRotation:0,                       // rotación inicial alrededor del eje Y (en radianes)
    steeringReaction:0.1,                     // qué tan rápido reacciona la dirección al input (0..1, interp. lineal)
    maxSteeringAngle: Math.PI / 16,           // ángulo máximo de giro de las ruedas delanteras (radianes)
    mass:10,                                  // masa del chasis (kg); influye en inercia y en la fuerza motriz efectiva
    // Parámetros de suspensión y agarre (tunables para cambiar el "feel" del vehículo)
    suspensionStiffness: 24.0,   // rigidez del resorte (N/m). Más alto => menos hundimiento.
    suspensionCompression: 0.8,  // amortiguación al comprimirse (mayor => menos rebote al caer).
    suspensionRelaxation: 0.9,   // amortiguación al extenderse (mayor => menos oscilación al levantar).
    maxSuspensionTravel: 0.5,    // recorrido máximo del resorte (m). Limita cuánto se hunde/extiende.
    frictionSlip: 1000.0,        // agarre rueda-suelo. Valores muy altos pueden hacer volcar al chasis.
    // Rango y ritmo de acumulación de la fuerza motriz. min < 0 permite marcha
    // atrás; `step` se suma/resta por frame mientras se mantiene presionado W/S.
    accelerateForce:{
        min:-15,  // fuerza mínima (negativa = reversa)
        max:40,   // fuerza máxima hacia adelante
        step:2,   // incremento por frame al mantener la tecla
    },
    // Freno: se acumula gradualmente mientras se presiona espacio, hasta `max`.
    brakeForce:{
        min:0,
        max:1,
        step:0.05,
    },
}

// Parámetros del piso por defecto (un simple BoxGeometry). Sólo se usa si
// `options.skipGround` es falso en el constructor.
export const defaultGroundParams = {
    width: 1000,   // tamaño en X
    height: 1,     // espesor en Y (grueso para evitar que objetos lo atraviesen)
    length:1000,   // tamaño en Z
}

/**
 * Encapsula el mundo de física Rapier, el controlador de vehículo (chasis +
 * ruedas por raycast) y el input del teclado. Expone métodos para consultar la
 * transformación del chasis y de cada rueda, de modo que la capa visual
 * (Three.js) pueda sincronizar sus meshes sin conocer detalles de Rapier.
 */
export class PhysicsSimulator {

    // Parámetros mezclados (defaults + overrides) del vehículo y del piso.
    params={}

    // Flag que indica si initSimulation() ya terminó. update() y otros métodos
    // lo consultan para evitar usar referencias nulas en los primeros frames.
    initComplete=false;
    physics = null;              // wrapper de Rapier (world + helpers)
    vehicleController = null;    // controlador de vehículo de Rapier
    chassis = null;              // RigidBody dinámico del chasis
    wheels = [];                 // (reservado) lista de meshes visuales de ruedas
    wheelPositions = [];         // offsets locales (al chasis) de cada rueda

    // Estado actual del input del jugador + fuerzas acumuladas. `forward` y
    // `right` son -1/0/1; `brake` es 0/1; `reset` pone al vehículo en la pose
    // inicial. Las fuerzas (`accelerateForce`, `brakeForce`) se integran en
    // updateCarControl() para suavizar la aceleración y el frenado.
    vehicleState = {
        forward: 0,
        right: 0,
        brake: 0,
        reset: false,
        accelerateForce:0,
        brakeForce: 0,
    };

    constructor(vehicleParams={},groundParams={},options={}) {
        // Mezcla de parámetros por defecto con los overrides del llamador.
        // Nota: Object.assign muta el primer argumento; si dos instancias se
        // crean con distintos overrides, la segunda ve la config de la primera.
        this.params.vehicle = Object.assign(defaultVehicleParams, vehicleParams);
        this.params.ground = Object.assign(defaultGroundParams, groundParams);
        this.options = options;

        const wheelSeparation = this.params.vehicle.wheelSeparation;
        const axesSeparation = this.params.vehicle.axesSeparation;

        // Posiciones de las ruedas en el espacio local del chasis. Se asume
        // que Z negativo = adelante del auto (y por eso las delanteras son
        // las que tienen z < 0 y reciben el steering).
        //   0: delantera izquierda | 1: delantera derecha
        //   2: trasera izquierda   | 3: trasera derecha
        this.wheelPositions = [
            { x: -wheelSeparation / 2, y: 0, z: -axesSeparation/2 },
            { x: wheelSeparation / 2, y: 0, z: -axesSeparation/2},
            { x: -wheelSeparation / 2, y: 0, z: axesSeparation/2},
            { x: wheelSeparation / 2, y: 0, z: axesSeparation/2},
        ];
    }

    async initSimulation() {
        // Inicializa el mundo de Rapier (gravedad terrestre por defecto).
        this.physics = await RapierPhysics();
        this.physics.world.gravity.set(0, -9.81, 0);

        const genericMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

        // Piso plano por defecto. Si la escena ya provee su propio terreno
        // (por ejemplo un heightmap), se puede saltear con options.skipGround.
        if (!this.options.skipGround) {
            const gr = this.params.ground;
            if (!gr?.width || !gr?.height || !gr?.length) { throw Error('Invalid ground parameters'); }

            const groundGeo = new THREE.BoxGeometry(gr.width, gr.height, gr.length);
            const ground = new THREE.Mesh(groundGeo, genericMaterial);
            ground.userData.physics = { mass: 0 };
            this.physics.addMesh(ground);
        }

        // Chasis: cuerpo rígido dinámico al que se acopla el VehicleController.
        const chasisGeo = new THREE.BoxGeometry(2, 0.1, 4);
        const chasisMesh = new THREE.Mesh(chasisGeo, genericMaterial);
        chasisMesh.position.copy(this.params.vehicle.initialPosition);
        chasisMesh.rotation.y = this.params.vehicle.initialYRotation;
        this.physics.addMesh(chasisMesh, this.params.vehicle.mass, 0.8);
        this.chassis = chasisMesh.userData.physics.body;

        // El VehicleController de Rapier simula suspensión, fricción y dirección
        // por rueda como un sistema desacoplado del RigidBody del chasis: las
        // ruedas no son cuerpos físicos independientes, son raycasts con un
        // modelo de suspensión integrado.
        this.vehicleController = this.physics.world.createVehicleController(this.chassis);

        this.addWheels();
        this.setupEventListeners();
        this.initComplete = true;
    }

    /**
     * Envuelve `addMesh` de RapierPhysics y devuelve el RigidBody asociado al
     * mesh, para que el llamador pueda aplicarle impulsos, torques o resets
     * directamente (p. ej. la nave / Lander).
     */
    addRigidBody(mesh, mass = 0, restitution = 0.8) {
        this.physics.addMesh(mesh, mass, restitution);
        return mesh.userData.physics.body;
    }

    addWheels() {
        const vp = this.params.vehicle;

        this.wheelPositions.forEach((pos, index) => {
            // wheelDirection: dirección hacia la que se proyecta el raycast de la
            // suspensión (hacia abajo, en coordenadas locales del chasis).
            // wheelAxle: eje de giro de la rueda (en coordenadas locales).
            const wheelDirection = { x: 0.0, y: -1.0, z: 0.0 };
            const wheelAxle = { x: -1.0, y: 0.0, z: 0.0 };

            this.vehicleController.addWheel(pos, wheelDirection, wheelAxle, vp.suspensionRestLength, vp.wheelRadius);
            this.vehicleController.setWheelSuspensionStiffness(index, vp.suspensionStiffness);
            this.vehicleController.setWheelSuspensionCompression(index, vp.suspensionCompression);
            this.vehicleController.setWheelSuspensionRelaxation(index, vp.suspensionRelaxation);
            this.vehicleController.setWheelMaxSuspensionTravel(index, vp.maxSuspensionTravel);
            this.vehicleController.setWheelFrictionSlip(index, vp.frictionSlip);
            // Las ruedas delanteras (z < 0) son las que doblan.
            this.vehicleController.setWheelSteering(index, pos.z < 0);
        });
    }

    /**
     * Teletransporta al chasis a la pose inicial y anula velocidades.
     * Se usa cuando el jugador presiona la tecla 'r' (p. ej. si volcó).
     * El segundo parámetro `true` de los setters despierta al RigidBody
     * (en Rapier los cuerpos dormidos ignoran cambios si no se los despierta).
     */
    resetVehicle() {
        this.chassis.setTranslation(this.params.vehicle.initialPosition , true);

        // Construye un quaternion para la rotación inicial alrededor del eje Y.
        const alpha =this.params.vehicle.initialYRotation
        const axis = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion();
        quaternion.setFromAxisAngle(axis, alpha);

        this.chassis.setRotation(quaternion, true);
        // Anula velocidades lineales y angulares para que el auto quede quieto.
        this.chassis.setLinvel(new this.physics.RAPIER.Vector3(0, 0, 0), true);
        this.chassis.setAngvel(new this.physics.RAPIER.Vector3(0, 0, 0), true);

        // Reset también de las fuerzas acumuladas: si no, al reiniciar el
        // auto arrancaría con la última aceleración/frenado aplicados.
        this.vehicleState.accelerateForce = 0;
        this.vehicleState.brakeForce= 0;
    }

    /**
     * Procesa el input del jugador y lo traduce en llamadas al
     * VehicleController. Se invoca una vez por frame desde update().
     * Fases:
     *   1. Si hay pedido de reset, teletransporta y sale.
     *   2. Integra la fuerza de aceleración (suavizado tipo rampa).
     *   3. Integra la fuerza de freno (también en rampa).
     *   4. Aplica engine force a las ruedas traseras (tracción trasera).
     *   5. Interpola el steering de las delanteras hacia el objetivo.
     *   6. Aplica el freno a las 4 ruedas.
     */
    updateCarControl() {
        if (!this.initComplete) return; // Evita ejecutar antes de que initSimulation termine.

        // Si el jugador pidió reiniciar, saltamos el resto del control.
        if (this.vehicleState.reset) {
            this.resetVehicle();
            return;
        }

        // Rapier duerme los cuerpos quietos para ahorrar CPU, y las fuerzas
        // del VehicleController no los despiertan solas. Si hay cualquier
        // input, forzamos al chasis a estar despierto este frame.
        if (this.vehicleState.forward !== 0 || this.vehicleState.right !== 0 || this.vehicleState.brake !== 0) {
            this.chassis.wakeUp();
        }

        // --- Paso 1: actualizar la fuerza de aceleración con una rampa ---
        // Sumamos/restamos `step` por frame mientras W/S esté presionada,
        // clampeando en [min, max]. Si no hay input, `accelerateForce` queda
        // en 0 (arranca en cero cada frame si no hay entrada).
        const vp=this.params.vehicle;
        let accelerateForce = 0;

        if (this.vehicleState.forward > 0) {
            accelerateForce = this.vehicleState.accelerateForce + vp.accelerateForce.step;
            if (accelerateForce > vp.accelerateForce.max) accelerateForce = vp.accelerateForce.max;
            
        } else if (this.vehicleState.forward < 0) {
            accelerateForce = this.vehicleState.accelerateForce - vp.accelerateForce.step;
            if (accelerateForce < vp.accelerateForce.min) accelerateForce = vp.accelerateForce.min;
        }

        this.vehicleState.accelerateForce = accelerateForce;

        // --- Paso 2: actualizar la fuerza de freno (también en rampa) ---
        // Sólo crece si space está presionado; se resetea a 0 en cada frame
        // que no haya input (no hay decaimiento gradual).
        let brakeForce = 0;

        if (this.vehicleState.brake > 0) {
            brakeForce = this.vehicleState.brakeForce + vp.brakeForce.step;
            if (brakeForce > vp.brakeForce.max) brakeForce = vp.brakeForce.max;
        }

        this.vehicleState.brakeForce = brakeForce;

        // Signo invertido: en el sistema de coordenadas local del chasis,
        // "adelante" es -Z, por eso la fuerza positiva hacia adelante se
        // aplica como engineForce negativo a las ruedas traseras.
        const engineForce = -accelerateForce;

        // Tracción trasera: sólo las ruedas 0 y 1 reciben fuerza motriz.
        // (Recordá que en el array, 0 y 1 son las delanteras según z < 0,
        // pero el engineForce se aplica aquí a los índices 0 y 1 de igual
        // manera — en este setup el "frente" geométrico coincide con las
        // ruedas motrices.)
        this.vehicleController.setWheelEngineForce(0, engineForce);
        this.vehicleController.setWheelEngineForce(1, engineForce);

        // --- Paso 3: steering suavizado hacia el objetivo ---
        // Lerp del ángulo actual hacia `maxSteeringAngle * dir`. Con
        // steeringReaction bajo (0.1) el giro es progresivo en vez de instantáneo,
        // lo que da una sensación más realista y evita vuelcos bruscos.
        const currentSteering = this.vehicleController.wheelSteering(0);
        const steerDirection = this.vehicleState.right;
        const steerAngle = this.params.vehicle.maxSteeringAngle;
        const steerReaction = this.params.vehicle.steeringReaction;

        const steering = THREE.MathUtils.lerp(currentSteering, steerAngle * steerDirection, steerReaction);

        // Sólo las delanteras giran. El VehicleController aplica la fuerza
        // lateral resultante del raycast orientado en el nuevo ángulo.
        this.vehicleController.setWheelSteering(0, steering);
        this.vehicleController.setWheelSteering(1, steering);

        // --- Paso 4: freno aplicado a las 4 ruedas ---
        // Multiplicamos por `brake` (0 ó 1) para que si el jugador suelta
        // el espacio, el freno caiga inmediatamente a 0 ese frame.
        const wheelBrake = this.vehicleState.brake * brakeForce;
        this.vehicleController.setWheelBrake(0, wheelBrake);
        this.vehicleController.setWheelBrake(1, wheelBrake);
        this.vehicleController.setWheelBrake(2, wheelBrake);
        this.vehicleController.setWheelBrake(3, wheelBrake);
    }

    /**
     * Conecta listeners de teclado globales. Mapea:
     *   W / ↑        → acelerar hacia adelante
     *   S / ↓        → marcha atrás
     *   A / ←, D / → → girar izquierda/derecha
     *   Space        → freno
     *   R            → reiniciar a la pose inicial
     *
     * Los listeners se pegan a `window`, por lo que el foco debe estar en
     * la página (no en un input) para que el input llegue.
     */
    setupEventListeners() {
        window.addEventListener('keydown', (event) => {
            if (event.key === 'w' || event.key === 'ArrowUp') this.vehicleState.forward = 1;
            if (event.key === 's' || event.key === 'ArrowDown') this.vehicleState.forward = -1;
            if (event.key === 'a' || event.key === 'ArrowLeft') this.vehicleState.right = 1;
            if (event.key === 'd' || event.key === 'ArrowRight') this.vehicleState.right = -1;
            if (event.key === 'r') this.vehicleState.reset = true;
            if (event.key === ' ') this.vehicleState.brake = 1;
        });

        window.addEventListener('keyup', (event) => {
            // Al soltar cualquier tecla de aceleración/dirección, el estado
            // vuelve a 0 para que las rampas de fuerza decaigan.
            if (event.key === 'w' || event.key === 's' || event.key === 'ArrowUp' || event.key === 'ArrowDown')
                this.vehicleState.forward = 0;
            if (event.key === 'a' || event.key === 'd' || event.key === 'ArrowLeft' || event.key === 'ArrowRight')
                this.vehicleState.right = 0;
            if (event.key === 'r') this.vehicleState.reset = false;
            if (event.key === ' ') this.vehicleState.brake = 0;
        });
    }

    /**
     * Devuelve la transformación del chasis en coordenadas del mundo. El
     * consumidor (típicamente la escena Three.js) la copia sobre el mesh del
     * auto cada frame para mantenerlo sincronizado con la física.
     */
    getVehicleTransform() {
        if (!this.initComplete) return null; // Evita acceder al chasis antes del init.
        return {
            position: this.chassis.translation(),
            quaternion: this.chassis.rotation(),
        };
    }

    /**
     * Devuelve la transformación de la rueda `index` en coordenadas LOCALES
     * al chasis. La capa visual debe componerla con la pose del chasis para
     * obtener la posición final en el mundo.
     *
     * Se combinan dos rotaciones:
     *  - wheelSteeringQuat: giro alrededor del eje Y (dirección, sólo delanteras)
     *  - wheelRotationQuat: giro alrededor del eje de la rueda (rodadura)
     *
     * La posición en Y se calcula como `connection - suspension`, donde:
     *  - connection: offset vertical del punto de enganche al chasis
     *  - suspension: cuánto se extiende el resorte en este frame
     * Al compactarse la suspensión, la rueda "sube" hacia el chasis.
     */
    getWheelTransform(index) {
        if (!this.vehicleController) return;

        const wheelSteeringQuat = new THREE.Quaternion();
        const wheelRotationQuat = new THREE.Quaternion();
        const up = new THREE.Vector3(0, 1, 0);

        const wheelAxleCs = this.vehicleController.wheelAxleCs(index);                    // eje de rodadura (local)
        const connection = this.vehicleController.wheelChassisConnectionPointCs(index).y; // altura del anclaje
        const suspension = this.vehicleController.wheelSuspensionLength(index);           // compresión actual
        const steering = this.vehicleController.wheelSteering(index);                     // ángulo de dirección
        const rotationRad = this.vehicleController.wheelRotation(index);                  // ángulo de rodadura

        // Usamos X y Z del layout fijo (no cambian), y la Y la recalcula la
        // suspensión para que la rueda "siga" al terreno visualmente.
        let pos= new THREE.Vector3()

        pos.x=this.wheelPositions[index].x;
        pos.y=connection - suspension;
        pos.z=this.wheelPositions[index].z;

        wheelSteeringQuat.setFromAxisAngle(up, steering);
        wheelRotationQuat.setFromAxisAngle(wheelAxleCs, rotationRad);

        // Orden importa: primero orientamos por steering y luego aplicamos la
        // rodadura alrededor del eje ya rotado.
        let quat=new THREE.Quaternion(0, 0, 0, 1).multiplyQuaternions(wheelSteeringQuat, wheelRotationQuat);

        return {
            position:pos,
            quaternion: quat,
        };
    }

    /**
     * Tick principal de la simulación. Debe llamarse desde el loop de render
     * (p. ej. el callback de renderer.setAnimationLoop). El `deltaTime` define
     * el paso de integración de Rapier — valores muy grandes producen
     * comportamiento inestable, por eso el default es 1/60.
     */
    update(deltaTime=1/60){
        if (!this.vehicleController) return;
        this.updateCarControl();
        // updateVehicle ejecuta los raycasts de suspensión y aplica las
        // fuerzas resultantes al RigidBody del chasis. No reemplaza al step
        // del world: eso corre dentro de RapierPhysics automáticamente.
        this.vehicleController.updateVehicle(deltaTime);
    }

}