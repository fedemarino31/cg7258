import * as THREE from 'three';

import { addEventsHandlingFunctions } from './addEventsHandlingFunctions.js';

function DroneCamera(domElement, aspect, fov, scene, opts) {
    let me = this;
    const DEAD_ZONE_X = 0.15;
    const DEAD_ZONE_Y = 0.2;

    const ROTATION_DAMPING = 0.034;
    const TRANSLATION_DAMPING = 0.02;

    const MAX_TRANSLATION_SPEED = 0.01;
    const MAX_ROTATION_SPEED = 0.002;
    const BANKING_SPEED = 0.01;
    const BANKING_RESTITUTION = 0.03;

    const _tempUp = new THREE.Vector3();
    const _tempQuat = new THREE.Quaternion();

    const X = new THREE.Vector3(1, 0, 0);
    const Y = new THREE.Vector3(0, 1, 0);
    const Z = new THREE.Vector3(0, 0, 1);

    const options = {
        initialPosition: [20, 1.5, 0],
        initialTarget: [0, 1.5, 0],
        initialSpeedMultiplier: 3,
        useUIOJKLKeys: true,
    };

    Object.assign(options, opts);
    /*

        Keys

        QE  Roll

        WS  pitch

        AD  Yaw

        Arrows translation XZ

        PgUp/PgDw   Translation in Y

        R reset rotation

    */

    if (!fov) fov = 65;
    if (!aspect) aspect = 16 / 9;

    let camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 20000);
    camera.name = 'droneCamera';

    let yawRig = new THREE.Group();
    let pitchRig = new THREE.Group();

    yawRig.add(pitchRig);
    pitchRig.add(camera);

    camera.lookAt(new THREE.Vector3(-1, 0, 0));

    scene.add(camera);

    let initialCamState = {
        translateOn: 'XZ', //XY  o XZ for left stick

        xTargetSpeed: 0,
        xSpeed: 0,
        yTargetSpeed: 0,
        ySpeed: 0,
        zTargetSpeed: 0,
        zSpeed: 0,

        xRotationTargetSpeed: 0,
        xRotationSpeed: 0,
        yRotationTargetSpeed: 0,
        yRotationSpeed: 0,
        zRotationTargetSpeed: 0,
        zRotationSpeed: 0,

        bankingSpeedTarget: 0,
        bankingSpeed: 0,

        shouldersMode: 'ROLL', // ROLL o MOVE

        speedMultiplier: options.initialSpeedMultiplier,
    };

    let camState = Object.assign({}, initialCamState);

    let body = document.querySelector('body');

    body.addEventListener('keydown', function (e) {
        switch (e.key) {
            case 'ArrowUp': // up
                camState.xTargetSpeed = -MAX_TRANSLATION_SPEED * camState.speedMultiplier;
                break;
            case 'ArrowDown': // down
                camState.xTargetSpeed = MAX_TRANSLATION_SPEED * camState.speedMultiplier;
                break;

            case 'ArrowLeft': // left
                camState.zTargetSpeed = -MAX_TRANSLATION_SPEED * camState.speedMultiplier;
                break;
            case 'ArrowRight': // right
                camState.zTargetSpeed = MAX_TRANSLATION_SPEED * camState.speedMultiplier;
                break;

            case 'PageUp': // PgUp
                camState.yTargetSpeed = MAX_TRANSLATION_SPEED * camState.speedMultiplier;
                break;
            case 'PageDown': // PgDw
                camState.yTargetSpeed = -MAX_TRANSLATION_SPEED * camState.speedMultiplier;
                break;
        }

        if (options.useUIOJKLKeys) {
            switch (e.key) {
                case 'i': // up
                    camState.xTargetSpeed = -MAX_TRANSLATION_SPEED * camState.speedMultiplier;
                    break;
                case 'k': // down
                    camState.xTargetSpeed = MAX_TRANSLATION_SPEED * camState.speedMultiplier;
                    break;

                case 'j': // left
                    camState.zTargetSpeed = -MAX_TRANSLATION_SPEED * camState.speedMultiplier;
                    break;
                case 'l': // right
                    camState.zTargetSpeed = MAX_TRANSLATION_SPEED * camState.speedMultiplier;
                    break;

                case 'u': // PgUp
                    camState.yTargetSpeed = MAX_TRANSLATION_SPEED * camState.speedMultiplier;
                    break;
                case 'o': // PgDw
                    camState.yTargetSpeed = -MAX_TRANSLATION_SPEED * camState.speedMultiplier;
                    break;
            }
        }

        switch (e.key) {
            case '1': // speed 1
                camState.speedMultiplier = 1;
                break;

            case '2': // speed 2
                camState.speedMultiplier = 2;
                break;

            case '3': // speed 1
                camState.speedMultiplier = 4;
                break;

            case '4': // speed 1
                camState.speedMultiplier = 8;
                break;

            case '5': // speed 1
                camState.speedMultiplier = 12;
                break;

            case '6': // speed 1
                camState.speedMultiplier = 16;
                break;

            case '7': // speed 1
                camState.speedMultiplier = 20;
                break;

            case '8': // speed 1
                camState.speedMultiplier = 24;
                break;

            case 'q': // PgUp
                camState.zRotationTargetSpeed = MAX_ROTATION_SPEED;
                break;
            case 'e': // PgDw
                camState.zRotationTargetSpeed = -MAX_ROTATION_SPEED;
                break;

            case 'w':
                camState.xRotationTargetSpeed = MAX_ROTATION_SPEED;
                break;
            case 's':
                camState.xRotationTargetSpeed = -MAX_ROTATION_SPEED;
                break;

            case 'a': //+
                camState.yRotationTargetSpeed = MAX_ROTATION_SPEED;
                camState.bankingSpeedTarget = BANKING_SPEED;
                break;
            case 'd': //-
                camState.yRotationTargetSpeed = -MAX_ROTATION_SPEED;
                camState.bankingSpeedTarget = -BANKING_SPEED;
                break;
        }
    });

    body.onkeyup = function (e) {
        switch (e.key) {
            case 'ArrowUp':
            case 'ArrowDown':
                camState.xTargetSpeed = 0;
                break;

            case 'ArrowLeft':
            case 'ArrowRight':
                camState.zTargetSpeed = 0;
                break;

            case 'PageDown':
            case 'PageUp':
                camState.yTargetSpeed = 0;
                break;
        }
        if (options.useUIOJKLKeys) {
            switch (e.key) {
                case 'i':
                case 'k':
                    camState.xTargetSpeed = 0;
                    break;

                case 'j':
                case 'l':
                    camState.zTargetSpeed = 0;
                    break;

                case 'u':
                case 'o':
                    camState.yTargetSpeed = 0;
                    break;
            }
        }

        switch (e.key) {
            case 'q':
            case 'e':
                camState.zRotationTargetSpeed = 0;
                break;
            case 's':
            case 'w':
                camState.xRotationTargetSpeed = 0;
                break;

            case 'a':
            case 'd':
                camState.yRotationTargetSpeed = 0;
                camState.bankingSpeedTarget = 0;
                break;
        }
    };

    this.setGamepadController = function (gamepadController) {
        gamepadController.addEventListener('AXIS_CHANGED', function (e) {
            //console.log(e);
            let deadZone;
            let value;

            if (e.axis == 'RIGHT_STICK_Y') deadZone = DEAD_ZONE_Y;
            else deadZone = DEAD_ZONE_X;

            if (e.value < 0) value = Math.min(0, e.value + deadZone);
            else value = Math.max(0, e.value - deadZone);

            switch (e.axis) {
                case 'LEFT_STICK_X':
                    camState.zTargetSpeed = value * MAX_TRANSLATION_SPEED * camState.speedMultiplier;
                    break;
                case 'LEFT_STICK_Y':
                    camState.translateOn == 'XY'
                        ? (camState.yTargetSpeed = -value * MAX_TRANSLATION_SPEED * camState.speedMultiplier)
                        : (camState.xTargetSpeed = value * MAX_TRANSLATION_SPEED * camState.speedMultiplier);
                    break;

                case 'RIGHT_STICK_X':
                    camState.yRotationTargetSpeed = -value * MAX_ROTATION_SPEED * 2;
                    break;
                case 'RIGHT_STICK_Y':
                    camState.xRotationTargetSpeed = -value * MAX_ROTATION_SPEED * 2;
                    break;
            }
        });

        gamepadController.addEventListener('BUTTON_DOWN', function (e) {
            switch (e.control) {
                case 'FACE_1': // A
                    // esta usado para cambiar el color del gradiente
                    break;
                case 'FACE_2': // B
                    if (camState.shouldersMode == 'ROLL') {
                        camState.shouldersMode = 'MOVE';
                        camState.zRotationTargetSpeed = 0;
                    } else {
                        camState.shouldersMode = 'ROLL';
                        camState.yTargetSpeed = 0;
                    }

                    break;
                case 'FACE_3': // X
                    break;
                case 'FACE_4': // Y
                    break;
                case 'DPAD_UP':
                    camState.speedMultiplier += 1;
                    break;
                case 'DPAD_DOWN':
                    camState.speedMultiplier = Math.max(0, camState.speedMultiplier - 1);
                    break;

                case 'LEFT_TOP_SHOULDER':
                    //camState.zRotationTargetSpeed=MAX_ROTATION_SPEED*2;
                    break;

                case 'RIGHT_TOP_SHOULDER':
                    /*
                    camState.translateOn = 'XY';
                    camState.yTargetSpeed = -camState.xTargetSpeed;
                    camState.xTargetSpeed = 0;
                    */
                    break;
            }
        });

        gamepadController.addEventListener('BUTTON_CHANGE', function (e) {
            switch (e.control) {
                case 'LEFT_BOTTOM_SHOULDER':
                    if (camState.shouldersMode == 'ROLL')
                        camState.zRotationTargetSpeed = Math.max(0, e.value - DEAD_ZONE_Y) * MAX_ROTATION_SPEED;
                    else
                        camState.yTargetSpeed =
                            -Math.max(0, e.value - DEAD_ZONE_Y) * camState.speedMultiplier * MAX_TRANSLATION_SPEED;
                    break;
                case 'RIGHT_BOTTOM_SHOULDER':
                    if (camState.shouldersMode == 'ROLL')
                        camState.zRotationTargetSpeed = -Math.max(0, e.value - DEAD_ZONE_Y) * MAX_ROTATION_SPEED;
                    else
                        camState.yTargetSpeed =
                            Math.max(0, e.value - DEAD_ZONE_Y) * camState.speedMultiplier * MAX_TRANSLATION_SPEED;
                    break;
            }
        });

        gamepadController.addEventListener('BUTTON_UP', function (e) {
            switch (e.control) {
                case 'LEFT_BOTTOM_SHOULDER':
                case 'RIGHT_BOTTOM_SHOULDER':
                    //camState.zRotationTargetSpeed = 0;
                    break;

                case 'RIGHT_TOP_SHOULDER':
                    /*
                    camState.translateOn = 'XZ';
                    camState.xTargetSpeed = -camState.yTargetSpeed;
                    camState.yTargetSpeed = 0;
                    */
                    break;
            }
        });
    };

    this.update = function (deltaTime) {
        //if (gamepadController) gamepadController.update();

        camState.xSpeed += (camState.xTargetSpeed * camState.speedMultiplier - camState.xSpeed) * TRANSLATION_DAMPING;
        camState.ySpeed += (camState.yTargetSpeed * camState.speedMultiplier - camState.ySpeed) * TRANSLATION_DAMPING;
        camState.zSpeed += (camState.zTargetSpeed * camState.speedMultiplier - camState.zSpeed) * TRANSLATION_DAMPING;

        camState.yRotationSpeed +=
            (camState.yRotationTargetSpeed * camState.speedMultiplier - camState.yRotationSpeed) * ROTATION_DAMPING;
        camState.zRotationSpeed +=
            (camState.zRotationTargetSpeed * camState.speedMultiplier - camState.zRotationSpeed) * ROTATION_DAMPING;
        camState.xRotationSpeed +=
            (camState.xRotationTargetSpeed * camState.speedMultiplier - camState.xRotationSpeed) * ROTATION_DAMPING;

        camera.translateX(camState.zSpeed);
        camera.translateY(camState.ySpeed);
        camera.translateZ(camState.xSpeed);

        camera.rotateOnAxis(X, camState.xRotationSpeed);
        camera.rotateOnAxis(Y, camState.yRotationSpeed);

        camState.bankingSpeed += (camState.bankingSpeedTarget - camState.bankingSpeed) * 0.1;

        let bankingFactor =
            Math.abs(camState.xTargetSpeed) > 0
                ? Math.abs(camState.xSpeed) / Math.abs(camState.xTargetSpeed * camState.speedMultiplier)
                : 0;

        camera.rotateOnAxis(Z, camState.zRotationSpeed + camState.bankingSpeed * bankingFactor);

        _tempUp.set(0, 1, 0).applyQuaternion(_tempQuat.copy(camera.quaternion).invert());
        const rollAngle = Math.atan2(_tempUp.x, _tempUp.y);
        camera.rotateOnAxis(Z, -rollAngle * BANKING_RESTITUTION);
    };

    this.setAspect = function (aspect) {
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
    };

    this.setFov = function (fov) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
    };

    Object.defineProperty(this, 'fov', {
        get: function () {
            return camera.fov;
        },
        set: function (v) {
            camera.fov = v;
            camera.updateProjectionMatrix();
        },
    });

    this.getObject3D = function () {
        return yawRig;
    };

    this.getCamera = function () {
        return camera;
    };

    this.getTarget = function () {
        return camera.localToWorld(new THREE.Vector3(0, 0, -1));
    };

    this.getState = function () {
        return camState; //Object.assign({},camState);
    };

    this.reset = function (positionArr, targetArr) {
        if (!positionArr) positionArr = options.initialPosition;
        if (!targetArr) targetArr = options.initialTarget;

        camera.position.copy(new THREE.Vector3().fromArray(positionArr));
        camera.lookAt(new THREE.Vector3().fromArray(targetArr));

        camState.xRotationSpeed = 0;
        camState.xTargetRotationSpeed = 0;
        camState.yRotationSpeed = 0;
        camState.yTargetRotationSpeed = 0;
        camState.zRotationSpeed = 0;
        camState.zTargetRotationSpeed = 0;
        camState.xSpeed = 0;
        camState.xTargetSpeed = 0;
        camState.ySpeed = 0;
        camState.yTargetSpeed = 0;
        camState.zSpeed = 0;
        camState.zTargetSpeed = 0;
    };

    this.getSpeedMultiplier = function () {
        return camState.speedMultiplier;
    };
    me.reset();
}

export { DroneCamera };
