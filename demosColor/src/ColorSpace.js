import * as THREE from 'three';

export class ColorSpace {
	constructor(scene) {
		this.scene = scene;
		this.currentVisuals = new THREE.Group();
		this.scene.add(this.currentVisuals);
		this.fullSpaceOutlineObject = null;
		this.modelType = ''; // To be set by subclass or SceneManager
		this.showEdges = true;
	}

	// Main method to be called by SceneManager to render the space
	display(limits) {
		this.clearCurrentVisuals();
		console.log(`Displaying space for ${this.constructor.name} with limits:`, limits);

		this._buildAxesAndLabels();
		this.fullSpaceOutlineObject = this._buildFullSpaceOutlineObject();
		if (this.fullSpaceOutlineObject) {
			this.currentVisuals.add(this.fullSpaceOutlineObject);
		}
		this._updateSubSpaceVolume(limits);
		if (this.showEdges) this._buildEdgesForSubspace();
	}

	// New method specifically for slider changes to update only the sub-volume
	refreshSubSpaceVolume(limits) {
		// Remove and dispose the previous subspace volume (may be a Group or a Mesh)
		const existingSubspace = this.currentVisuals.getObjectByName('subspaceVolume');
		if (existingSubspace) {
			existingSubspace.traverse((child) => {
				if (child.isMesh) {
					if (child.geometry) child.geometry.dispose();
					if (child.material) {
						if (Array.isArray(child.material)) {
							child.material.forEach((m) => m.dispose());
						} else {
							child.material.dispose();
						}
					}
				}
			});
			this.currentVisuals.remove(existingSubspace);
		}
		// Call the subclass's implementation to create and add the new one
		this._updateSubSpaceVolume(limits);
		if (this.showEdges) this._buildEdgesForSubspace();
	}

	clearCurrentVisuals() {
		while (this.currentVisuals.children.length > 0) {
			const child = this.currentVisuals.children[0];
			this.currentVisuals.remove(child);
			if (child.geometry) child.geometry.dispose();
			if (child.material) {
				if (Array.isArray(child.material)) {
					child.material.forEach((material) => material.dispose());
				} else {
					child.material.dispose();
				}
			}
		}
		// console.log('Cleared current visuals for', this.constructor.name);
	}

	// Methods to be implemented by subclasses
	_buildAxesAndLabels() {
		throw new Error("Method '_buildAxesAndLabels()' must be implemented by subclass.");
	}

	_buildFullSpaceOutlineObject() {
		throw new Error("Method '_buildFullSpaceOutlineObject()' must be implemented by subclass.");
	}

	_updateSubSpaceVolume(limits) {
		throw new Error("Method '_updateSubSpaceVolume()' must be implemented by subclass.");
	}

	// Utility method, can remain in base class or be moved to a utility file
	makeTextSprite(message, position) {
		const canvas = document.createElement('canvas');
		const context = canvas.getContext('2d');
		const fontSize = 25;
		context.font = `Bold ${fontSize}px Arial`;
		const textWidth = context.measureText(message).width;

		canvas.width = textWidth;
		canvas.height = fontSize;
		context.font = `Bold ${fontSize}px Arial`;
		context.fillStyle = 'rgba(255, 255, 255, 1.0)';
		context.textAlign = 'center';
		context.textBaseline = 'middle';
		context.fillText(message, canvas.width / 2, canvas.height / 2);

		const texture = new THREE.CanvasTexture(canvas);
		const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
		const sprite = new THREE.Sprite(spriteMaterial);
		const desiredHeightInWorldUnits = 0.1;
		sprite.scale.set(desiredHeightInWorldUnits * (canvas.width / canvas.height), desiredHeightInWorldUnits, 1.0);
		sprite.position.set(position.x, position.y, position.z);
		return sprite;
	}

	getCurrentSpaceBoundingBox() {
		if (this.fullSpaceOutlineObject && this.fullSpaceOutlineObject.geometry) {
			this.fullSpaceOutlineObject.geometry.computeBoundingBox();
			return this.fullSpaceOutlineObject.geometry.boundingBox;
		}
		console.warn(
			'getCurrentSpaceBoundingBox called but fullSpaceOutlineObject or its geometry is null/undefined for',
			this.constructor.name
		);
		return new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5));
	}

	/**
	 * Builds LineSegments overlays on every mesh in the subspace volume using
	 * EdgesGeometry. Shows boundary edges and internal edges where the dihedral
	 * angle exceeds the threshold (15°), giving a subtle white border on sharp
	 * seams between faces.
	 */
	_buildEdgesForSubspace() {
		// Remove and dispose any previous edge overlay
		const oldEdges = this.currentVisuals.getObjectByName('subspaceEdges');
		if (oldEdges) {
			oldEdges.traverse((child) => {
				if (child.isLineSegments && child.geometry) child.geometry.dispose();
			});
			this.currentVisuals.remove(oldEdges);
		}

		const subspace = this.currentVisuals.getObjectByName('subspaceVolume');
		if (!subspace) return;

		const edgesGroup = new THREE.Group();
		edgesGroup.name = 'subspaceEdges';

		// Single shared material — cheap white lines
		const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });

		// Works for both a single Mesh and a Group of Meshes.
		// All meshes in this project use identity local transforms (positions
		// are encoded directly in geometry vertices), so no matrix copy needed.
		subspace.traverse((child) => {
			if (!child.isMesh) return;
			const edgesGeo = new THREE.EdgesGeometry(child.geometry, 15);
			edgesGroup.add(new THREE.LineSegments(edgesGeo, edgeMaterial));
		});

		this.currentVisuals.add(edgesGroup);
	}

	/**
	 * Show or hide the edge overlay. Rebuilds it lazily when turned on
	 * if it does not exist yet.
	 */
	setEdgesVisible(visible) {
		this.showEdges = visible;
		const edgesGroup = this.currentVisuals.getObjectByName('subspaceEdges');
		if (visible && !edgesGroup) {
			this._buildEdgesForSubspace();
		} else if (edgesGroup) {
			edgesGroup.visible = visible;
		}
	}

	// Call this when the instance is no longer needed to clean up Three.js resources from the scene
	dispose() {
		this.clearCurrentVisuals();
		this.scene.remove(this.currentVisuals);
		// Any other specific disposals for the base class if necessary
		console.log(`${this.constructor.name} disposed.`);
	}
	// or they will be part of shader materials.
}
