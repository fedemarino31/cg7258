import * as THREE from 'three';

// === Constantes de teclas para control del avión ===
export const AIRPLANE_KEYS = {
  PITCH_UP:    'ArrowUp',
  PITCH_DOWN:  'ArrowDown',
  BANK_LEFT:   'ArrowLeft',
  BANK_RIGHT:  'ArrowRight',
  THROTTLE_UP: 'PageUp',
  THROTTLE_DN: 'PageDown'
};

/**
 * Controlador FBW simplificado y predecible
 * - Forward = -Z, Up = +Y, Right = +X
 * - Targets de pitch/bank con filtros de 1er orden.
 * - Yaw/Heading:
 *    * Baja velocidad: taxi (◀/▶ giran el rumbo directamente).
 *    * Vuelo: viraje coordinado: heading += gain * tan(bank) * (v/maxV) * dt
 * - Throttle controla velocidad con suavizado; autoridad de mando escala con v.
 * - Gravedad simplificada: si throttle ~ 0 y estás en el aire, el avión desciende hasta minY.
 */
export class AirplaneController {
  constructor(object3D, {
    maxSpeed = 120,
    accelResponse = 2.0, // rapidez hacia targetSpeed
    drag = 0.01,

    // límites (radianes)
    pitchLimit = THREE.MathUtils.degToRad(45),
    bankLimit  = THREE.MathUtils.degToRad(60),

    // tasas a las que las teclas cambian los objetivos (deg/s)
    pitchCmdRateDeg = 60,
    bankCmdRateDeg  = 90,

    // respuesta (1/seg) para filtrar hacia los objetivos
    pitchResponse = 4.0,
    bankResponse  = 5.0,

    // auto-centrado cuando no hay input (1/seg)
    pitchCentering = 0.8,
    bankCentering  = 1.2,

    // yaw
    turnRateGain = 1.2,         // ganancia viraje coordinado
    yawTaxiRate  = Math.PI*1.2, // yaw directo en taxi

    // transición taxi → vuelo
    stallSpeed = 12,
    ctrlVRange = 25,

    // *** NUEVO: altura mínima (nivel de suelo) ***
    minY = 0,

    // *** NUEVO: gravedad simplificada (u/s^2) ***
    gravity = 9.81,

    // amortiguación vertical cuando hay potencia (reduce drift)
    verticalDampingWhenPowered = 2.5
  } = {}) {
    this.obj = object3D;

    // estado de entradas
    this._keys = {
      [AIRPLANE_KEYS.PITCH_UP]:    false,
      [AIRPLANE_KEYS.PITCH_DOWN]:  false,
      [AIRPLANE_KEYS.BANK_LEFT]:   false,
      [AIRPLANE_KEYS.BANK_RIGHT]:  false
    };

    // parámetros
    this.maxSpeed = maxSpeed;
    this.accelResponse = accelResponse;
    this.drag = drag;

    this.pitchLimit = pitchLimit;
    this.bankLimit  = bankLimit;

    this.pitchCmdRate = THREE.MathUtils.degToRad(pitchCmdRateDeg);
    this.bankCmdRate  = THREE.MathUtils.degToRad(bankCmdRateDeg);

    this.pitchResponse = pitchResponse;
    this.bankResponse  = bankResponse;

    this.pitchCentering = pitchCentering;
    this.bankCentering  = bankCentering;

    this.turnRateGain = turnRateGain;
    this.yawTaxiRate  = yawTaxiRate;

    this.stallSpeed = stallSpeed;
    this.ctrlVRange = ctrlVRange;

    // *** NUEVO ***
    this.minY = minY;
    this.gravity = gravity;
    this.verticalDampingWhenPowered = verticalDampingWhenPowered;

    // estado de vuelo
    this.throttle = 0;
    this.speed = 0;

    // *** NUEVO: velocidad vertical (para gravedad) ***
    this.verticalVelocity = 0;

    // ejes útiles
    this._fwd = new THREE.Vector3(0,0,-1);

    // inicializar heading/pitch/bank desde la orientación actual
    const e = new THREE.Euler().setFromQuaternion(this.obj.quaternion, 'YXZ');
    this.heading = e.y; // yaw/rumbo
    this.pitch   = e.x; // estado suavizado actual
    this.bank    = e.z;

    this.pitchTarget = this.pitch;
    this.bankTarget  = 0; // arrancamos nivelado

    // listeners
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp   = this._onKeyUp.bind(this);
    this._onBlur    = this._onBlur.bind(this);
    window.addEventListener('keydown', this._onKeyDown, { passive:false });
    window.addEventListener('keyup', this._onKeyUp, { passive:false });
    window.addEventListener('blur', this._onBlur);
  }

  dispose(){
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
  }

  _onKeyDown(e){
    if (
      Object.values(AIRPLANE_KEYS).includes(e.code)
    ) e.preventDefault();

    if (e.code in this._keys) this._keys[e.code] = true;
    if (e.code === AIRPLANE_KEYS.THROTTLE_UP)   this.throttle = Math.min(1, this.throttle + 0.05);
    if (e.code === AIRPLANE_KEYS.THROTTLE_DN)   this.throttle = Math.max(0, this.throttle - 0.05);
  }
  _onKeyUp(e){ if (e.code in this._keys) this._keys[e.code] = false; }
  _onBlur(){ for (const k in this._keys) this._keys[k] = false; }

  _authority(){
    const a = THREE.MathUtils.clamp((this.speed - this.stallSpeed) / this.ctrlVRange, 0, 1);
    return a*a*(3-2*a); // smoothstep
  }

  /**
   
   * Setea instantáneamente posición, orientación y potencia de motor (throttle 0..1).
   * Acepta:
   *  - position: THREE.Vector3
   *  - quaternion: THREE.Quaternion
   *  - euler: THREE.Euler (alternativa a quaternion)
   *  - throttle: number 0..1
   */
  setTransform({ position, quaternion, euler, throttle } = {}){
    if (position) this.obj.position.copy(position);
    if (quaternion) {
      this.obj.quaternion.copy(quaternion);
    } else if (euler) {
      this.obj.quaternion.setFromEuler(euler);
    }

    if (typeof throttle === 'number') {
      this.throttle = THREE.MathUtils.clamp(throttle, 0, 1);
      this.speed = this.throttle * this.maxSpeed;
    }

    // recalcular estados derivables de la orientación
    const eul = new THREE.Euler().setFromQuaternion(this.obj.quaternion, 'YXZ');
    this.heading = eul.y;
    this.pitch   = eul.x;
    this.bank    = eul.z;

    // alinear targets con el estado
    this.pitchTarget = this.pitch;
    this.bankTarget  = this.bank;

    // reset vertical
    if (this.obj.position.y < this.minY) this.obj.position.y = this.minY;
    this.verticalVelocity = 0;
  }

  /**
   
   * Devuelve la potencia del motor (0..1). Útil para animar hélices.
   */
  getEnginePower(){
    return this.throttle;
  }

  update(dt){
    // 1) Procesar inputs → modificar objetivos (targets)
    const up = this._keys[AIRPLANE_KEYS.PITCH_UP]   ? 1 : 0;
    const dn = this._keys[AIRPLANE_KEYS.PITCH_DOWN] ? 1 : 0;
    const rt = this._keys[AIRPLANE_KEYS.BANK_RIGHT] ? 1 : 0;
    const lt = this._keys[AIRPLANE_KEYS.BANK_LEFT]  ? 1 : 0;

    // (invertido como acordamos: Down ≡ Up, Left ≡ Right)
    const pitchCmd = ( dn - up ) * this.pitchCmdRate;   // rad/s
    const bankCmd  = ( lt - rt ) * this.bankCmdRate;    // rad/s

    // Objetivo de pitch/bank (integrados con límites)
    this.pitchTarget = THREE.MathUtils.clamp(this.pitchTarget + pitchCmd * dt, -this.pitchLimit, this.pitchLimit);
    this.bankTarget  = THREE.MathUtils.clamp(this.bankTarget  + bankCmd  * dt, -this.bankLimit,  this.bankLimit);

    // Auto-centrado cuando no hay input
    if (!up && !dn) {
      const k = 1 - Math.exp(-this.pitchCentering * dt);
      this.pitchTarget = THREE.MathUtils.lerp(this.pitchTarget, 0, k);
    }
    if (!rt && !lt) {
      const k = 1 - Math.exp(-this.bankCentering * dt);
      this.bankTarget = THREE.MathUtils.lerp(this.bankTarget, 0, k);
    }

    // 2) Filtrar estados hacia objetivos (primer orden, estable)
    const A = this._authority(); // 0..1
    const kp = 1 - Math.exp(-(this.pitchResponse * (0.4 + 0.6*A)) * dt);
    const kb = 1 - Math.exp(-(this.bankResponse  * (0.4 + 0.6*A)) * dt);
    this.pitch += (this.pitchTarget - this.pitch) * kp;
    this.bank  += (this.bankTarget  - this.bank)  * kb;

    // 3) Actualizar heading (rumbo)
    const lr = (lt - rt);
    if (A < 0.15) {
      // taxi/rodaje: yaw directo con ◀/▶
      this.heading += this.yawTaxiRate * lr * dt;
    } else {
      // viraje coordinado por alabeo (predecible y suave)
      const speedNorm = THREE.MathUtils.clamp(this.speed / Math.max(this.maxSpeed, 1e-3), 0, 1);
      this.heading += this.turnRateGain * Math.tan(this.bank) * speedNorm * dt;
    }

    // 4) Construir orientación deseada y aplicarla (Euler YXZ: yaw→pitch→roll)
    const e = new THREE.Euler(this.pitch, this.heading, this.bank, 'YXZ');
    this.obj.quaternion.setFromEuler(e);

    // 5) Velocidad (throttle → targetSpeed) con drag
    const targetSpeed = this.throttle * this.maxSpeed;
    const alpha = 1 - Math.exp(-this.accelResponse * dt);
    this.speed += (targetSpeed - this.speed) * alpha;
    this.speed = Math.max(0, this.speed - this.drag * this.speed * dt);

    // 6) Avance horizontal en dirección forward (-Z local)
    const fwd = this._fwd.clone().applyQuaternion(this.obj.quaternion);
    this.obj.position.addScaledVector(fwd, this.speed * dt);

    // 7) *** NUEVO: integración vertical con gravedad simplificada ***
    const airborne = (this.obj.position.y > this.minY + 1e-4);

    if (airborne) {
      if (this.throttle <= 0.001) {
        // Sin potencia: caer (gravedad)
        this.verticalVelocity -= this.gravity * dt;
      } else {
        // Con potencia: amortiguar drift vertical (no simulamos lift real aquí)
        const damp = Math.exp(-this.verticalDampingWhenPowered * dt);
        this.verticalVelocity *= damp;
      }
      this.obj.position.y += this.verticalVelocity * dt;
    }

    // 8) Clamp de altura mínima (suelo) y reset de velocidad vertical al tocar suelo
    if (this.obj.position.y <= this.minY) {
      this.obj.position.y = this.minY;
      this.verticalVelocity = 0;
    }
  }

  getStatus(){
    return {
      throttle: this.throttle,
      speed: this.speed,
      pitchDeg: THREE.MathUtils.radToDeg(this.pitch),
      bankDeg:  THREE.MathUtils.radToDeg(this.bank)
    };
  }
}
