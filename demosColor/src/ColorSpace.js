import * as THREE from 'three';

export class ColorSpace {
	constructor(scene) {
		this.scene = scene;
		this.currentVisuals = new THREE.Group();
		this.scene.add(this.currentVisuals);
		this.fullSpaceOutlineObject = null;
		this.modelType = '';
		this.showEdges = true;
		this.renderingMode = 'solid'; // 'solid' | 'dots'
		this.dotsRenderer = null;
	}

	display(limits) {
		this.clearCurrentVisuals();
		this._buildAxesAndLabels();
		this.fullSpaceOutlineObject = this._buildFullSpaceOutlineObject();
		if (this.fullSpaceOutlineObject) {
			this.currentVisuals.add(this.fullSpaceOutlineObject);
		}
		if (this.renderingMode === 'solid') {
			this._updateSubSpaceVolume(limits);
			if (this.showEdges) this._buildEdgesForSubspace();
		} else if (this.renderingMode === 'dots' && this.dotsRenderer) {
			this.dotsRenderer.addToGroup(this.currentVisuals);
			this.dotsRenderer.update(limits);
		}
	}

	refreshSubSpaceVolume(limits) {
		if (this.renderingMode === 'dots' && this.dotsRenderer) {
			this.dotsRenderer.update(limits);
			return;
		}

		const existingSubspace = this.currentVisuals.getObjectByName('subspaceVolume');
		if (existingSubspace) {
			existingSubspace.traverse((child) => {
				if (child.isMesh) {
					if (child.geometry) child.geometry.dispose();
					if (child.material) {
						if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
						else child.material.dispose();
					}
				}
			});
			this.currentVisuals.remove(existingSubspace);
		}
		this._updateSubSpaceVolume(limits);
		if (this.showEdges) this._buildEdgesForSubspace();
	}

	// Switch between 'solid' and 'dots' rendering modes.
	// dotsRenderer may be null when switching to solid.
	setRenderingMode(mode, dotsRenderer, limits) {
		this.renderingMode = mode;

		// Remove solid volume
		const existingSubspace = this.currentVisuals.getObjectByName('subspaceVolume');
		if (existingSubspace) {
			existingSubspace.traverse((child) => {
				if (child.isMesh) {
					if (child.geometry) child.geometry.dispose();
					if (child.material) {
						if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
						else child.material.dispose();
					}
				}
			});
			this.currentVisuals.remove(existingSubspace);
		}
		const oldEdges = this.currentVisuals.getObjectByName('subspaceEdges');
		if (oldEdges) {
			oldEdges.traverse(c => { if (c.isLineSegments && c.geometry) c.geometry.dispose(); });
			this.currentVisuals.remove(oldEdges);
		}

		// Remove old dots renderer and free its GPU resources
		if (this.dotsRenderer) {
			this.dotsRenderer.dispose();
			this.dotsRenderer = null;
		}

		if (mode === 'solid') {
			this._updateSubSpaceVolume(limits);
			if (this.showEdges) this._buildEdgesForSubspace();
		} else if (mode === 'dots' && dotsRenderer) {
			this.dotsRenderer = dotsRenderer;
			this.dotsRenderer.addToGroup(this.currentVisuals);
			this.dotsRenderer.update(limits);
		}
	}

	clearCurrentVisuals() {
		while (this.currentVisuals.children.length > 0) {
			const child = this.currentVisuals.children[0];
			this.currentVisuals.remove(child);
			if (child.geometry) child.geometry.dispose();
			if (child.material) {
				if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
				else child.material.dispose();
			}
		}
	}

	_buildAxesAndLabels() {
		throw new Error("Method '_buildAxesAndLabels()' must be implemented by subclass.");
	}

	_buildFullSpaceOutlineObject() {
		throw new Error("Method '_buildFullSpaceOutlineObject()' must be implemented by subclass.");
	}

	_updateSubSpaceVolume(limits) {
		throw new Error("Method '_updateSubSpaceVolume()' must be implemented by subclass.");
	}

	setAxesVisible(visible) {
		const axesGroup = this.currentVisuals.getObjectByName('axesGroup');
		if (axesGroup) axesGroup.visible = visible;
	}

	setVolumeVisible(visible) {
		const vol = this.currentVisuals.getObjectByName('subspaceVolume');
		if (vol) vol.visible = visible;
		const dots = this.currentVisuals.getObjectByName('dotsVolume');
		if (dots) dots.visible = visible;
	}

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
		return new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5));
	}

	_buildEdgesForSubspace() {
		const oldEdges = this.currentVisuals.getObjectByName('subspaceEdges');
		if (oldEdges) {
			oldEdges.traverse(child => {
				if (child.isLineSegments && child.geometry) child.geometry.dispose();
			});
			this.currentVisuals.remove(oldEdges);
		}

		const subspace = this.currentVisuals.getObjectByName('subspaceVolume');
		if (!subspace) return;

		const edgesGroup = new THREE.Group();
		edgesGroup.name = 'subspaceEdges';
		const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });

		subspace.traverse(child => {
			if (!child.isMesh) return;
			const edgesGeo = new THREE.EdgesGeometry(child.geometry, 15);
			edgesGroup.add(new THREE.LineSegments(edgesGeo, edgeMaterial));
		});

		this.currentVisuals.add(edgesGroup);
	}

	setEdgesVisible(visible) {
		this.showEdges = visible;
		const edgesGroup = this.currentVisuals.getObjectByName('subspaceEdges');
		if (visible && !edgesGroup) {
			this._buildEdgesForSubspace();
		} else if (edgesGroup) {
			edgesGroup.visible = visible;
		}
	}

	dispose() {
		if (this.dotsRenderer) {
			this.dotsRenderer.dispose();
			this.dotsRenderer = null;
		}
		this.clearCurrentVisuals();
		this.scene.remove(this.currentVisuals);
	}
}
