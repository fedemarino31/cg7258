import * as THREE from 'three';
import { clipTriangle } from './HomogeneousClipper.js';

function multiplyVector4(matrix, vector) {
	return vector.clone().applyMatrix4(matrix);
}

function triangleIndices(geometry) {
	if (geometry.index) return Array.from(geometry.index.array);
	return Array.from({ length: geometry.attributes.position.count }, (_, index) => index);
}

function faceNormal(vertices) {
	const [first, second, third] = vertices.map((vertex) => new THREE.Vector3(vertex.x, vertex.y, vertex.z));
	return second.sub(first).cross(third.sub(first)).normalize();
}

export class PipelineEngine {
	constructor(camera) {
		this.camera = camera;
	}

	processScene(objects, viewport, trackedVertex) {
		this.camera.updateMatrixWorld(true);
		this.camera.updateProjectionMatrix();
		const world = [];
		const view = [];
		const clip = [];
		const clipped = [];

		for (const mesh of objects) {
			mesh.updateMatrixWorld(true);
			const positions = mesh.geometry.attributes.position;
			const textureCoordinates = mesh.geometry.attributes.uv;
			const indices = triangleIndices(mesh.geometry);
			for (let offset = 0; offset < indices.length; offset += 3) {
				const triangleVertexIndices = indices.slice(offset, offset + 3);
				const localVertices = triangleVertexIndices.map((index) => {
					const vertex = new THREE.Vector4().fromBufferAttribute(positions, index);
					vertex.w = 1;
					return vertex;
				});
				const uvs = textureCoordinates
					? triangleVertexIndices.map((index) => new THREE.Vector2().fromBufferAttribute(textureCoordinates, index))
					: [];
				const worldVertices = localVertices.map((vertex) => multiplyVector4(mesh.matrixWorld, vertex));
				const viewVertices = worldVertices.map((vertex) => multiplyVector4(this.camera.matrixWorldInverse, vertex));
				const clipVertices = viewVertices.map((vertex) => multiplyVector4(this.camera.projectionMatrix, vertex));
				const worldNormal = faceNormal(worldVertices);
				const viewNormal = faceNormal(viewVertices);
				const viewCenter = viewVertices.reduce(
					(center, vertex) => center.add(new THREE.Vector3(vertex.x, vertex.y, vertex.z)),
					new THREE.Vector3()
				).multiplyScalar(1 / 3);
				// Double-sided materials illuminate the side facing the camera with an
				// inverted normal, just as Three.js does in its Phong shader.
				if (viewNormal.dot(viewCenter.negate()) < 0) worldNormal.negate();
				const meta = {
					mesh,
					color: mesh.userData.pipelineColor ?? mesh.material.color,
					localVertices,
					uvs,
					lightingNormal: worldNormal,
				};
				world.push({ ...meta, vertices: worldVertices });
				view.push({ ...meta, vertices: viewVertices });
				clip.push({ ...meta, vertices: clipVertices });
				const clipInput = clipVertices.map((position, index) => ({
					position,
					uv: uvs[index],
					cameraDepth: -viewVertices[index].z,
				}));
				for (const result of clipTriangle(clipInput)) clipped.push({ ...meta, vertices: result });
			}
		}

		const ndc = clipped.map((triangle) => ({
			...triangle,
			vertices: triangle.vertices.map((vertex) => ({
				...vertex,
				cameraDepth: vertex.cameraDepth,
				clipW: vertex.position.w,
				position: new THREE.Vector3(
					vertex.position.x / vertex.position.w,
					vertex.position.y / vertex.position.w,
					vertex.position.z / vertex.position.w
				),
			})),
		}));
		const screen = ndc.map((triangle) => ({
			...triangle,
			vertices: triangle.vertices.map((vertex) => ({
				...vertex,
				position: new THREE.Vector3(
					(vertex.position.x * 0.5 + 0.5) * viewport.width,
					(1 - (vertex.position.y * 0.5 + 0.5)) * viewport.height,
					vertex.position.z * 0.5 + 0.5
				),
			})),
		}));

		return {
			viewport,
			world,
			view,
			clip,
			clipped,
			ndc,
			screen,
			tracked: this.processTrackedVertex(trackedVertex, viewport),
		};
	}

	processTrackedVertex({ mesh, index }, viewport) {
		const model = new THREE.Vector4().fromBufferAttribute(mesh.geometry.attributes.position, index);
		model.w = 1;
		const world = multiplyVector4(mesh.matrixWorld, model);
		const view = multiplyVector4(this.camera.matrixWorldInverse, world);
		const clip = multiplyVector4(this.camera.projectionMatrix, view);
		const safeW = Math.abs(clip.w) > 1e-7 ? clip.w : Number.EPSILON;
		const ndc = new THREE.Vector4(clip.x / safeW, clip.y / safeW, clip.z / safeW, 1);
		const screen = new THREE.Vector4(
			(ndc.x * 0.5 + 0.5) * viewport.width,
			(1 - (ndc.y * 0.5 + 0.5)) * viewport.height,
			ndc.z * 0.5 + 0.5,
			1
		);
		const visible = Math.abs(clip.x) <= clip.w && Math.abs(clip.y) <= clip.w && Math.abs(clip.z) <= clip.w;
		return { model, world, view, clip, ndc, screen, visible };
	}
}
