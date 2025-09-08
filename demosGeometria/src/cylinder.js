import * as THREE from 'three';

// Create the wall of the cylinder
function buildWall(buffers, radius, height, radialSegments, heightSegments) {
	const angleStep = (2 * Math.PI) / radialSegments;
	const heightStep = height / heightSegments;

	let positions = buffers.positions;
	let indices = buffers.indices;
	let normals = buffers.normals;
	let uvs = buffers.uvs;

	// vertical segments
	for (let i = 0; i <= heightSegments; i++) {
		const y = i * heightStep;
		const v = i / heightSegments;

		// radial segments
		for (let j = 0; j <= radialSegments; j++) {
			const angle = j * angleStep;
			const x = radius * Math.cos(angle);
			const z = radius * Math.sin(angle);
			const u = j / radialSegments;

			positions.push(x, y, z);
			normals.push(x, 0, z);
			uvs.push(u, v);

			//We stop before the last row and last column
			if (i < heightSegments && j < radialSegments) {
				// The indices of the vertices
				const a = i * (radialSegments + 1) + j;
				const b = a + radialSegments + 1;
				const c = a + radialSegments + 2;
				const d = a + 1;

				indices.push(a, b, d);
				indices.push(b, c, d);
			}
		}
	}
}
// Create the top or bottom cap of the cylinder
function buildCap(buffers, radius, z, isTopCap = false) {
	const angleStep = (2 * Math.PI) / buffers.radialSegments;

	let positions = buffers.positions;
	let indices = buffers.indices;
	let normals = buffers.normals;
	let uvs = buffers.uvs;

	const centerIndex = positions.length / 3;
	positions.push(0, z, 0);
	normals.push(0, isTopCap ? -1 : 1, 0);
	uvs.push(0.5, 0.5);

	// Create the vertices of the cap
	for (let i = 0; i <= buffers.radialSegments; i++) {
		// The angle of the vertex
		const angle = i * angleStep;
		//	The position of the vertex
		const x = radius * Math.cos(angle);
		const y = radius * Math.sin(angle);

		// The position of the cap vertex
		positions.push(x, z, y);
		// The normal of the cap points in the direction of the z axis
		normals.push(0, isTopCap ? -1 : 1, 0);
		uvs.push(0.5 + x / (2 * radius), 0.5 + y / (2 * radius));

		if (i < buffers.radialSegments) {
			const a = centerIndex;
			const b = centerIndex + i + 1;
			const c = centerIndex + i + 2;
			// The order of the vertices is reversed for the top cap
			if (!isTopCap) {
				// The indices of the triangle
				indices.push(a, b, c);
			} else {
				// The indices of the triangle
				indices.push(a, c, b);
			}
		}
	}
}

// Create a closed cylinder geometry
// The cylinder has a top and bottom cap
//	- radius: the radius of the cylinder
//	- height: the height of the cylinder
//	- radialSegments: the number of segments around the cylinder
//	- heightSegments: the number of segments along the height of the cylinder
//	- returns: a BufferGeometry object
//
export function createClosedCylinder(radius, height, radialSegments, heightSegments) {
	let geometry = new THREE.BufferGeometry();

	const positions = [];
	const indices = [];
	const normals = [];
	const uvs = [];

	//	The wall of the cylinder
	buildWall({ positions, indices, normals, uvs }, radius, height, radialSegments, heightSegments);
	//	The top and bottom caps of the cylinder
	buildCap({ positions, indices, normals, uvs, radialSegments }, radius, 0, false);
	buildCap({ positions, indices, normals, uvs, radialSegments }, radius, height, true);

	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
	geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
	geometry.setIndex(indices);

	return geometry;
}

export function createCylinder(radius, height, radialSegments, heightSegments) {
	let geometry = new THREE.BufferGeometry();

	const positions = [];
	const indices = [];
	const normals = [];
	const uvs = [];

	//	The wall of the cylinder
	buildWall({ positions, indices, normals, uvs }, radius, height, radialSegments, heightSegments);

	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
	geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
	geometry.setIndex(indices);

	return geometry;
}
