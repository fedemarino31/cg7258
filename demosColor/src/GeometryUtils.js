import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as constants from './constants.js';

export const TUBE_RADIUS = constants.outlineEdgeThickness; // Using centralized constant
export const TUBE_RADIAL_SEGMENTS = 8; // 4 might be too blocky, 8 is a good compromise
export const TUBE_TUBULAR_SEGMENTS = 1; // For straight lines, 1 segment is enough

/**
 * Creates a single merged BufferGeometry for a series of tubes defined by edges.
 * @param {Array<Object>} edges - An array of edge objects, e.g., [{ start: THREE.Vector3, end: THREE.Vector3 }, ...]
 * @param {number} radius - The radius of the tubes.
 * @param {number} radialSegments - The number of radial segments for the tubes.
 * @param {number} tubularSegments - The number of tubular segments for the tubes (usually 1 for straight lines).
 * @returns {THREE.BufferGeometry | null} - The merged BufferGeometry, or null if no edges or merge fails.
 */
/**
 * Creates directional arcs with arrowheads to indicate rotation/direction.
 * @param {THREE.Object3D} parent - The parent object to add arcs and arrowheads to
 * @param {Array<Object>} arcsData - Array of arc data objects with startAngleDeg and endAngleDeg
 * @param {number} arcRadius - Radius of the arcs
 * @param {number} arcY - Y position of the arcs
 * @param {THREE.Material} material - Material for arcs and arrowheads
 */

/**
 * Creates a coordinate axis with cylinder geometry, arrowhead, and label
 * @param {THREE.Object3D} parent - The parent object to add the axis to
 * @param {THREE.Vector3} start - Start position of the axis
 * @param {THREE.Vector3} end - End position of the axis
 * @param {string} label - Text label for the axis
 * @param {THREE.Vector3} labelOffset - Offset position for the label relative to the end
 * @param {THREE.Color|number} color - Color for the axis (optional, default white)
 * @param {function} createLabelFn - Function to create a text sprite
 * @returns {THREE.Object3D} - The created axis object
 */
export function createAxis(parent, start, end, label, labelOffset, color = 0xffffff, createLabelFn) {
	// Create a group to hold the axis parts
	const axisGroup = new THREE.Group();

	// Calculate axis direction and length
	const direction = new THREE.Vector3().subVectors(end, start).normalize();
	const length = start.distanceTo(end);

	// Create cylinder geometry for the axis
	// Cylinder defaults to Y-axis, so we need to rotate it
	const cylinderGeometry = new THREE.CylinderGeometry(
		constants.axisThickness, // radiusTop
		constants.axisThickness, // radiusBottom
		length, // height
		8, // radialSegments
		1, // heightSegments
		false // openEnded
	);

	// Shift the cylinder so that its base is at the origin
	// (CylinderGeometry creates cylinder centered at origin)
	cylinderGeometry.translate(0, length / 2, 0);

	// Create the axis material with the specified color
	const axisMaterial = new THREE.MeshPhongMaterial({ color: color });

	// Create the cylinder mesh
	const cylinder = new THREE.Mesh(cylinderGeometry, axisMaterial);

	// Orient the cylinder to point in the direction of the axis
	cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);

	// Position the cylinder at the start position
	cylinder.position.copy(start);

	// Add the cylinder to the axis group
	axisGroup.add(cylinder);

	// Create arrowhead cone at the end of the axis
	const arrowhead = new THREE.Mesh(
		new THREE.ConeGeometry(constants.arrowRadius, constants.arrowLength, 16),
		axisMaterial
	);

	// Position the arrowhead at the end of the axis
	arrowhead.position.copy(end);

	// Orient the arrowhead in the same direction as the axis
	arrowhead.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);

	// Offset the arrowhead position so it sits at the end of the cylinder
	arrowhead.position.addScaledVector(direction, constants.arrowLength / 2);

	// Add the arrowhead to the axis group
	axisGroup.add(arrowhead);

	// Add label if provided
	if (label && createLabelFn) {
		// Calculate label position
		const labelPosition = new THREE.Vector3().copy(end).add(labelOffset);
		// Create and add the label
		const labelSprite = createLabelFn(label, labelPosition);
		axisGroup.add(labelSprite);
	}

	// Add the axis group to the parent
	parent.add(axisGroup);

	return axisGroup;
}

/**
 * Creates a single directional arc with an arrowhead.
 * @param {THREE.Object3D} parent - The parent object to add the arc to
 * @param {number} startAngleDeg - Start angle in degrees
 * @param {number} endAngleDeg - End angle in degrees
 * @param {number} arcRadius - Radius of the arc
 * @param {number} arcY - Y position of the arc
 * @param {THREE.Material} material - Material for the arc and arrowhead
 * @returns {THREE.Group} - A group containing the arc and arrowhead
 */
export function createDirectionalArc(parent, startAngleDeg, endAngleDeg, arcRadius, arcY, material) {
	// Create a group to hold the arc and arrowhead
	const arcGroup = new THREE.Group();

	// Convert angles to radians
	const startRad = THREE.MathUtils.degToRad(startAngleDeg);
	const endRad = THREE.MathUtils.degToRad(endAngleDeg);
	const arcLength = endRad - startRad;

	// Arc properties
	const arcTubeRadius = constants.axisThickness; // Slightly thinner tubes for arrows
	const radialSegments = 8; // Segments around the tube
	const tubularSegments = 24; // Segments along the arc

	// Create the arc using TorusGeometry for better quality and performance
	const arcGeometry = new THREE.TorusGeometry(
		arcRadius, // radius of the torus
		arcTubeRadius, // tube radius
		radialSegments, // radial segments
		tubularSegments, // tubular segments
		arcLength // arc length in radians
	);

	// Rotate and position the arc to match the start angle
	// By default, TorusGeometry starts at 0 degrees and rotates around the z-axis
	// We need to rotate it around the y-axis and position it at the right height
	arcGeometry.rotateY(startRad);
	arcGeometry.rotateX(Math.PI / 2); // Rotate to horizontal plane

	// Create mesh and add to group
	const arcMesh = new THREE.Mesh(arcGeometry, material);
	arcMesh.position.set(0, arcY, 0); // Position at the specified Y level
	arcGroup.add(arcMesh);

	// Add arrowhead at the end of the arc
	// Calculate the position of the arrowhead
	const arrowPos = new THREE.Vector3(arcRadius * Math.cos(endRad), arcY, arcRadius * Math.sin(endRad));

	// Calculate the direction tangent to the circle at the end point
	// This is perpendicular to the radius vector
	const radiusVector = new THREE.Vector3(Math.cos(endRad), 0, Math.sin(endRad));
	const tangentVector = new THREE.Vector3(-radiusVector.z, 0, radiusVector.x).normalize();

	// Create the arrowhead
	const arrowhead = new THREE.Mesh(
		new THREE.ConeGeometry(constants.arrowRadius, constants.arrowLength, 16),
		material
	);

	// Position the arrowhead at the end of the arc
	arrowhead.position.copy(arrowPos);

	// Orient the arrowhead to point in the tangent direction
	// By default, the cone points in the +Y direction, so we need to rotate it
	const quaternion = new THREE.Quaternion().setFromUnitVectors(
		new THREE.Vector3(0, 1, 0), // Default cone direction
		tangentVector // Direction we want it to point
	);
	arrowhead.quaternion.multiply(quaternion);

	// Offset the arrowhead position to align it with the end of the arc
	arrowhead.position.addScaledVector(tangentVector, constants.arrowLength / 2);

	// Add the arrowhead to the group
	arcGroup.add(arrowhead);

	// Add the group to the parent if provided
	if (parent) {
		parent.add(arcGroup);
	}

	return arcGroup;
}

/**
 * Backwards compatibility function that creates directional arcs.
 * Now simplified to create one arc and clone it with rotation.
 */
export function createDirectionalArcs(parent, arcsData, arcRadius, arcY, material) {
	// If we have two arcs in typical configuration (0/180 degrees offset), optimize by cloning
	if (arcsData.length === 2) {
		// Create the first arc
		const firstArc = createDirectionalArc(
			parent,
			arcsData[0].startAngleDeg,
			arcsData[0].endAngleDeg,
			arcRadius,
			arcY,
			material
		);

		// Clone and rotate the first arc by 180 degrees for the second arc
		const secondArc = firstArc.clone();
		secondArc.rotateY(Math.PI); // Rotate 180 degrees around Y axis
		parent.add(secondArc);
	} else {
		// For other configurations, create each arc individually
		arcsData.forEach((arcData) => {
			createDirectionalArc(parent, arcData.startAngleDeg, arcData.endAngleDeg, arcRadius, arcY, material);
		});
	}
}

export function createTubesFromEdges(
	edges,
	radius = TUBE_RADIUS,
	radialSegments = TUBE_RADIAL_SEGMENTS,
	tubularSegments = TUBE_TUBULAR_SEGMENTS
) {
	if (!edges || edges.length === 0) {
		return null;
	}

	const tubeGeometries = [];

	for (const edge of edges) {
		if (!edge.start || !edge.end) {
			console.warn('Skipping invalid edge:', edge);
			continue;
		}
		const path = new THREE.LineCurve3(edge.start, edge.end);
		const tubeGeometry = new THREE.TubeGeometry(
			path,
			tubularSegments, // For a straight line, only 1 segment is needed along its length
			radius,
			radialSegments,
			false // closed
		);
		tubeGeometries.push(tubeGeometry);
	}

	if (tubeGeometries.length === 0) {
		return null;
	}

	const mergedGeometry = mergeGeometries(tubeGeometries, false); // false for not using groups

	// Dispose individual geometries after merging
	tubeGeometries.forEach((geometry) => geometry.dispose());

	return mergedGeometry;
}
