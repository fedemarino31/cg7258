import * as THREE from 'three';

export const CAMERA_TYPE = Object.freeze({
	perspective: 'perspective',
	orthographic: 'orthographic',
});

export function configureTeachingCamera(camera, parameters) {
	const { aspect, fov, orthographicSize, near, far } = parameters;
	camera.near = near;
	camera.far = far;
	if (camera.isPerspectiveCamera) {
		camera.aspect = aspect;
		camera.fov = fov;
	} else {
		const halfHeight = orthographicSize / 2;
		const halfWidth = halfHeight * aspect;
		camera.left = -halfWidth;
		camera.right = halfWidth;
		camera.top = halfHeight;
		camera.bottom = -halfHeight;
	}
	camera.updateProjectionMatrix();
	return camera;
}

export function replaceTeachingCamera(reference, type, parameters) {
	const previous = reference.teachingCamera;
	const camera = type === CAMERA_TYPE.orthographic
		? new THREE.OrthographicCamera()
		: new THREE.PerspectiveCamera();

	camera.name = previous.name;
	camera.position.copy(previous.position);
	camera.quaternion.copy(previous.quaternion);
	camera.scale.copy(previous.scale);
	camera.up.copy(previous.up);
	configureTeachingCamera(camera, parameters);

	for (const child of [...previous.children]) camera.add(child);
	previous.removeFromParent();
	reference.scene.add(camera);
	camera.updateMatrixWorld(true);

	reference.cameraHelper.removeFromParent();
	reference.cameraHelper.dispose();
	const cameraHelper = new THREE.CameraHelper(camera);
	cameraHelper.name = 'Teaching Camera Frustum';
	reference.scene.add(cameraHelper);

	reference.teachingCamera = camera;
	reference.cameraHelper = cameraHelper;
	return camera;
}
