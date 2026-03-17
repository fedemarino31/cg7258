/**
 * ============================================================================
 * main.js — Punto de entrada de la aplicación "Demo Ciudad"
 * ============================================================================
 *
 * Este archivo inicializa los componentes fundamentales de una aplicación
 * Three.js y lanza la generación procedural de la ciudad.
 *
 * FLUJO DE EJECUCIÓN:
 *   1. setupThreeJs()  → Crear renderer, escena, cámara y controles
 *   2. buildScene()    → Instanciar el CityGenerator y generar la ciudad
 *   3. createMenu()    → Crear la interfaz de usuario (GUI) con dat.gui
 *   4. animate()       → Iniciar el loop de renderizado (se repite cada frame)
 *
 * CONCEPTOS CLAVE PARA ALUMNOS:
 *   - Scene: el contenedor raíz de todos los objetos 3D
 *   - Camera: define el punto de vista (perspectiva en este caso)
 *   - Renderer: dibuja la escena vista desde la cámara en el canvas HTML
 *   - requestAnimationFrame: repite el renderizado ~60 veces por segundo
 *   - OrbitControls: permite rotar, hacer zoom y desplazar la cámara con el mouse
 *
 * ============================================================================
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { CityGenerator } from "./cityGenerator.js";
import * as dat from "dat.gui";

// Variables globales del módulo
let scene, camera, renderer, container, cityGenerator;

/**
 * Configura los componentes básicos de Three.js: renderer, escena, cámara
 * y controles orbitales.
 *
 * El renderer se vincula al div HTML con id="container3D", que actúa
 * como el "lienzo" donde se dibuja la escena 3D.
 */
function setupThreeJs() {
  // Obtener el contenedor HTML donde se insertará el canvas 3D
  container = document.getElementById("container3D");

  // Crear el renderer (WebGL) — es el motor que dibuja en pantalla
  renderer = new THREE.WebGLRenderer();

  // Crear la escena — el "mundo" donde viven todos los objetos 3D
  scene = new THREE.Scene();

  // Insertar el canvas del renderer dentro del contenedor HTML
  container.appendChild(renderer.domElement);

  // Crear la cámara en perspectiva (simula la visión humana)
  //   - 75: campo de visión en grados (FOV — Field of View)
  //   - aspect ratio: proporción ancho/alto del contenedor
  //   - 0.1: plano near (objetos más cercanos que esto no se ven)
  //   - 1000: plano far (objetos más lejanos que esto no se ven)
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  // Posicionar la cámara en una vista elevada y lateral
  camera.position.set(80, 50, 60);
  camera.lookAt(0, 0, 0); // Apuntar al centro de la escena

  // Controles orbitales — permiten al usuario rotar, hacer zoom
  // y desplazar la cámara con el mouse
  const controls = new OrbitControls(camera, renderer.domElement);

  // Escuchar el evento de redimensionamiento de la ventana
  window.addEventListener("resize", onResize);
  onResize(); // Llamar una vez para ajustar el tamaño inicial
}

/**
 * Construye el contenido de la escena 3D.
 *
 * Agrega un GridHelper (grilla de referencia en el suelo) e instancia
 * el CityGenerator para crear toda la ciudad procedural.
 */
function buildScene() {
  // Grilla de referencia — ayuda a visualizar el suelo y las distancias
  //   - 500: tamaño total de la grilla
  //   - 50: cantidad de divisiones
  const gridHelper = new THREE.GridHelper(500, 50);
  scene.add(gridHelper);

  // Crear el generador de ciudad, pasándole la escena y el renderer
  cityGenerator = new CityGenerator(scene, renderer);

  // Generar la ciudad (crea todos los objetos 3D y los agrega a la escena)
  cityGenerator.generate();

  // Inicializar en modo día (0 = día, 1 = noche)
  cityGenerator.dayNightFactor = 0;
}

/**
 * Crea la interfaz gráfica de usuario (GUI) usando dat.gui.
 *
 * dat.gui genera automáticamente controles (sliders, checkboxes, etc.)
 * vinculados a propiedades de objetos JavaScript.
 */
function createMenu() {
  const gui = new dat.GUI();
  // Slider para el factor día/noche (0 a 1, paso de 0.01)
  gui.add(cityGenerator, "dayNightFactor", 0, 1, 0.01);
}

/**
 * Callback para el evento de redimensionamiento de la ventana.
 *
 * Recalcula el aspect ratio de la cámara y actualiza el tamaño
 * del renderer para que siempre ocupe todo el contenedor.
 */
function onResize() {
  camera.aspect = container.offsetWidth / container.offsetHeight;
  camera.updateProjectionMatrix(); // Necesario tras cambiar el aspect ratio

  renderer.setSize(container.offsetWidth, container.offsetHeight);
}

/**
 * Loop principal de animación — se ejecuta ~60 veces por segundo.
 *
 * requestAnimationFrame() programa la próxima ejecución de animate()
 * sincronizada con la tasa de refresco del monitor. Luego se renderiza
 * la escena vista desde la cámara actual.
 */
function animate() {
  requestAnimationFrame(animate);

  // Dibujar la escena vista desde la cámara
  renderer.render(scene, camera);
}

// ═══════════════════════════════════════════════════════════════
// INICIALIZACIÓN — Se ejecuta al cargar el módulo
// ═══════════════════════════════════════════════════════════════

setupThreeJs();  // 1. Configurar Three.js
buildScene();    // 2. Construir la ciudad
createMenu();    // 3. Crear la GUI
animate();       // 4. Iniciar el loop de renderizado
