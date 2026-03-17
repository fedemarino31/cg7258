/**
 * ============================================================================
 * cityGenerator.js — Generador Procedural de Ciudad 3D
 * ============================================================================
 *
 * Este módulo contiene toda la lógica para crear una ciudad 3D de forma
 * procedural usando Three.js. El propósito didáctico principal es mostrar
 * cómo se construye una escena compleja a partir de piezas simples,
 * utilizando THREE.Group como contenedor jerárquico.
 *
 * JERARQUÍA DE LA ESCENA:
 * ─────────────────────────────────────────────────────────────────
 *
 *  Scene (escena raíz)
 *   ├── GridHelper (grilla de referencia)
 *   ├── DirectionalLight (luz del sol)
 *   ├── HemisphereLight (luz ambiental cielo/suelo)
 *   │
 *   └── cityContainer (Group — contenedor de toda la ciudad)
 *        ├── AxesHelper (ejes de referencia)
 *        ├── Ground (Mesh — plano del suelo)
 *        │
 *        └── Lot/Manzana (Group × 16 — repetido con distintas transformaciones)
 *             ├── House (Group — casa con N pisos)
 *             │    ├── Floor Body (Mesh × N — cuerpo de cada piso, clonado)
 *             │    ├── Floor Slab (Mesh × N — losa de entrepiso)
 *             │    ├── Windows (Mesh × 2N — ventanas laterales, clonadas)
 *             │    ├── Roof (Mesh — techo)
 *             │    └── Door (Mesh — puerta)
 *             │
 *             ├── Park (Mesh — césped)
 *             │
 *             ├── LampPost (Group × N — postes de luz)
 *             │    ├── Post (Mesh — cilindro del poste)
 *             │    ├── Lamp (Mesh — esfera luminosa)
 *             │    └── PointLight (luz puntual, solo de noche)
 *             │
 *             └── Tree (Group × 10 — árboles)
 *                  ├── Trunk (Mesh — tronco cilíndrico)
 *                  └── Foliage (Mesh — copa esférica)
 *
 * NIVELES DE COMPLEJIDAD:
 *   Nivel 1 — Piezas elementales: Tree, LampPost (un Group con 2-3 meshes)
 *   Nivel 2 — Piezas compuestas: House (un Group con sub-componentes repetidos)
 *   Nivel 3 — Composición: Lot (un Group que agrupa varias piezas de nivel 1 y 2)
 *   Nivel 4 — Repetición: Neighborhood (clona lotes con transformaciones)
 *
 * NOTA SOBRE OPTIMIZACIÓN:
 *   Al final de la generación, se ejecuta mergeGeometries() que fusiona
 *   todas las geometrías por material en pocos meshes. Esto mejora el
 *   rendimiento pero DESTRUYE la jerarquía de Groups. Es una optimización
 *   avanzada, separada del concepto principal de la demo.
 *
 * ============================================================================
 */

import * as THREE from "three";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";

export class CityGenerator {
  /**
   * Constructor del generador de ciudad.
   *
   * @param {THREE.Scene} scene — La escena de Three.js donde se agregará la ciudad.
   * @param {THREE.WebGLRenderer} renderer — El renderer, necesario para cambiar el color de fondo.
   */
  constructor(scene, renderer) {
    this._scene = scene;
    this._renderer = renderer;

    // ── Estado interno ──────────────────────────────────────────

    /** Contenedor raíz de toda la ciudad (THREE.Group) */
    this._cityContainer = null;

    /** Factor día/noche: 0 = día, 1 = noche */
    this._dayNightValue = 0;

    /** Lista de PointLights creadas para los postes de luz */
    this._lights = [];

    /** Luces principales de la escena */
    this._directionalLight = null;
    this._hemiLight = null;

    // ── Generador pseudo-aleatorio determinista ─────────────────
    // Usamos una función seno con semillas para generar números
    // pseudo-aleatorios que siempre producen la misma secuencia.
    // Esto garantiza que la ciudad se vea igual cada vez que se genera.
    this._randomCounter = 0;
    this._RANDOM_SEED_A = 49823.3232;
    this._RANDOM_SEED_B = 92733.112;

    // ── Colores del cielo para interpolar día/noche ─────────────
    this._skyDay = new THREE.Color(0xccccff);
    this._skyNight = new THREE.Color(0x222299);

    // ── Materiales compartidos ──────────────────────────────────
    // Todos los meshes de la ciudad usan materiales de este diccionario.
    // Compartir materiales (en lugar de crear uno nuevo por cada mesh)
    // es una buena práctica que mejora el rendimiento y facilita
    // cambios globales (por ejemplo, cambiar el color de todas las ventanas).
    this._materials = {
      // Suelo
      ground: new THREE.MeshPhongMaterial({ color: 0x887755, name: "ground" }),

      // Árboles
      trunk: new THREE.MeshPhongMaterial({ color: 0x996611, name: "trunk" }),
      foliage1: new THREE.MeshPhongMaterial({ color: 0x009900, name: "foliage1" }),
      foliage2: new THREE.MeshPhongMaterial({ color: 0x11aa00, name: "foliage2" }),
      foliage3: new THREE.MeshPhongMaterial({ color: 0x008811, name: "foliage3" }),

      // Casas — paredes
      house1: new THREE.MeshPhongMaterial({ color: 0xffcccc, name: "house1" }),
      house2: new THREE.MeshPhongMaterial({ color: 0xffccff, name: "house2" }),
      house3: new THREE.MeshPhongMaterial({ color: 0xccffcc, name: "house3" }),

      // Casas — pisos, techo, puerta, ventanas
      floor: new THREE.MeshPhongMaterial({ color: 0x444444, name: "floor" }),
      window: new THREE.MeshPhongMaterial({
        color: 0x9999ff,
        emissive: 0xffffff,
        shininess: 64,
        name: "window",
      }),
      roof: new THREE.MeshPhongMaterial({ color: 0x993333, shininess: 2, name: "roof" }),
      door: new THREE.MeshPhongMaterial({ color: 0xcccccc, shininess: 2, name: "door" }),

      // Parque — césped
      grass: new THREE.MeshPhongMaterial({ color: 0x33ff63, name: "grass" }),

      // Postes de luz
      post: new THREE.MeshPhongMaterial({ color: 0x222222, shininess: 64, name: "post" }),

      // Lámparas — materiales emisivos (brillan por sí mismos)
      light1: new THREE.MeshPhongMaterial({ emissive: 0xffff00, name: "light1" }),
      light2: new THREE.MeshPhongMaterial({ emissive: 0xff00ff, name: "light2" }),
      light3: new THREE.MeshPhongMaterial({ emissive: 0x77ffff, name: "light3" }),
      light4: new THREE.MeshPhongMaterial({ emissive: 0xff5577, name: "light4" }),
      light5: new THREE.MeshPhongMaterial({ emissive: 0x7777ff, name: "light5" }),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // PROPIEDAD PÚBLICA: dayNightFactor
  // ═══════════════════════════════════════════════════════════════

  /**
   * Factor de transición día/noche.
   * - 0 = pleno día (cielo claro, luces apagadas)
   * - 1 = plena noche (cielo oscuro, luces encendidas)
   *
   * Al cambiar este valor, se actualiza automáticamente la iluminación,
   * el color del cielo y la emisividad de las ventanas.
   */
  get dayNightFactor() {
    return this._dayNightValue;
  }

  set dayNightFactor(value) {
    this._dayNightValue = value;
    this._updateDayNight();
  }

  // ═══════════════════════════════════════════════════════════════
  // MÉTODO PÚBLICO: generate()
  // ═══════════════════════════════════════════════════════════════

  /**
   * Genera (o regenera) la ciudad completa.
   *
   * Este es el punto de entrada principal. Ejecuta los siguientes pasos:
   * 1. Crea el escenario base (suelo, luces)
   * 2. Construye el barrio (composición de lotes con casas, árboles, postes)
   * 3. Optimiza fusionando geometrías por material
   * 4. Aplica el estado actual de día/noche
   */
  generate() {
    // Si ya existía una ciudad previa, la removemos de la escena
    if (this._cityContainer) {
      this._scene.remove(this._cityContainer);
    }

    // Crear el contenedor raíz de la ciudad (un THREE.Group vacío)
    this._cityContainer = new THREE.Group();

    // Resetear el contador del generador pseudo-aleatorio
    this._randomCounter = 0;
    this._lights = [];

    // Paso 1: Crear el escenario (suelo + luces globales)
    this._buildScenario();

    // Paso 2: Construir el barrio (lotes con casas, árboles, postes)
    this._buildNeighborhood();

    // Paso 3: Optimización — fusionar geometrías por material
    this._mergeGeometries();

    // Paso 4: Aplicar iluminación según el factor día/noche actual
    this._updateDayNight();
  }

  // ═══════════════════════════════════════════════════════════════
  // FUNCIONES UTILITARIAS (privadas)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Genera un número entero pseudo-aleatorio determinista en el rango [from, to].
   *
   * Usa una función seno con una semilla fija, lo que garantiza que la
   * secuencia de números sea siempre la misma. Esto es útil para que la
   * ciudad generada sea reproducible.
   *
   * @param {number} from — Valor mínimo (incluido).
   * @param {number} to — Valor máximo (incluido).
   * @returns {number} Entero pseudo-aleatorio entre from y to.
   */
  _randomInteger(from, to) {
    const value = from + Math.floor((0.5 + 0.5 * Math.sin(this._randomCounter * this._RANDOM_SEED_A)) * (to - from));
    this._randomCounter += value;
    return value;
  }

  /**
   * Genera un número decimal pseudo-aleatorio determinista en el rango [from, to].
   *
   * Similar a _randomInteger pero devuelve un float sin redondear.
   *
   * @param {number} from — Valor mínimo.
   * @param {number} to — Valor máximo.
   * @returns {number} Float pseudo-aleatorio entre from y to.
   */
  _randomFloat(from, to) {
    const value = from + (0.5 + 0.5 * Math.sin(this._randomCounter * this._RANDOM_SEED_B)) * (to - from);
    this._randomCounter += value;
    return value;
  }

  /**
   * Crea un color THREE.Color a partir de valores HSL.
   *
   * HSL (Hue, Saturation, Lightness) es un modelo de color más intuitivo
   * que RGB para generar variaciones de color procedurales.
   *
   * @param {number} hue — Tono (0 a 1, donde 0=rojo, 0.33=verde, 0.66=azul).
   * @param {number} saturation — Saturación (0=gris, 1=color puro).
   * @param {number} lightness — Luminosidad (0=negro, 0.5=normal, 1=blanco).
   * @returns {number} Color en formato hexadecimal para Three.js.
   */
  _hslColor(hue, saturation, lightness) {
    const color = new THREE.Color();
    color.setHSL(hue, saturation, lightness);
    return parseInt("0x" + color.getHexString());
  }

  // ═══════════════════════════════════════════════════════════════
  // ESCENARIO BASE (suelo y luces globales)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Construye los elementos base de la escena: suelo, ejes de referencia
   * y luces globales (sol y luz ambiental).
   *
   * Estos elementos NO son parte de la jerarquía de la ciudad en sí,
   * sino el "escenario" sobre el cual se construye todo lo demás.
   */
  _buildScenario() {
    // Ejes de referencia (rojo=X, verde=Y, azul=Z)
    const axesHelper = new THREE.AxesHelper(5);
    this._cityContainer.add(axesHelper);

    // Suelo — un plano rotado para quedar horizontal (en el plano XZ)
    const groundGeometry = new THREE.PlaneGeometry(220, 80, 1, 1);
    const ground = new THREE.Mesh(groundGeometry, this._materials["ground"]);
    ground.rotation.x = -Math.PI / 2; // Rotar 90° para que quede horizontal
    ground.position.set(0, -0.1, 0);  // Ligeramente debajo del origen
    this._cityContainer.add(ground);

    // Luz direccional — simula la luz del sol
    // Ilumina toda la escena desde una dirección fija
    this._directionalLight = new THREE.DirectionalLight(0xeeeeff, 0.2);
    this._directionalLight.position.set(-1, 2, 3);

    // Luz hemisférica — simula la iluminación ambiental del cielo y el suelo
    // Primer color: luz que viene desde arriba (cielo)
    // Segundo color: luz que viene desde abajo (reflejo del suelo)
    this._hemiLight = new THREE.HemisphereLight(0x8888dd, 0x080866, 0.2);

    this._scene.add(this._directionalLight);
    this._scene.add(this._hemiLight);
  }

  // ═══════════════════════════════════════════════════════════════
  // NIVEL 1: PIEZAS ELEMENTALES
  // Cada una es un THREE.Group con 2-3 geometrías primitivas.
  // Son las "piezas de LEGO" más básicas de nuestra ciudad.
  // ═══════════════════════════════════════════════════════════════

  /**
   * Crea un árbol compuesto por un tronco cilíndrico y una copa esférica.
   *
   * Estructura del Group resultante:
   *   Tree (Group)
   *    ├── Trunk (Mesh — CylinderGeometry)
   *    └── Foliage (Mesh — SphereGeometry)
   *
   * @param {number} height — Altura del tronco.
   * @param {number} diameter — Diámetro de la copa (esfera del follaje).
   * @returns {THREE.Group} Grupo que representa el árbol completo.
   */
  _createTree(height, diameter) {
    const tree = new THREE.Group();

    // Copa del árbol — esfera posicionada en la parte superior del tronco
    const foliageGeometry = new THREE.SphereGeometry(diameter / 2, 32, 16);
    const foliageMaterial = this._materials["foliage" + this._randomInteger(1, 3)];
    const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
    foliage.position.set(0, height, 0); // Elevar al tope del tronco

    // Tronco — cilindro centrado verticalmente
    const trunkDiameter = Math.max(0.1, diameter * 0.1);
    const trunkGeometry = new THREE.CylinderGeometry(
      trunkDiameter / 2, // radio superior
      trunkDiameter,      // radio inferior (más ancho en la base)
      height,             // altura
      32                  // segmentos radiales
    );
    // translate() mueve la geometría para que la base quede en Y=0
    trunkGeometry.translate(0, height / 2, 0);
    const trunk = new THREE.Mesh(trunkGeometry, this._materials["trunk"]);

    // Agregar ambas partes al grupo del árbol
    tree.add(trunk);
    tree.add(foliage);

    return tree;
  }

  /**
   * Crea un poste de luz compuesto por un poste cilíndrico, una esfera
   * luminosa en la punta y opcionalmente una luz puntual (PointLight).
   *
   * Estructura del Group resultante:
   *   LampPost (Group)
   *    ├── Post (Mesh — CylinderGeometry)
   *    ├── Lamp (Mesh — SphereGeometry con material emisivo)
   *    └── PointLight (luz puntual — ilumina objetos cercanos)
   *
   * @param {number} height — Altura del poste.
   * @param {number} [intensity=0.3] — Intensidad de la luz puntual.
   * @param {number} [color] — Color de la luz (no usado directamente, se elige al azar).
   * @returns {THREE.Group} Grupo que representa el poste de luz completo.
   */
  _createLampPost(height, intensity, color) {
    if (!intensity) intensity = 0.3;

    const lampPost = new THREE.Group();

    // Poste — cilindro delgado vertical
    const postGeometry = new THREE.CylinderGeometry(0.1, 0.1, height, 12);
    postGeometry.translate(0, height / 2, 0);
    const post = new THREE.Mesh(postGeometry, this._materials["post"]);

    // Lámpara — esfera luminosa en la punta del poste
    // Usa un material emisivo (brilla por sí mismo sin necesidad de luz externa)
    const lampGeometry = new THREE.SphereGeometry(0.3, 32, 16);
    const lightMaterial = this._materials["light" + this._randomInteger(1, 5)];
    const lamp = new THREE.Mesh(lampGeometry, lightMaterial);
    lamp.position.set(0, height, 0);

    lampPost.add(post);
    lampPost.add(lamp);

    // Luz puntual — ilumina los objetos cercanos con el color de la lámpara
    // PointLight emite luz en todas las direcciones desde un punto
    const light = new THREE.PointLight(
      lightMaterial.emissive, // color de la luz = color emisivo del material
      intensity,              // intensidad
      10,                     // distancia máxima de alcance
      1                       // decaimiento (1 = lineal)
    );
    light.position.set(0, height, 0);
    lampPost.add(light);

    return lampPost;
  }

  /**
   * Crea un parche de césped rectangular (parque).
   *
   * Es un mesh simple (no un Group), ya que solo tiene una geometría.
   *
   * @param {number} width — Ancho del parque (eje X).
   * @param {number} length — Largo del parque (eje Z).
   * @returns {THREE.Mesh} Mesh que representa el césped.
   */
  _createPark(width, length) {
    const parkGeometry = new THREE.BoxGeometry(width, 0.05, length);
    const park = new THREE.Mesh(parkGeometry, this._materials["grass"]);
    return park;
  }

  // ═══════════════════════════════════════════════════════════════
  // NIVEL 2: PIEZAS COMPUESTAS
  // Un Group con sub-componentes que se repiten internamente
  // (pisos clonados, ventanas por piso, etc.)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Crea una casa/edificio con múltiples pisos.
   *
   * Esta función demuestra cómo usar clone() para repetir elementos
   * (pisos, ventanas) dentro de un Group, aplicando diferentes
   * transformaciones (posición Y) a cada copia.
   *
   * Estructura del Group resultante:
   *   House (Group)
   *    ├── Floor Slab (Mesh × N — losas de entrepiso)
   *    ├── Floor Body (Mesh × N — cuerpo de cada piso, clonado)
   *    ├── Window Left (Mesh × N — ventana izquierda por piso, clonada)
   *    ├── Window Right (Mesh × N — ventana derecha por piso, clonada)
   *    ├── Roof (Mesh — techo en la parte superior)
   *    └── Door (Mesh — puerta en planta baja)
   *
   * @param {number} floors — Cantidad de pisos del edificio.
   * @param {number} frontWidth — Ancho del frente del edificio.
   * @returns {THREE.Group} Grupo que representa la casa completa.
   */
  _createHouse(floors, frontWidth) {
    if (!floors) floors = 1;

    const house = new THREE.Group();
    const floorHeight = 4; // Altura de cada piso en unidades

    // ── Geometría base del cuerpo de un piso ────────────────
    // Se crea UNA sola geometría y luego se CLONA para cada piso.
    // translate() mueve la geometría para que la base esté en Y=0.
    const bodyGeometry = new THREE.BoxGeometry(frontWidth, floorHeight, 10);
    bodyGeometry.translate(0, floorHeight / 2, 0);
    const bodyMesh = new THREE.Mesh(
      bodyGeometry,
      this._materials["house" + this._randomInteger(1, 3)]
    );

    // ── Techo — un panel ancho en la parte superior ─────────
    const roofGeometry = new THREE.BoxGeometry(frontWidth + 1, 0.5, 11);
    const roofPanel = new THREE.Mesh(roofGeometry, this._materials["roof"]);
    roofPanel.position.set(0, floorHeight * floors, 0);
    house.add(roofPanel);

    // ── Geometría base de una ventana ────────────────────────
    // Se crea UNA ventana y se clona, reposicionándola en cada piso.
    const windowGeometry = new THREE.BoxGeometry(3, 1.5, 0.1);
    windowGeometry.rotateY(Math.PI / 2); // Rotar para que quede en el lateral
    const windowTemplate = new THREE.Mesh(windowGeometry, this._materials["window"]);

    // ── Construir cada piso con un bucle ─────────────────────
    // Este bucle demuestra el patrón: crear → clonar → transformar → agregar
    for (let i = 0; i < floors; i++) {
      // Losa de entrepiso
      const slabGeometry = new THREE.BoxGeometry(frontWidth + 1, 0.1, 11);
      const slab = new THREE.Mesh(slabGeometry, this._materials["floor"]);
      slab.position.set(0, floorHeight * i, 0);
      house.add(slab);

      // Cuerpo del piso — CLONAR el mesh base y reposicionar
      const floorBody = bodyMesh.clone();
      floorBody.position.y = i * floorHeight;
      house.add(floorBody);

      // Ventana izquierda — CLONAR la ventana template
      const windowLeft = windowTemplate.clone();
      windowLeft.position.set(-frontWidth / 2 - 0.1, i * floorHeight + 2, 2);
      house.add(windowLeft);

      // Ventana derecha — CLONAR la ventana template
      const windowRight = windowTemplate.clone();
      windowRight.position.set(+frontWidth / 2 + 0.1, i * floorHeight + 2, -2);
      house.add(windowRight);
    }

    // ── Puerta — en la planta baja, centrada en el frente ───
    const doorGeometry = new THREE.BoxGeometry(1, 2.2, 0.2);
    const door = new THREE.Mesh(doorGeometry, this._materials["door"]);
    door.position.set(0, 1.1, 5);
    house.add(door);

    return house;
  }

  // ═══════════════════════════════════════════════════════════════
  // NIVEL 3: COMPOSICIÓN — EL LOTE (CITY BLOCK)
  // Agrupa varias piezas de nivel 1 y 2 en un conjunto coherente.
  // ═══════════════════════════════════════════════════════════════

  /**
   * Crea un lote urbano (manzana) compuesto por una casa, un parque,
   * postes de luz y árboles. Cada lote es único gracias a los
   * parámetros aleatorios.
   *
   * Estructura del Group resultante:
   *   Lot (Group)
   *    ├── House (Group — edificio de 2 a 10 pisos)
   *    ├── Park (Mesh — césped rectangular)
   *    ├── LampPost (Group × N — postes de luz distribuidos)
   *    └── Tree (Group × 10 — hilera de árboles laterales)
   *
   * @returns {THREE.Group} Grupo que representa el lote completo.
   */
  _createLot() {
    const lot = new THREE.Group();

    // Casa con pisos y ancho aleatorios
    const house = this._createHouse(
      this._randomInteger(2, 10),  // entre 2 y 10 pisos
      this._randomFloat(3, 8)      // frente entre 3 y 8 unidades
    );
    lot.add(house);

    // Parque (césped) debajo y alrededor de la casa
    const park = this._createPark(20, 20);
    lot.add(park);

    // ── Postes de luz — distribuidos a lo largo del lote ────
    const lampPostHeight = this._randomFloat(2, 7);
    const numberOfLampPosts = this._randomInteger(1, 3);
    const lampPostLineSpacing = 16;
    const lampPostHue = this._randomFloat(0, 1); // tono aleatorio para la luz

    for (let i = 1; i <= numberOfLampPosts; i++) {
      const lampPost = this._createLampPost(
        lampPostHeight,
        0.65,
        this._hslColor(lampPostHue, 1, 0.75)
      );
      const lampPostSpacing = lampPostLineSpacing / numberOfLampPosts;
      lampPost.position.set(
        lampPostLineSpacing / 2 - i * lampPostSpacing,
        0,
        8  // posición en Z (al frente del lote)
      );
      lot.add(lampPost);
    }

    // ── Árboles — hilera lateral de 10 árboles ─────────────
    for (let j = 0; j < 10; j++) {
      const treeHeight = this._randomFloat(3, 7);
      const treeDiameter = this._randomFloat(1, 4);

      const tree = this._createTree(treeHeight, treeDiameter);

      const offsetX = this._randomFloat(0, 2);
      tree.position.set(9 - offsetX, 0, 5 - j * 1);
      lot.add(tree);
    }

    return lot;
  }

  // ═══════════════════════════════════════════════════════════════
  // NIVEL 4: REPETICIÓN — EL BARRIO
  // Instancia múltiples lotes con distintas transformaciones
  // (posición y rotación) para formar una calle completa.
  // ═══════════════════════════════════════════════════════════════

  /**
   * Construye un barrio compuesto por dos filas de lotes enfrentados,
   * simulando una calle.
   *
   * - Fila norte: lotes sin rotar, mirando hacia el sur.
   * - Fila sur: lotes rotados 180° (Math.PI), mirando hacia el norte.
   *
   * Cada lote se genera con parámetros aleatorios diferentes, lo que
   * produce variedad visual (distintas alturas de edificios, colores,
   * cantidad de árboles, etc.)
   *
   * En total se crean 16 lotes (8 por fila, con TOTAL=4 → rango [-4, 4)).
   */
  _buildNeighborhood() {
    const streetDistance = 15; // Distancia entre las dos filas (ancho de la calle)
    const lotSpacing = 22;    // Separación horizontal entre lotes
    const LOTS_PER_SIDE = 4;  // Cantidad de lotes a cada lado del centro

    // Fila norte — lotes orientados al sur (sin rotación)
    for (let i = -LOTS_PER_SIDE; i < LOTS_PER_SIDE; i++) {
      const lot = this._createLot();
      lot.position.set(i * lotSpacing, 0, -streetDistance);
      this._cityContainer.add(lot);
    }

    // Fila sur — lotes orientados al norte (rotación de 180°)
    for (let i = -LOTS_PER_SIDE; i < LOTS_PER_SIDE; i++) {
      const lot = this._createLot();
      lot.position.set(i * lotSpacing, 0, streetDistance);
      lot.rotation.set(0, Math.PI, 0); // Rotar 180° sobre el eje Y
      this._cityContainer.add(lot);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ILUMINACIÓN Y CICLO DÍA/NOCHE
  // ═══════════════════════════════════════════════════════════════

  /**
   * Actualiza todos los parámetros de iluminación según el valor
   * actual de dayNightFactor (0=día, 1=noche).
   *
   * Elementos que se modifican:
   * - Color del cielo (fondo del renderer): interpolación entre skyDay y skyNight
   * - Emisividad de las ventanas: brillan más de noche
   * - Intensidad de las PointLights de los postes: encendidas de noche
   * - Intensidad de la DirectionalLight (sol): apagada de noche
   * - Intensidad de la HemisphereLight (ambiental): se reduce de noche
   */
  _updateDayNight() {
    // Interpolar color del cielo entre día y noche usando lerp()
    // lerp = Linear Interpolation (mezcla lineal entre dos colores)
    const sky = this._skyDay.clone();
    sky.lerp(this._skyNight, this._dayNightValue);
    this._renderer.setClearColor(sky.getHex());

    // Las ventanas brillan (emissive) proporcionalmente a la noche
    this._materials["window"].emissive = new THREE.Color().setHSL(0.5, 0, this._dayNightValue);

    // Las luces puntuales de los postes se encienden de noche
    this._lights.forEach((light) => {
      light.intensity = this._dayNightValue * 0.6;
    });

    // La luz del sol se apaga de noche
    this._directionalLight.intensity = 1 - this._dayNightValue;

    // La luz ambiental se reduce de noche (pero nunca se apaga del todo)
    this._hemiLight.intensity = 0.1 + (1 - this._dayNightValue) * 0.3;
  }

  // ═══════════════════════════════════════════════════════════════
  // OPTIMIZACIÓN: FUSIÓN DE GEOMETRÍAS (merge)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Fusiona todas las geometrías de la ciudad agrupándolas por material.
   *
   * PROPÓSITO:
   * En su estado normal, la ciudad tiene cientos de meshes individuales.
   * Cada mesh genera un "draw call" (llamada al GPU), y muchos draw calls
   * reducen el rendimiento (FPS). Al fusionar todas las geometrías que
   * usan el mismo material en un solo mesh, se reduce drásticamente el
   * número de draw calls.
   *
   * CÓMO FUNCIONA:
   * 1. Recorre todos los meshes del cityContainer con traverse()
   * 2. Agrupa las geometrías por nombre de material
   * 3. Aplica la matriz de transformación mundial a cada geometría
   *    (para "hornear" la posición/rotación/escala)
   * 4. Fusiona cada grupo con mergeGeometries()
   * 5. Crea nuevos meshes con las geometrías fusionadas
   * 6. Extrae las PointLights y las reasigna a la escena
   *
   * NOTA IMPORTANTE:
   * Este proceso DESTRUYE la jerarquía de Groups que construimos
   * en los pasos anteriores. Los Groups se reemplazan por unos pocos
   * meshes "aplanados". Esto es una optimización de rendimiento,
   * NO es parte del concepto de jerarquía que enseña esta demo.
   */
  _mergeGeometries() {
    const geometriesByMaterial = {};

    // Actualizar las matrices de transformación globales de todos los objetos
    this._cityContainer.updateMatrixWorld(true, true);

    // Recorrer TODOS los objetos del cityContainer recursivamente
    this._cityContainer.traverse((obj) => {
      if (obj.isMesh) {
        // Obtener la geometría y convertir a no-indexada si es necesario
        const geometry = obj.geometry.index
          ? obj.geometry.toNonIndexed()
          : obj.geometry.clone();

        // Agrupar por nombre de material
        const materialName = obj.material.name;
        if (!geometriesByMaterial.hasOwnProperty(materialName)) {
          geometriesByMaterial[materialName] = [];
        }

        // "Hornear" la transformación global en la geometría
        geometry.applyMatrix4(obj.matrixWorld);
        geometriesByMaterial[materialName].push(geometry);
      }

      // Guardar las luces para reasignarlas después
      if (obj.isLight) {
        this._lights.push(obj);
      }
    });

    // Crear un mesh fusionado por cada material
    for (const [materialName, geometryList] of Object.entries(geometriesByMaterial)) {
      const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometryList, true);
      mergedGeometry.applyMatrix4(this._cityContainer.matrix.clone().invert());
      const mesh = new THREE.Mesh(mergedGeometry, this._materials[materialName]);
      this._scene.add(mesh);
    }

    // Reasignar las luces directamente a la escena
    // (ya que el cityContainer original se destruye al fusionar)
    this._lights.forEach((light) => {
      const position = light.getWorldPosition(new THREE.Vector3());
      if (light.parent) light.parent.remove(light);
      light.position.copy(position);
      this._scene.add(light);
    });
  }
}
