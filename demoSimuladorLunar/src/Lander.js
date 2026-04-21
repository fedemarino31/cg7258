import * as THREE from 'three';

/**
 * Nave lunar (Lander) low-poly: cuerpo cónico con cuatro patas, propulsada por
 * impulsos sobre los tres ejes del mundo y autoestabilizada por un control PD
 * que la mantiene aproximadamente vertical.
 *
 * Controles:
 *   I / K  → impulso en -Z / +Z
 *   J / L  → impulso en -X / +X
 *   U / O  → impulso en +Y / -Y  (subir / bajar)
 *   N      → reset (vuelve a la posición inicial con velocidad cero)
 *
 * Decisión de diseño física:
 *   Rapier no admite colisionadores de malla triangular (trimesh) en cuerpos
 *   dinámicos: solo en cuerpos estáticos. Por eso el COLISIONADOR es una caja
 *   envolvente invisible (this.root), y la parte visual (cono + patas, o el
 *   modelo externo que se cargue) se agrega como hijo de esa caja para
 *   heredar su transform automáticamente.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  CÓMO REEMPLAZAR LA GEOMETRÍA POR UN MODELO EXTERNO (GLTF / OBJ / FBX ...)
 * ═══════════════════════════════════════════════════════════════════════════
 * A diferencia del Rover, el Lander NO tiene partes móviles independientes:
 * es un único cuerpo rígido. Por eso basta con UN punto de reemplazo: el
 * sub-árbol visual completo (llamado `this.visual`). El colisionador físico
 * sigue siendo la caja envolvente invisible y no cambia.
 *
 * Dos formas de reemplazar:
 *   A) Por constructor:  new Lander(scene, physics, { visualMesh: obj })
 *   B) En runtime:       lander.setVisualMesh(obj)
 *
 * Ejemplo con GLTFLoader:
 *
 *     import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
 *     const gltf = await new GLTFLoader().loadAsync('assets/lander.glb');
 *     const lander = new Lander(scene, physics, {
 *         visualMesh: gltf.scene,
 *         // Opcional: ajustar el tamaño de la caja de colisión al modelo.
 *         coneRadius: 1.4, coneHeight: 3.0, legLength: 1.8,
 *     });
 *
 * Restricciones del modelo externo:
 *   - Debe estar centrado en su origen local (el origen coincide con el
 *     centro del RigidBody, y por ende con el centro de la caja envolvente).
 *   - La orientación esperada es +Y hacia arriba (el control PD mantiene
 *     vertical el eje Y local).
 *   - Las dimensiones coneRadius/coneHeight/legLength/legRadius siguen
 *     controlando el tamaño de la caja envolvente (colisionador). Si tu
 *     modelo es más grande/chico, ajustá esos parámetros en consecuencia
 *     para que la colisión sea coherente con lo que se ve.
 */
export class Lander {
    constructor(scene, physicsSimulator, {
        initialPosition = new THREE.Vector3(15, 30, 15),
        mass = 15,
        thrustForce = 10,
        stabilizationKp = 8,
        stabilizationKd = 2,
        coneRadius = 1.2,
        coneHeight = 2.5,
        legLength = 1.6,
        legRadius = 0.1,
        // ── Hook de reemplazo de geometría (ver JSDoc de la clase) ──
        visualMesh = null,      // Object3D a usar como visual, o null → cono+patas.
    } = {}) {
        this.scene = scene;
        this.physicsSimulator = physicsSimulator;
        this.initialPosition = initialPosition.clone();
        this.thrustForce = thrustForce;
        this.kp = stabilizationKp;
        this.kd = stabilizationKd;

        this.input = { x: 0, y: 0, z: 0 };

        this._buildMeshes(coneRadius, coneHeight, legLength, legRadius, visualMesh);
        this._registerPhysics(mass);
        this._setupInput();
    }

    _buildMeshes(coneRadius, coneHeight, legLength, legRadius, externalVisualMesh) {
        const legSpread = coneRadius * 0.85;
        const coneBaseY = -coneHeight * 0.5;
        const legCenterY = coneBaseY - legLength * 0.5;

        // ─── Caja envolvente = colisionador del cuerpo dinámico ───────────
        // NO es un punto de reemplazo: Rapier no acepta trimesh en cuerpos
        // dinámicos, así que la física está acoplada a este Box invisible
        // independientemente de cómo se vea el lander.
        const envelopeWidth = Math.max(coneRadius * 2, (legSpread + legRadius) * 2);
        const envelopeHeight = coneHeight + legLength;
        const rootGeo = new THREE.BoxGeometry(envelopeWidth, envelopeHeight, envelopeWidth);
        const invisibleMat = new THREE.MeshBasicMaterial({ visible: false });
        this.root = new THREE.Mesh(rootGeo, invisibleMat);
        this.root.position.copy(this.initialPosition);
        this.scene.add(this.root);

        // ─── PUNTO DE REEMPLAZO — geometría visual del lander ─────────────
        // Si llega un Object3D por parámetro, se usa tal cual. Si no, se
        // construye el cono + 4 patas por defecto. El resultado queda en
        // this.visual y hereda el transform del root (y por ende del físico).
        this.visual = externalVisualMesh
            ?? this._createDefaultVisual(coneRadius, coneHeight, legLength, legRadius, legSpread, coneBaseY, legCenterY);
        this.root.add(this.visual);

        // Resplandor azul tipo "cohete" en la base. Es un efecto visual que
        // debe acompañar al lander sin importar qué modelo se cargue, así
        // que se agrega al root (no al visual) para no perderse al reemplazar.
        const thrusterLight = new THREE.PointLight(0x3399ff, 25, 15, 2);
        thrusterLight.position.set(0, coneBaseY - 0.1, 0);
        this.root.add(thrusterLight);
    }

    // Geometría por defecto de la demo: cono (cuerpo) + 4 patas cilíndricas
    // verticales en las esquinas. Todo empaquetado en un Group para que sea
    // un único Object3D reemplazable por this.visual.
    _createDefaultVisual(coneRadius, coneHeight, legLength, legRadius, legSpread, coneBaseY, legCenterY) {
        const group = new THREE.Group();
        const greenMat = new THREE.MeshPhongMaterial({ color: 0x00aa33, flatShading: true });

        const coneGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 8);
        group.add(new THREE.Mesh(coneGeo, greenMat));

        const legGeo = new THREE.CylinderGeometry(legRadius, legRadius, legLength, 8);
        const legPositions = [
            { x:  legSpread, z:  legSpread },
            { x: -legSpread, z:  legSpread },
            { x:  legSpread, z: -legSpread },
            { x: -legSpread, z: -legSpread },
        ];
        for (const p of legPositions) {
            const leg = new THREE.Mesh(legGeo, greenMat);
            leg.position.set(p.x, legCenterY, p.z);
            group.add(leg);
        }
        return group;
    }

    /**
     * Reemplaza en runtime la geometría visual del lander por el Object3D
     * dado (p. ej. gltf.scene). No toca la caja envolvente ni el RigidBody,
     * así que la física sigue funcionando igual.
     */
    setVisualMesh(mesh) {
        if (this.visual) this.root.remove(this.visual);
        this.visual = mesh;
        this.root.add(mesh);
    }

    _registerPhysics(mass) {
        // addRigidBody devuelve el RigidBody Rapier subyacente.
        // El colisionador es la caja envolvente del root; los hijos visuales
        // (cono + patas o modelo externo) no participan en la colisión.
        this.body = this.physicsSimulator.addRigidBody(this.root, mass, 0.5);
    }

    _setupInput() {
        window.addEventListener('keydown', (e) => {
            switch (e.key.toLowerCase()) {
                case 'i': this.input.z = -1; break;
                case 'k': this.input.z =  1; break;
                case 'j': this.input.x = -1; break;
                case 'l': this.input.x =  1; break;
                case 'u': this.input.y =  1; break;
                case 'o': this.input.y = -1; break;
                case 'n': this.reset(); break;
            }
        });
        window.addEventListener('keyup', (e) => {
            switch (e.key.toLowerCase()) {
                case 'i': case 'k': this.input.z = 0; break;
                case 'j': case 'l': this.input.x = 0; break;
                case 'u': case 'o': this.input.y = 0; break;
            }
        });
    }

    /**
     * Aplica los impulsos de propulsión y el par de autoestabilización.
     * Debe llamarse una vez por frame, después de physicsSimulator.update().
     */
    update() {
        if (!this.body) return;

        // applyImpulse aplica un cambio instantáneo de momento lineal (kg·m/s),
        // expresado en coordenadas del mundo. Las teclas mueven la nave en
        // ejes globales (J siempre empuja en -X, sin importar su orientación).
        if (this.input.x) this.body.applyImpulse({ x: this.input.x * this.thrustForce, y: 0, z: 0 }, true);
        if (this.input.y) this.body.applyImpulse({ x: 0, y: this.input.y * this.thrustForce, z: 0 }, true);
        if (this.input.z) this.body.applyImpulse({ x: 0, y: 0, z: this.input.z * this.thrustForce }, true);

        // Control PD de orientación: aplica un par proporcional al ángulo de
        // inclinación respecto al "arriba" del mundo (eje = up_local × up_mundo)
        // menos un término de amortiguamiento sobre la velocidad angular actual.
        const q = this.body.rotation();
        const upLocal = new THREE.Vector3(0, 1, 0)
            .applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
        const worldUp = new THREE.Vector3(0, 1, 0);
        const axis = new THREE.Vector3().crossVectors(upLocal, worldUp);
        const angle = Math.acos(THREE.MathUtils.clamp(upLocal.dot(worldUp), -1, 1));
        const w = this.body.angvel();
        this.body.applyTorqueImpulse({
            x: this.kp * axis.x * angle - this.kd * w.x,
            y: this.kp * axis.y * angle - this.kd * w.y,
            z: this.kp * axis.z * angle - this.kd * w.z,
        }, true);
    }

    /**
     * Teleporta la nave a su posición inicial y pone a cero las velocidades
     * lineal y angular para evitar que conserve momento del estado anterior.
     */
    reset() {
        if (!this.body) return;
        this.body.setTranslation(this.initialPosition, true);
        this.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
        this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
}
