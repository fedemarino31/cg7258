import * as THREE from 'three';

import { DroneCamera } from './droneCamera.js';


// setup THREE.js

let renderer;
let camera;
let scene;

let droneCamera;
let dc;

let info = document.getElementById('info');

function setup() {
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    let container = document.getElementById('container3D');
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
    camera.position.set(100, 100, 100);
    camera.lookAt(0, 0, 0);

    //const controls = new OrbitControls( camera, renderer.domElement );
    renderer.setClearColor(0x000000);

    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    // Create Scene
    const size = 100;
    const divisions = 10;

    const gridHelper = new THREE.GridHelper(size, divisions);
    scene.add(gridHelper);

    const geometry = new THREE.SphereGeometry(500, 32, 32);
    const material = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        wireframe: true,
        side: THREE.DoubleSide,
    });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    let sphere2 = sphere.clone();
    sphere2.scale.set(4, 4, 4);
    sphere2.material = sphere2.material.clone();
    sphere2.material.color.set(0xff0000);

    scene.add(sphere2);


    dc = new DroneCamera(container, window.innerWidth / window.innerHeight, 65, scene);

    camera = dc.getCamera();

    window.onresize = onResize;
    onResize();
}

function onResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    dc.setAspect(window.innerWidth / window.innerHeight);
}

function render() {
    requestAnimationFrame(render);
    renderer.render(scene, camera);

    let st = dc.getState();

    let html = '';
    for (var [key, value] of Object.entries(st)) {
        html += key + ':' + value + ' <br>';
    }
    info.innerHTML = html;

    dc.update();
}

setup();
render();
