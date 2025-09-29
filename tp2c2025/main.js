import * as THREE from 'three';
import { AirplaneController } from './airplaneController.js';

// --- Renderer, escena, cámara ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e15);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);

// --- Luces básicas ---
const amb = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(amb);
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(5, 10, 7);
scene.add(dir);

// --- Grid (opcional, de referencia) ---
const grid = new THREE.GridHelper(1000, 100);
scene.add(grid);

// --- Pista (caja) por debajo ---
const runwayMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.9, metalness: 0.0 });
const runway = new THREE.Mesh(new THREE.BoxGeometry(30, 0.5, 600), runwayMat);
runway.position.set(0, 0, 0);   // por debajo del minY=2
runway.receiveShadow = true;
scene.add(runway);

// Avión 4 cajas, forward = -Z
function createPlane(){
  const g = new THREE.Group();

  const matBody = new THREE.MeshStandardMaterial({ color:0x99aacc, roughness:0.6, metalness:0.1 });
  const matWing = new THREE.MeshStandardMaterial({ color:0xFF3333, roughness:0.5, metalness:0.1 });
  const matTail = new THREE.MeshStandardMaterial({ color:0xff2222, roughness:0.5, metalness:0.1 });
  const matRud  = new THREE.MeshStandardMaterial({ color:0xff0000, roughness:0.5, metalness:0.1 });

  // 1) Fuselaje (largo en Z)
  const fuselage = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 8.0), matBody);
  fuselage.position.set(0, 1.2, 0);
  g.add(fuselage);

  // 2) Alas
  const wings = new THREE.Mesh(new THREE.BoxGeometry(10.0, 0.14, 2.2), matWing);
  wings.position.set(0, 1.2, -0.5); // un poco hacia la nariz
  g.add(wings);

  // 3) Estabilizador horizontal (cola)
  const tailWings = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 1.2), matTail);
  tailWings.position.set(0, 1.2, 3.2);
  g.add(tailWings);

  // 4) Timón vertical
  const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.4, 1.2), matRud);
  rudder.position.set(0, 1.9, 3.2);
  g.add(rudder);

  [fuselage, wings, tailWings, rudder].forEach(m => { m.castShadow = m.receiveShadow = true; });
  return g;
}

const plane = createPlane();
scene.add(plane);

// Cámara: montada al avión (detrás y arriba)
plane.add(camera);
camera.position.set(0, 10, 20);
camera.lookAt(new THREE.Vector3(0, 0, 0));

// Controlador estable con minY = 2
const controller = new AirplaneController(plane, {
  maxSpeed: 120,
  accelResponse: 2.2,
  drag: 0.015,

  pitchLimit: THREE.MathUtils.degToRad(45),
  bankLimit:  THREE.MathUtils.degToRad(60),

  pitchCmdRateDeg: 60,
  bankCmdRateDeg:  90,

  pitchResponse: 5.0,
  bankResponse:  6.0,

  pitchCentering: 1.0,
  bankCentering:  1.5,

  turnRateGain: 1.3,
  yawTaxiRate: Math.PI * 1.4,

  stallSpeed: 12,
  ctrlVRange: 25,

  // *** NUEVO: altura mínima (suelo) ***
  minY: 2
});

// Estado inicial en el origen (y=2), mirando -Z, throttle=0
controller.setTransform({
  position: new THREE.Vector3(0, 2, 0),
  euler: new THREE.Euler(0, 0, 0, 'YXZ'), // heading=0 → forward -Z
  throttle: 0
});

// --- HUD (opcional, si tenés un <div id="hud"> en tu HTML) ---
const hudEl = document.getElementById('hud');
function updateHUD() {
  if (!hudEl) return;
  const s = controller.getStatus();
  hudEl.innerHTML =
    `Vel: ${s.speed.toFixed(1)} u/s<br>` +
    `Throttle: ${(controller.getEnginePower()*100)|0}%<br>` +
    `Pitch/Bank: ${s.pitchDeg.toFixed(0)}° / ${s.bankDeg.toFixed(0)}°`;
}

// --- Resize ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// *** NUEVO: tecla R para resetear a situación de despegue ***
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR') {
    controller.setTransform({
      position: new THREE.Vector3(0, 2, 0),
      euler: new THREE.Euler(0, 0, 0, 'YXZ'), // nivelado, nariz hacia -Z
      throttle: 0
    });
  }
});

// --- Animación ---
const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(0.05, clock.getDelta()); // clamp por si se pausa un tab
  controller.update(dt);
  updateHUD();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
