import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import * as dat from "dat.gui";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

let scene, camera, renderer, container, sceneManager;
let params = {
  spotlightAngle: 0,
  toggleHelpers: function () {
    directionalLightHelper.visible = !directionalLightHelper.visible;
    spotLightHelper.visible = !spotLightHelper.visible;
    pointLightHelper.visible = !pointLightHelper.visible;
  },
};
function setupThreeJs() {
  container = document.getElementById("container3D");

  renderer = new THREE.WebGLRenderer();
  scene = new THREE.Scene();

  container.appendChild(renderer.domElement);

  camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(80, 80, 80);
  camera.lookAt(0, 0, 0);

  const controls = new OrbitControls(camera, renderer.domElement);

  window.addEventListener("resize", onResize);
  onResize();
}

function onResize() {
  camera.aspect = container.offsetWidth / container.offsetHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(container.offsetWidth, container.offsetHeight);
}

let ambientLight, directionalLight, pointLight, spotLight, hemiLight;
let directionalLightHelper, spotLightHelper, pointLightHelper;

function setLights() {
  // Luz ambiente
  ambientLight = new THREE.AmbientLight(0x444444); // soft white light
  scene.add(ambientLight);

  // Luz direccional
  directionalLight = new THREE.DirectionalLight(0xffffff, 2);
  directionalLight.position.set(10, 30, 20);
  scene.add(directionalLight);

  // Luz hemisferica
  hemiLight = new THREE.HemisphereLight(0x554499, 0x997711, 0.5);
  scene.add(hemiLight);

  // Luz Puntual
  pointLight = new THREE.PointLight(0xffffff, 10, 150, 0.5); // definimos una fuente de Luz puntual de color blanco
  pointLight.position.set(0, 20, 0); // definimos su posicion en x,y,z=10,10,10
  scene.add(pointLight); // agregamos la luz a la escena

  // Luz Spot
  // SpotLight( color : Integer, intensity : Float, distance : Float, angle : Radians, penumbra : Float, decay : Float )
  spotLight = new THREE.SpotLight(0xffffff, 5, 100, 0.5, 0.3, 0.1);
  spotLight.position.set(-30, 50, 30);
  scene.add(spotLight); // agregamos la luz a la escena

  // Helpers
  pointLightHelper = new THREE.PointLightHelper(pointLight, 1);
  scene.add(pointLightHelper);

  directionalLightHelper = new THREE.DirectionalLightHelper(
    directionalLight,
    10
  );
  scene.add(directionalLightHelper);

  spotLightHelper = new THREE.SpotLightHelper(spotLight);
  scene.add(spotLightHelper);

  ambientLight.visible = true;
  hemiLight.visible = false;
  pointLight.visible = false;
  spotLight.visible = false;
  directionalLight.visible = false;
}

function createScene() {
  let loader = new GLTFLoader();

  let list = [];

  loader.load(
    "models/luces.glb",

    function (gltf) {
      gltf.animations; // Array<THREE.AnimationClip>
      gltf.scene; // THREE.Scene
      gltf.scenes; // Array<THREE.Scene>
      gltf.cameras; // Array<THREE.Camera>
      gltf.asset; // Object

      scene.add(gltf.scene);
    },
    // called while loading is progressing
    function (xhr) {
      console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
    },
    // called when loading has errors
    function (error) {
      console.log("An error happened");
    }
  );
}

function createMenu() {
  let gui = new dat.GUI();
  gui.domElement.id = "gui";

  var f1 = gui.addFolder("Luces");

  f1.add(ambientLight, "visible").name("ambientLight");
  f1.add(hemiLight, "visible").name("hemiLight");
  f1.add(pointLight, "visible").name("pointLight");
  f1.add(spotLight, "visible").name("spotLight");
  f1.add(directionalLight, "visible").name("directionalLight");
  f1.add(params, "toggleHelpers");

  f1.open();

  var f2 = gui.addFolder("spotlight");

  f2.add(spotLight, "decay", 0.01, 2).step(0.01);
  f2.add(spotLight, "angle", 0, 1.5).step(0.001);
  f2.add(spotLight, "intensity", 0, 20).step(0.001);
  f2.add(spotLight, "distance", 0, 3000);
  f2.add(spotLight, "penumbra", 0.0, 1).step(0.01);
  f2.open();
  /*
  var f3 = gui.addFolder("otros");
  f3.add(params, "toggleHelpers").name("helpers");
  f3.open();*/
}

function animate() {
  requestAnimationFrame(animate);

  renderer.render(scene, camera);
}

setupThreeJs();
setLights();
createScene(); //crea la escena
createMenu();

animate();
