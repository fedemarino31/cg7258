/**
 * ============================================================================
 * cityParts.js — Piezas individuales de la ciudad (para Showcase)
 * ============================================================================
 *
 * Este módulo exporta funciones independientes para crear cada pieza
 * de la ciudad: árboles, postes de luz, casas, lotes y el barrio completo.
 *
 * Es una adaptación del módulo cityGenerator.js original, con las
 * funciones de creación expuestas individualmente como exports para
 * poder usarlas en la aplicación Showcase (generador de vistas para
 * capturas de pantalla).
 *
 * JERARQUÍA DE PIEZAS (de menor a mayor complejidad):
 *   Nivel 1 — createTree(), createLampPost(), createPark()
 *   Nivel 2 — createHouse()
 *   Nivel 3 — createLot()
 *   Nivel 4 — createNeighborhood()
 *
 * ============================================================================
 */

import * as THREE from "three";

// ═══════════════════════════════════════════════════════════════
// GENERADOR PSEUDO-ALEATORIO DETERMINISTA
// ═══════════════════════════════════════════════════════════════

let randomCounter = 0;
const RANDOM_SEED_A = 49823.3232;
const RANDOM_SEED_B = 92733.112;

/** Resetea el generador aleatorio para obtener secuencias reproducibles */
export function resetRandom() {
  randomCounter = 0;
}

function randomInteger(from, to) {
  const value = from + Math.floor((0.5 + 0.5 * Math.sin(randomCounter * RANDOM_SEED_A)) * (to - from));
  randomCounter += value;
  return value;
}

function randomFloat(from, to) {
  const value = from + (0.5 + 0.5 * Math.sin(randomCounter * RANDOM_SEED_B)) * (to - from);
  randomCounter += value;
  return value;
}

function hslColor(hue, saturation, lightness) {
  const color = new THREE.Color();
  color.setHSL(hue, saturation, lightness);
  return parseInt("0x" + color.getHexString());
}

// ═══════════════════════════════════════════════════════════════
// MATERIALES COMPARTIDOS
// ═══════════════════════════════════════════════════════════════

export const materials = {
  ground: new THREE.MeshPhongMaterial({ color: 0x887755, name: "ground" }),
  trunk: new THREE.MeshPhongMaterial({ color: 0x996611, name: "trunk" }),
  foliage1: new THREE.MeshPhongMaterial({ color: 0x009900, name: "foliage1" }),
  foliage2: new THREE.MeshPhongMaterial({ color: 0x11aa00, name: "foliage2" }),
  foliage3: new THREE.MeshPhongMaterial({ color: 0x008811, name: "foliage3" }),
  house1: new THREE.MeshPhongMaterial({ color: 0xffcccc, name: "house1" }),
  house2: new THREE.MeshPhongMaterial({ color: 0xffccff, name: "house2" }),
  house3: new THREE.MeshPhongMaterial({ color: 0xccffcc, name: "house3" }),
  floor: new THREE.MeshPhongMaterial({ color: 0x444444, name: "floor" }),
  window: new THREE.MeshPhongMaterial({ color: 0x9999ff, emissive: 0xffffff, shininess: 64, name: "window" }),
  roof: new THREE.MeshPhongMaterial({ color: 0x993333, shininess: 2, name: "roof" }),
  door: new THREE.MeshPhongMaterial({ color: 0xcccccc, shininess: 2, name: "door" }),
  grass: new THREE.MeshPhongMaterial({ color: 0x33ff63, name: "grass" }),
  post: new THREE.MeshPhongMaterial({ color: 0x222222, shininess: 64, name: "post" }),
  light1: new THREE.MeshPhongMaterial({ emissive: 0xffff00, name: "light1" }),
  light2: new THREE.MeshPhongMaterial({ emissive: 0xff00ff, name: "light2" }),
  light3: new THREE.MeshPhongMaterial({ emissive: 0x77ffff, name: "light3" }),
  light4: new THREE.MeshPhongMaterial({ emissive: 0xff5577, name: "light4" }),
  light5: new THREE.MeshPhongMaterial({ emissive: 0x7777ff, name: "light5" }),
};

// ═══════════════════════════════════════════════════════════════
// NIVEL 1: PIEZAS ELEMENTALES
// ═══════════════════════════════════════════════════════════════

/**
 * Crea un árbol: tronco cilíndrico + copa esférica.
 * @param {number} height — Altura del tronco.
 * @param {number} diameter — Diámetro de la copa.
 * @returns {THREE.Group}
 */
export function createTree(height, diameter) {
  const tree = new THREE.Group();

  const foliageGeometry = new THREE.SphereGeometry(diameter / 2, 32, 16);
  const foliageMaterial = materials["foliage" + randomInteger(1, 3)];
  const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
  foliage.position.set(0, height, 0);

  const trunkDiameter = Math.max(0.1, diameter * 0.1);
  const trunkGeometry = new THREE.CylinderGeometry(trunkDiameter / 2, trunkDiameter, height, 32);
  trunkGeometry.translate(0, height / 2, 0);
  const trunk = new THREE.Mesh(trunkGeometry, materials["trunk"]);

  tree.add(trunk);
  tree.add(foliage);
  return tree;
}

/**
 * Crea un poste de luz: poste cilíndrico + esfera emisiva + PointLight.
 * @param {number} height — Altura del poste.
 * @param {number} [intensity=0.3] — Intensidad de la luz.
 * @returns {THREE.Group}
 */
export function createLampPost(height, intensity) {
  if (!intensity) intensity = 0.3;
  const lampPost = new THREE.Group();

  const postGeometry = new THREE.CylinderGeometry(0.1, 0.1, height, 12);
  postGeometry.translate(0, height / 2, 0);
  const post = new THREE.Mesh(postGeometry, materials["post"]);

  const lampGeometry = new THREE.SphereGeometry(0.3, 32, 16);
  const lightMaterial = materials["light" + randomInteger(1, 5)];
  const lamp = new THREE.Mesh(lampGeometry, lightMaterial);
  lamp.position.set(0, height, 0);

  lampPost.add(post);
  lampPost.add(lamp);

  const light = new THREE.PointLight(lightMaterial.emissive, intensity, 10, 1);
  light.position.set(0, height, 0);
  lampPost.add(light);

  return lampPost;
}

/**
 * Crea un parche de césped rectangular.
 * @param {number} width — Ancho (eje X).
 * @param {number} length — Largo (eje Z).
 * @returns {THREE.Mesh}
 */
export function createPark(width, length) {
  const parkGeometry = new THREE.BoxGeometry(width, 0.05, length);
  return new THREE.Mesh(parkGeometry, materials["grass"]);
}

// ═══════════════════════════════════════════════════════════════
// NIVEL 2: PIEZAS COMPUESTAS
// ═══════════════════════════════════════════════════════════════

/**
 * Crea una casa/edificio con múltiples pisos, techo, ventanas y puerta.
 * @param {number} floors — Cantidad de pisos.
 * @param {number} frontWidth — Ancho del frente.
 * @returns {THREE.Group}
 */
export function createHouse(floors, frontWidth) {
  if (!floors) floors = 1;
  const house = new THREE.Group();
  const floorHeight = 4;

  const bodyGeometry = new THREE.BoxGeometry(frontWidth, floorHeight, 10);
  bodyGeometry.translate(0, floorHeight / 2, 0);
  const bodyMesh = new THREE.Mesh(bodyGeometry, materials["house" + randomInteger(1, 3)]);

  const roofGeometry = new THREE.BoxGeometry(frontWidth + 1, 0.5, 11);
  const roofPanel = new THREE.Mesh(roofGeometry, materials["roof"]);
  roofPanel.position.set(0, floorHeight * floors, 0);
  house.add(roofPanel);

  const windowGeometry = new THREE.BoxGeometry(3, 1.5, 0.1);
  windowGeometry.rotateY(Math.PI / 2);
  const windowTemplate = new THREE.Mesh(windowGeometry, materials["window"]);

  for (let i = 0; i < floors; i++) {
    const slabGeometry = new THREE.BoxGeometry(frontWidth + 1, 0.1, 11);
    const slab = new THREE.Mesh(slabGeometry, materials["floor"]);
    slab.position.set(0, floorHeight * i, 0);
    house.add(slab);

    const floorBody = bodyMesh.clone();
    floorBody.position.y = i * floorHeight;
    house.add(floorBody);

    const windowLeft = windowTemplate.clone();
    windowLeft.position.set(-frontWidth / 2 - 0.1, i * floorHeight + 2, 2);
    house.add(windowLeft);

    const windowRight = windowTemplate.clone();
    windowRight.position.set(+frontWidth / 2 + 0.1, i * floorHeight + 2, -2);
    house.add(windowRight);
  }

  const doorGeometry = new THREE.BoxGeometry(1, 2.2, 0.2);
  const door = new THREE.Mesh(doorGeometry, materials["door"]);
  door.position.set(0, 1.1, 5);
  house.add(door);

  return house;
}

// ═══════════════════════════════════════════════════════════════
// NIVEL 3: COMPOSICIÓN — EL LOTE
// ═══════════════════════════════════════════════════════════════

/**
 * Crea un lote urbano: casa + parque + postes de luz + árboles.
 * @returns {THREE.Group}
 */
export function createLot() {
  const lot = new THREE.Group();

  const house = createHouse(randomInteger(2, 10), randomFloat(3, 8));
  lot.add(house);

  const park = createPark(20, 20);
  lot.add(park);

  const lampPostHeight = randomFloat(2, 7);
  const numberOfLampPosts = randomInteger(1, 3);
  const lampPostLineSpacing = 16;
  const lampPostHue = randomFloat(0, 1);

  for (let i = 1; i <= numberOfLampPosts; i++) {
    const lampPost = createLampPost(lampPostHeight, 0.65);
    const lampPostSpacing = lampPostLineSpacing / numberOfLampPosts;
    lampPost.position.set(lampPostLineSpacing / 2 - i * lampPostSpacing, 0, 8);
    lot.add(lampPost);
  }

  for (let j = 0; j < 10; j++) {
    const treeHeight = randomFloat(3, 7);
    const treeDiameter = randomFloat(1, 4);
    const tree = createTree(treeHeight, treeDiameter);
    const offsetX = randomFloat(0, 2);
    tree.position.set(9 - offsetX, 0, 5 - j * 1);
    lot.add(tree);
  }

  return lot;
}

// ═══════════════════════════════════════════════════════════════
// NIVEL 4: REPETICIÓN — EL BARRIO
// ═══════════════════════════════════════════════════════════════

/**
 * Crea un barrio: dos filas de lotes enfrentados formando una calle.
 * @returns {THREE.Group}
 */
export function createNeighborhood() {
  const neighborhood = new THREE.Group();
  const streetDistance = 15;
  const lotSpacing = 22;
  const LOTS_PER_SIDE = 4;

  for (let i = -LOTS_PER_SIDE; i < LOTS_PER_SIDE; i++) {
    const lot = createLot();
    lot.position.set(i * lotSpacing, 0, -streetDistance);
    neighborhood.add(lot);
  }

  for (let i = -LOTS_PER_SIDE; i < LOTS_PER_SIDE; i++) {
    const lot = createLot();
    lot.position.set(i * lotSpacing, 0, streetDistance);
    lot.rotation.set(0, Math.PI, 0);
    neighborhood.add(lot);
  }

  return neighborhood;
}
