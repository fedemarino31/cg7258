import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { PhysicsSimulator } from './PhysicsSimulator.js';
import { Rover } from './Rover.js';
import { Lander } from './Lander.js';
import { CameraManager } from './CameraManager.js';

let scene, renderer, stats;
let physicsSimulator, rover, lander, cameraManager;

const TERRAIN_SIZE = 500;
const TERRAIN_RESOLUTION = 100;
const TERRAIN_MAX_HEIGHT = 12;


async function setupThree() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // entorno lunar: cielo negro

    const ambient = new THREE.HemisphereLight(0x222233, 0x111111, 1.2);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(50, 80, 30);
    scene.add(sun);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    scene.add(new THREE.AxesHelper(5));

    stats = new Stats();
    document.body.appendChild(stats.dom);

    window.addEventListener('resize', onWindowResize, false);
}

function loadHeightmapPixels(url, resolution) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = resolution;
            canvas.height = resolution;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, resolution, resolution);
            resolve(ctx.getImageData(0, 0, resolution, resolution).data);
        };
        img.onerror = reject;
        img.src = url;
    });
}

async function createTerrain() {
    const pixels = await loadHeightmapPixels('maps/lunar_heightmap.png', TERRAIN_RESOLUTION);

    const planeGeo = new THREE.PlaneGeometry(
        TERRAIN_SIZE, TERRAIN_SIZE,
        TERRAIN_RESOLUTION - 1, TERRAIN_RESOLUTION - 1
    );
    planeGeo.rotateX(-Math.PI / 2);

    const positions = planeGeo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const h = (pixels[i * 4] / 255) * TERRAIN_MAX_HEIGHT;
        positions.setY(i, h);
    }
    positions.needsUpdate = true;
    planeGeo.computeVertexNormals();

    // BufferGeometry plana para que RapierPhysics.addMesh la trate como trimesh
    // estático (los trimesh dinámicos no están soportados por Rapier).
    const terrainGeo = new THREE.BufferGeometry();
    terrainGeo.setAttribute('position', planeGeo.attributes.position);
    terrainGeo.setAttribute('normal', planeGeo.attributes.normal);
    terrainGeo.setAttribute('uv', planeGeo.attributes.uv);
    terrainGeo.setIndex(planeGeo.index);

    const material = new THREE.MeshPhongMaterial({
        color: 0x888888,
    });

    const terrain = new THREE.Mesh(terrainGeo, material);
    scene.add(terrain);

    // add edge geometry to visuallize the terrain mesh
    const edges = new THREE.EdgesGeometry(terrainGeo);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x222222 }));
    terrain.add(line);

    physicsSimulator.addRigidBody(terrain, 0, 0.1);
}

async function initPhysics() {
    // Plataformas estáticas: el Rover y el Lander aparecen unas pocas unidades
    // por encima de las suyas para que caigan suavemente sin rebotar mucho.
    const roverPlatformPos  = new THREE.Vector3(0,  6, 0);
    const landerPlatformPos = new THREE.Vector3(15, 8, 15);

    physicsSimulator = new PhysicsSimulator(
        {
            initialPosition: new THREE.Vector3(roverPlatformPos.x, roverPlatformPos.y + 3, roverPlatformPos.z),
            // Rover "pesado": más masa + suspensión muy amortiguada + agarre realista
            // para que no rebote ni vuelque al pasar montañas.
            mass: 80,
            suspensionStiffness: 40,
            suspensionCompression: 2.5,
            suspensionRelaxation: 2.5,
            maxSuspensionTravel: 0.4,
            frictionSlip: 5,
            accelerateForce: { min: -50, max: 150, step: 5 },
        },
        {},
        { skipGround: true } // el terreno heightmap reemplaza al piso plano por defecto
    );
    await physicsSimulator.initSimulation();

    await createTerrain();

    addPlatform(roverPlatformPos,  0x445566);
    addPlatform(landerPlatformPos, 0x556677);

    rover = new Rover(scene, physicsSimulator);
    lander = new Lander(scene, physicsSimulator, {
        initialPosition: new THREE.Vector3(landerPlatformPos.x, landerPlatformPos.y + 6, landerPlatformPos.z),
    });

    cameraManager = new CameraManager(renderer, scene, { rover, lander });

    addObstacles();
}

function addPlatform(position, color) {
    const geo = new THREE.BoxGeometry(10, 2, 10);
    const mat = new THREE.MeshPhongMaterial({ color });
    const platform = new THREE.Mesh(geo, mat);
    platform.position.copy(position);
    scene.add(platform);
    physicsSimulator.addRigidBody(platform, 0, 0.3);
}

function addObstacles() {
    const columnGeo = new THREE.CylinderGeometry(2, 2, 10, 16);
    columnGeo.translate(0, 5, 0);
    const column = new THREE.Mesh(columnGeo, new THREE.MeshPhongMaterial({ color: 0xFF9900 }));
    column.position.set(-15, 5, 0);
    scene.add(column);
    physicsSimulator.addRigidBody(column, 0, 0.01);

    const rampGeo = new THREE.BoxGeometry(20, 6, 40);
    const ramp = new THREE.Mesh(rampGeo, new THREE.MeshPhongMaterial({ color: 0x999999 }));
    ramp.position.set(0,  5, -30);
    ramp.rotation.x = Math.PI / 12;
    scene.add(ramp);
    physicsSimulator.addRigidBody(ramp);
}

function onWindowResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    physicsSimulator.update();
    rover.update();
    lander.update();
    cameraManager.update();

    renderer.render(scene, cameraManager.camera);
    stats.update();
}

async function start() {
    await setupThree();
    await initPhysics();
    renderer.setAnimationLoop(animate);
}

start();
