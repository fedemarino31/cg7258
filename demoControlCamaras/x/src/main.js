import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';


let canvas, renderer, scene, camera, vcam, controls, root;

// Helpers temporales
const tmpSph = new THREE.Spherical();
const tmpOffset = new THREE.Vector3();
const objWorldPos = new THREE.Vector3();
const objWorldQuat = new THREE.Quaternion();
const upWorld = new THREE.Vector3(0,1,0);



// Animación del objeto: rota y se traslada en una órbita elíptica
let t = 0;
let last = performance.now();

function setupThreeJs(){

    canvas = document.getElementById('c');
    renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x141414);

    // Luz
    const hemi = new THREE.HemisphereLight(0xffffff, 0x202020, 1.1);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 6, 4);
    scene.add(dir);

    // Objeto animado (un grupo con un cubo adentro)
    root = new THREE.Group();
    scene.add(root);

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x44aaff, metalness: 0.1, roughness: 0.4 });
    const cube = new THREE.Mesh(geo, mat);
    cube.castShadow = cube.receiveShadow = true;
    root.add(cube);

    // Un gizmo visual para ver ejes locales del objeto
    const axes = new THREE.AxesHelper(1.5);
    root.add(axes);

    //gridHelper
    const gridHelper = new THREE.GridHelper(50, 50);
    scene.add(gridHelper);

    // Cámara REAL (la que renderiza)
    camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 100);
    scene.add(camera);

    // Cámara VIRTUAL controlada por OrbitControls (no se agrega a la escena)
    vcam = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    // Colocamos la virtual en una posición esférica inicial 
    vcam.position.set(0, 5, 10);

    // OrbitControls actúa sobre la cámara VIRTUAL y siempre orbita respecto del ORIGEN (0,0,0)
    controls = new OrbitControls(vcam, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 0);  // ¡fijamos el target en el origen!
    controls.minDistance = 1.2;
    controls.maxDistance = 12;
    controls.enablePan = false;
    resize();
    window.addEventListener('resize', resize);
    animate();
}

function animateObject(dt) {
  t += dt;
  // Traslación (lenta) en 8 “pseudo-lissajous”
  root.position.set(
    Math.sin(t*0.35)*20.0,
    0,
    Math.cos(t*0.22)*10.5
  );
  // Rotación local del objeto (para que sus ejes cambien)
  
  root.rotation.y += 0.6 * dt;  
}




function animate() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  animateObject(dt);
  controls.update(); // suavizado del OrbitControls virtual

  // === Mapeo de la órbita “virtual” al sistema de ejes del objeto ===

  // 1) Leemos el offset esférico desde la cámara virtual (respecto del ORIGEN)
  tmpOffset.copy(vcam.position); // ya que controls.target=0,0,0
  tmpSph.setFromVector3(tmpOffset); // r, phi (polar), theta (azimut)

  // 2) Reconstruimos un vector en Y-up a partir de esa esférica…
  tmpOffset.setFromSpherical(tmpSph);

  // 3) Tomamos la rotación MUNDIAL del objeto y la aplicamos al offset
  root.getWorldQuaternion(objWorldQuat);
  tmpOffset.applyQuaternion(objWorldQuat);

  // 4) Tomamos la posición MUNDIAL del objeto y colocamos la cámara REAL
  root.getWorldPosition(objWorldPos);
  camera.position.copy(objWorldPos).add(tmpOffset);

  // 5) Alineamos el “up” de la cámara REAL con el “up” mundial del objeto
  upWorld.set(0,1,0).applyQuaternion(objWorldQuat);
  camera.up.copy(upWorld);

  // 6) Miramos al objeto
  camera.lookAt(objWorldPos);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

setupThreeJs();