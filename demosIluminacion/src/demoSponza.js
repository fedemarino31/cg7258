import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

let scene, camera, cameraFPV, renderer, container;
let controls, pointerLockControls;
let currentCamera = "orbit"; // Estado actual de la cámara
let btnPointerLock;

function setupThreeJs() {
  container = document.getElementById("container3D");

  renderer = new THREE.WebGLRenderer();
  renderer.setClearColor(0x999999);
  scene = new THREE.Scene();

  container.appendChild(renderer.domElement);

  // Cámara perspectiva con OrbitControls
  camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(10, 1, 0);
  camera.lookAt(0, 0, 0);

  controls = new OrbitControls(camera, renderer.domElement);

  // Cámara de primera persona con PointerLockControls
  cameraFPV = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  cameraFPV.position.set(0, 1, 0);

  pointerLockControls = new PointerLockControls(cameraFPV, renderer.domElement);
  pointerLockControls.maxPolarAngle = Math.PI / 2;
  pointerLockControls.minPolarAngle = Math.PI / 6;
  pointerLockControls.pointerSpeed = 0.1;

  window.addEventListener("resize", onResize);
  //window.addEventListener("keydown", onKeyDown);

  // Botón para iniciar control de PointerLock
  btnPointerLock = document.createElement("button");
  btnPointerLock.innerText = "Activar Primera Persona";
  //posicionar el boton en el centro usando transform
  btnPointerLock.style.transform = "translate(-50%, -50%)";
  btnPointerLock.style.position = "absolute";
  btnPointerLock.style.top = "50%";
  btnPointerLock.style.left = "50%";
  btnPointerLock.style.fontSize = "150%";
  btnPointerLock.style.padding = "30px";
  btnPointerLock.style.display = "none";

  pointerLockControls.addEventListener("lock", function () {
    btnPointerLock.style.display = "none";
  });

  pointerLockControls.addEventListener("unlock", function () {
    btnPointerLock.style.display = "block";
  });

  document.body.appendChild(btnPointerLock);

  btnPointerLock.addEventListener("click", () => {
    if (currentCamera === "fpv") {
      pointerLockControls.lock();
    }
  });

  onResize();
}

function onKeyDown(event) {
  if (event.code === "KeyC") {
    // Cambiar entre las dos cámaras
    if (currentCamera === "orbit") {
      btnPointerLock.style.display = "block";

      currentCamera = "fpv";
    } else {
      pointerLockControls.unlock();
      currentCamera = "orbit";
    }
  }
}

function buildScene() {
  const grid = new THREE.GridHelper(30, 30);
  grid.position.y = -2;
  scene.add(grid);

  // add sphere in wireframe mode
  const geometry = new THREE.SphereGeometry(100, 32, 32);
  const material = new THREE.MeshBasicMaterial({ wireframe: true });
  const sphere = new THREE.Mesh(geometry, material);

  //scene.add(sphere);

  const axes = new THREE.AxesHelper(3);
  scene.add(axes);

  const loader = new GLTFLoader();
  loader.load("models/sponza.gltf", onModelLoaded, onProgress, onLoadError);
}

function setupLights() {
  const hemiLight = new THREE.HemisphereLight(0x9999ff, 0x996644, 0.5);
  scene.add(hemiLight);

  // pointlight
  const pointLight = new THREE.PointLight(0xffffff, 5, 100, 2);
  pointLight.position.set(0, 2, 0);
  scene.add(pointLight);
  // add helper
  const pointLightHelper = new THREE.PointLightHelper(pointLight, 0.1);
  scene.add(pointLightHelper);

  // completar setup de luces aqui ....
}
function onModelLoaded(gltf) {
  let mat = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    shininess: 16,
  });
  gltf.scene.traverse((child) => {
    if (child.isMesh) {
      child.material = mat;
    }
  });
  scene.add(gltf.scene);
}

function onProgress(event) {
  console.log((event.loaded / event.total) * 100 + "% loaded");
}

function onLoadError(event) {
  console.error("Error loading", event);
}

function onResize() {
  camera.aspect = container.offsetWidth / container.offsetHeight;
  camera.updateProjectionMatrix();

  cameraFPV.aspect = container.offsetWidth / container.offsetHeight;
  cameraFPV.updateProjectionMatrix();

  renderer.setSize(container.offsetWidth, container.offsetHeight);
}

function animate() {
  console.log("Animate");
  requestAnimationFrame(animate);

  if (currentCamera === "orbit") {
    controls.update();
    renderer.render(scene, camera);
  } else if (currentCamera === "fpv") {
    renderer.render(scene, cameraFPV);
  }
}

setupThreeJs();
buildScene();
setupLights();
animate();
