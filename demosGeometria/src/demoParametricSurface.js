import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildExtrudedStar } from './buildExtrudedStar.js';
import { VertexNormalsHelper } from 'three/addons/helpers/VertexNormalsHelper.js';


import { ParametricSurfaceGeometry } from './ParametricSurfaceGeometry.js';
import * as dat from 'dat.gui';
let scene, camera, renderer, container, group;


function setupThreeJs() {
	container = document.getElementById('container3D');

	renderer = new THREE.WebGLRenderer();
	renderer.setClearColor(0x666666);
	scene = new THREE.Scene();

	container.appendChild(renderer.domElement);

	camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
	camera.position.set(8, 5, 2);
	camera.lookAt(0, 0, 0);

	const controls = new OrbitControls(camera, renderer.domElement);

	const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
	directionalLight.position.set(1, 1, 1);
	scene.add(directionalLight);

	directionalLight.position.set(-2, 2, 1);

	const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x000000, 0.5);
	scene.add(hemisphereLight);

	let pointLight = new THREE.PointLight(0xffffff, 1);
	pointLight.position.set(0, 5, 0);
	scene.add(pointLight);

	const gridHelper = new THREE.GridHelper(20, 10);
	gridHelper.position.y = -1;
	scene.add(gridHelper);

	window.addEventListener('resize', onResize);
	onResize();
}

function onResize() {
	camera.aspect = container.offsetWidth / container.offsetHeight;
	camera.updateProjectionMatrix();

	renderer.setSize(container.offsetWidth, container.offsetHeight);
}

function buildStarMesh(){
    // malla: estrella de 7 puntas, 1.25 giros a lo largo de la extrusión
    const star = buildExtrudedStar({
    points: 7,
    rOuter: 1,
    rInner: 0.45,
    depth: 6,
    twistTurns: 0.25,
    uSegmentsPerEdge: 4,
    vSegments: 10,
    shading: 'smooth',
    doubleSided: true // útil si no añadís tapas
    });
    star.position.y=2

    const helper = new VertexNormalsHelper(star, 0.2);
    scene.add(helper);

    scene.add(star);
}

function buildSurface(){


    // Rectángulo WxH extruido a profundidad D.
    // u recorre el perímetro en 4 tramos iguales; v recorre la profundidad.
    const W = 3, H = 1, D = 6;

    function rectExtrude(u, v, out) {
    // mapear u en [0,1] a 4 tramos
    const t = u * 4.0;
    const seg = Math.floor(t);
    const s = t - seg; // progreso dentro del tramo [0,1)
    const z = (v - 0.5) * D;

    let x, y;
    switch (seg) {
        case 0: // borde inferior: (-W/2 -> +W/2, y=-H/2)
        x = -W/2 + s * W; y = -H/2; break;
        case 1: // borde derecho: (x=+W/2, -H/2 -> +H/2)
        x = +W/2; y = -H/2 + s * H; break;
        case 2: // borde superior: (+W/2 -> -W/2, y=+H/2)
        x = +W/2 - s * W; y = +H/2; break;
        default: // borde izquierdo: (x=-W/2, +H/2 -> -H/2)
        x = -W/2; y = +H/2 - s * H; break;
    }
    out.set(x, y, z);
    }

    // Normales planas por cara lateral (opcional; con shading='flat' no haría falta)
    // La ventaja: podés “forzar” exactamente las normales que quieras.
    function rectNormals(u, v, triIndex, cornerIndex, pos /*, du, dv */) {
    const t = u * 4.0;
    const seg = Math.floor(t);
    // 4 caras laterales
    switch (seg) {
        case 0:  return new Vector3( 0, -1, 0); // abajo
        case 1:  return new Vector3( 1,  0, 0); // derecha
        case 2:  return new Vector3( 0,  1, 0); // arriba
        default: return new Vector3(-1,  0, 0); // izquierda
    }
    // (las caras frontal/trasera quedan con normales ±Z por el 'flat' de la cara)
    }

    // Forzamos muestreo en los 4 vértices del rectángulo (u = 0, .25, .5, .75, 1)
    const uKnots = [0, 0.25, 0.5, 0.75, 1];

    const geom = new ParametricSurfaceGeometry(rectExtrude, {
    uSegments: 24,
    vSegments: 1,
    uClosed: true,
    uKnots: [0, 0.25, 0.5, 0.75], // sin 1
    vKnots: [0, 1],
    shading: 'flat'               // o usá normalFn si querés imponer normales exactas
    });

    const mat = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide});
    const m = new THREE.Mesh(geom, mat);
    scene.add(m);

    const helper = new VertexNormalsHelper(m, 0.2);
    scene.add(helper);

}
function animate() {
	requestAnimationFrame(animate);
	renderer.render(scene, camera);
}

setupThreeJs();


buildSurface();
buildStarMesh();
animate();
