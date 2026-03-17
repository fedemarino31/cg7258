/**
 * ============================================================================
 * main.js — Showcase de Piezas del City Generator
 * ============================================================================
 *
 * Aplicación auxiliar para visualizar individualmente cada pieza que
 * compone la ciudad 3D: árboles, postes de luz, casas, lotes y el
 * barrio completo. Ideal para capturar screenshots para presentaciones.
 *
 * Usa dat.gui para cambiar entre vistas. Cada vista ajusta automáticamente
 * la cámara para encuadrar la pieza seleccionada.
 *
 * ============================================================================
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as dat from "dat.gui";

import {
  createTree,
  createLampPost,
  createPark,
  createHouse,
  createLot,
  createNeighborhood,
  resetRandom,
  materials,
} from "./cityParts.js";

// ── Variables globales ──────────────────────────────────────────
let scene, camera, renderer, container, controls;
let currentObject = null;
let gui;

// ── Lista de vistas disponibles ─────────────────────────────────
// Cada vista define: qué objeto crear, posición/target de cámara,
// y un título descriptivo para la GUI.
const VIEWS = {
  "Árbol": {
    build: () => {
      resetRandom();
      return createTree(5, 3);
    },
    camera: { pos: [6, 5, 6], target: [0, 3, 0] },
    title: "Nivel 1 — Árbol (Tree)",
    description: "Group con 2 meshes: tronco (Cylinder) + copa (Sphere)",
  },
  "Poste de Luz": {
    build: () => {
      resetRandom();
      return createLampPost(5, 0.65);
    },
    camera: { pos: [5, 4, 5], target: [0, 2.5, 0] },
    title: "Nivel 1 — Poste de Luz (LampPost)",
    description: "Group con: poste (Cylinder) + lámpara (Sphere emisiva) + PointLight",
  },
  "Parque": {
    build: () => {
      resetRandom();
      return createPark(10, 10);
    },
    camera: { pos: [8, 6, 8], target: [0, 0, 0] },
    title: "Nivel 1 — Parque (Park)",
    description: "Mesh simple: BoxGeometry plano con material de césped",
  },
  "Casa (3 pisos)": {
    build: () => {
      resetRandom();
      return createHouse(3, 6);
    },
    camera: { pos: [15, 12, 15], target: [0, 6, 0] },
    title: "Nivel 2 — Casa de 3 pisos",
    description: "Group compuesto: pisos (clones) + ventanas + techo + puerta",
  },
  "Edificio (8 pisos)": {
    build: () => {
      resetRandom();
      return createHouse(8, 5);
    },
    camera: { pos: [25, 20, 25], target: [0, 16, 0] },
    title: "Nivel 2 — Edificio de 8 pisos",
    description: "Mismo patrón que la casa, con más repeticiones de clone()",
  },
  "Lote / Manzana": {
    build: () => {
      resetRandom();
      return createLot();
    },
    camera: { pos: [30, 25, 30], target: [0, 5, 0] },
    title: "Nivel 3 — Lote (City Block)",
    description: "Group que compone: 1 casa + parque + postes + árboles",
  },
  "Barrio completo": {
    build: () => {
      resetRandom();
      return createNeighborhood();
    },
    camera: { pos: [100, 60, 80], target: [0, 0, 0] },
    title: "Nivel 4 — Barrio (Neighborhood)",
    description: "Repetición de lotes con transformaciones (posición + rotación)",
  },
};

// ── Parámetros de la GUI ────────────────────────────────────────
const params = {
  vista: "Árbol",
  fondoBlanco: true,
  mostrarGrilla: true,
  mostrarEjes: true,
  noche: false,
};

// ═══════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════

function setupThreeJs() {
  container = document.getElementById("container3D");

  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0xffffff);

  scene = new THREE.Scene();
  container.appendChild(renderer.domElement);

  camera = new THREE.PerspectiveCamera(
    50,
    container.offsetWidth / container.offsetHeight,
    0.1,
    1000
  );

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  window.addEventListener("resize", onResize);
  onResize();
}

function onResize() {
  camera.aspect = container.offsetWidth / container.offsetHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.offsetWidth, container.offsetHeight);
}

// ═══════════════════════════════════════════════════════════════
// ELEMENTOS DE ESCENA AUXILIARES
// ═══════════════════════════════════════════════════════════════

let gridHelper, axesHelper, groundPlane;
let directionalLight, hemiLight, ambientLight;

function setupSceneLights() {
  directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(-5, 10, 7);
  scene.add(directionalLight);

  hemiLight = new THREE.HemisphereLight(0x8888dd, 0x443322, 0.4);
  scene.add(hemiLight);

  ambientLight = new THREE.AmbientLight(0x404040, 0.3);
  scene.add(ambientLight);
}

function setupSceneHelpers() {
  gridHelper = new THREE.GridHelper(200, 40, 0xcccccc, 0xeeeeee);
  scene.add(gridHelper);

  axesHelper = new THREE.AxesHelper(8);
  scene.add(axesHelper);

  // Plano de suelo sutil
  const groundGeo = new THREE.PlaneGeometry(200, 200);
  const groundMat = new THREE.MeshPhongMaterial({
    color: 0xf0f0f0,
    shininess: 0,
    transparent: true,
    opacity: 0.3,
  });
  groundPlane = new THREE.Mesh(groundGeo, groundMat);
  groundPlane.rotation.x = -Math.PI / 2;
  groundPlane.position.y = -0.05;
  scene.add(groundPlane);
}

// ═══════════════════════════════════════════════════════════════
// CAMBIAR VISTA
// ═══════════════════════════════════════════════════════════════

function switchView(viewName) {
  const view = VIEWS[viewName];
  if (!view) return;

  // Remover el objeto actual de la escena
  if (currentObject) {
    scene.remove(currentObject);
    // Limpiar geometrías y liberar memoria
    currentObject.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
      }
      if (child.isLight && child.parent) {
        child.parent.remove(child);
      }
    });
  }

  // Crear el nuevo objeto
  currentObject = view.build();
  scene.add(currentObject);

  // Posicionar la cámara para encuadrar
  const [px, py, pz] = view.camera.pos;
  const [tx, ty, tz] = view.camera.target;
  camera.position.set(px, py, pz);
  controls.target.set(tx, ty, tz);
  controls.update();

  // Actualizar título y descripción en la UI
  updateInfoPanel(view.title, view.description);

  // Actualizar iluminación
  updateLighting();
}

function updateLighting() {
  const isNight = params.noche;

  if (params.fondoBlanco && !isNight) {
    renderer.setClearColor(0xffffff);
  } else if (isNight) {
    renderer.setClearColor(0x111133);
  } else {
    renderer.setClearColor(0xccccee);
  }

  directionalLight.intensity = isNight ? 0.1 : 0.8;
  hemiLight.intensity = isNight ? 0.1 : 0.4;
  ambientLight.intensity = isNight ? 0.15 : 0.3;

  // Ventanas brillan de noche
  materials["window"].emissive = new THREE.Color().setHSL(0.5, 0, isNight ? 1 : 0);

  // Grilla y ejes
  gridHelper.visible = params.mostrarGrilla;
  axesHelper.visible = params.mostrarEjes;
  groundPlane.visible = params.mostrarGrilla;

  // Actualizar colores de grilla según fondo
  if (isNight) {
    gridHelper.material.color.setHex(0x333366);
    gridHelper.material.opacity = 0.3;
  } else {
    gridHelper.material.color.setHex(0xcccccc);
    gridHelper.material.opacity = 1;
  }
}

// ═══════════════════════════════════════════════════════════════
// PANEL DE INFORMACIÓN (overlay HTML)
// ═══════════════════════════════════════════════════════════════

function updateInfoPanel(title, description) {
  document.getElementById("info-title").textContent = title;
  document.getElementById("info-description").textContent = description;
}

// ═══════════════════════════════════════════════════════════════
// MENÚ (dat.gui)
// ═══════════════════════════════════════════════════════════════

function createMenu() {
  gui = new dat.GUI({ width: 300 });

  gui.add(params, "vista", Object.keys(VIEWS))
    .name("🔍 Vista")
    .onChange((value) => switchView(value));

  const displayFolder = gui.addFolder("Opciones de visualización");
  displayFolder.add(params, "fondoBlanco")
    .name("Fondo blanco")
    .onChange(() => updateLighting());

  displayFolder.add(params, "mostrarGrilla")
    .name("Mostrar grilla")
    .onChange(() => updateLighting());

  displayFolder.add(params, "mostrarEjes")
    .name("Mostrar ejes")
    .onChange(() => updateLighting());

  displayFolder.add(params, "noche")
    .name("🌙 Modo noche")
    .onChange(() => {
      updateLighting();
      // Refrescar vista para que las luces de los postes se vean
      switchView(params.vista);
    });

  displayFolder.open();
}

// ═══════════════════════════════════════════════════════════════
// LOOP DE ANIMACIÓN
// ═══════════════════════════════════════════════════════════════

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// ═══════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════

setupThreeJs();
setupSceneLights();
setupSceneHelpers();
createMenu();
switchView("Árbol");
animate();
