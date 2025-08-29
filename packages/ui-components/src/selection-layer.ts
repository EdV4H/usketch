import type { Shape } from "@usketch/shared-types";

interface Bounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

export class SelectionLayer {
	private container: HTMLElement;
	private selectionBoxes: Map<string, HTMLElement> = new Map();
	private groupSelectionBox: HTMLElement | null = null;
	private selectionInfoElement: HTMLElement | null = null;

	constructor(container: HTMLElement) {
		this.container = container;
	}

	updateSelection(selectedShapes: Shape[]): void {
		// Clear existing selection boxes
		this.clear();

		if (selectedShapes.length === 0) {
			return;
		}

		if (selectedShapes.length === 1) {
			// Single selection - show individual selection box with handles
			const shape = selectedShapes[0];
			if (shape) {
				const selectionBox = this.createSelectionBox(shape);
				this.selectionBoxes.set(shape.id, selectionBox);
				this.container.appendChild(selectionBox);
			}
		} else {
			// Multiple selection - show group bounding box
			const bounds = this.calculateGroupBounds(selectedShapes);
			this.createGroupSelectionBox(bounds, selectedShapes.length);

			// Also show lighter individual boxes for each shape
			selectedShapes.forEach((shape) => {
				const individualBox = this.createIndividualSelectionBox(shape);
				this.selectionBoxes.set(shape.id, individualBox);
				this.container.appendChild(individualBox);
			});
		}
	}

	private calculateGroupBounds(shapes: Shape[]): Bounds {
		if (shapes.length === 0) {
			return { x: 0, y: 0, width: 0, height: 0 };
		}

		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;

		shapes.forEach((shape) => {
			// For freedraw shapes, calculate bounds from points
			if (shape.type === "freedraw" && (shape as any).points) {
				const points = (shape as any).points;
				points.forEach((point: { x: number; y: number }) => {
					minX = Math.min(minX, point.x);
					minY = Math.min(minY, point.y);
					maxX = Math.max(maxX, point.x);
					maxY = Math.max(maxY, point.y);
				});
			} else if ("width" in shape && "height" in shape) {
				// For regular shapes with width/height
				minX = Math.min(minX, shape.x);
				minY = Math.min(minY, shape.y);
				maxX = Math.max(maxX, shape.x + shape.width);
				maxY = Math.max(maxY, shape.y + shape.height);
			} else {
				// Fallback for shapes without explicit dimensions
				minX = Math.min(minX, shape.x);
				minY = Math.min(minY, shape.y);
				maxX = Math.max(maxX, shape.x);
				maxY = Math.max(maxY, shape.y);
			}
		});

		return {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY,
		};
	}

	private createGroupSelectionBox(bounds: Bounds, count: number): void {
		// Create the group selection box
		const box = document.createElement("div");
		box.className = "group-selection-box";
		box.style.position = "absolute";
		box.style.pointerEvents = "none";
		box.style.border = "2px solid #007bff";
		box.style.backgroundColor = "rgba(0, 123, 255, 0.05)";
		box.style.left = `${bounds.x}px`;
		box.style.top = `${bounds.y}px`;
		box.style.width = `${bounds.width}px`;
		box.style.height = `${bounds.height}px`;

		// Add resize handles to group box
		this.addResizeHandles(box);

		// Add selection count indicator
		const countBadge = document.createElement("div");
		countBadge.className = "selection-count";
		countBadge.style.position = "absolute";
		countBadge.style.top = "-24px";
		countBadge.style.left = "0";
		countBadge.style.backgroundColor = "#007bff";
		countBadge.style.color = "white";
		countBadge.style.padding = "2px 8px";
		countBadge.style.borderRadius = "4px";
		countBadge.style.fontSize = "12px";
		countBadge.style.fontWeight = "bold";
		countBadge.textContent = `${count} objects selected`;
		box.appendChild(countBadge);

		this.groupSelectionBox = box;
		this.container.appendChild(box);
	}

	private createIndividualSelectionBox(shape: Shape): HTMLElement {
		const box = document.createElement("div");
		box.className = "individual-selection-box";
		box.style.position = "absolute";
		box.style.pointerEvents = "none";
		box.style.border = "1px solid rgba(0, 123, 255, 0.5)";
		box.style.backgroundColor = "rgba(0, 123, 255, 0.02)";

		// Position based on shape type
		if (shape.type === "freedraw" && (shape as any).points) {
			// Calculate bounds for freedraw
			const points = (shape as any).points;
			let minX = Infinity,
				minY = Infinity,
				maxX = -Infinity,
				maxY = -Infinity;

			points.forEach((point: { x: number; y: number }) => {
				minX = Math.min(minX, point.x);
				minY = Math.min(minY, point.y);
				maxX = Math.max(maxX, point.x);
				maxY = Math.max(maxY, point.y);
			});

			box.style.left = `${minX}px`;
			box.style.top = `${minY}px`;
			box.style.width = `${maxX - minX}px`;
			box.style.height = `${maxY - minY}px`;
		} else if ("width" in shape && "height" in shape) {
			box.style.left = `${shape.x}px`;
			box.style.top = `${shape.y}px`;
			box.style.width = `${shape.width}px`;
			box.style.height = `${shape.height}px`;
		}

		// Apply rotation if present
		if (shape.rotation) {
			box.style.transform = `rotate(${shape.rotation}rad)`;
			box.style.transformOrigin = "center";
		}

		// No resize handles for individual boxes in multi-selection
		return box;
	}

	private createSelectionBox(shape: Shape): HTMLElement {
		const box = document.createElement("div");
		box.className = "selection-box";
		box.style.position = "absolute";
		box.style.pointerEvents = "none";
		box.style.border = "2px solid #007bff";

		// Position based on shape type
		if ("width" in shape && "height" in shape) {
			box.style.left = `${shape.x}px`;
			box.style.top = `${shape.y}px`;
			box.style.width = `${shape.width}px`;
			box.style.height = `${shape.height}px`;
		}

		// Apply rotation if present
		if (shape.rotation) {
			box.style.transform = `rotate(${shape.rotation}rad)`;
			box.style.transformOrigin = "center";
		}

		// Add resize handles
		this.addResizeHandles(box);

		return box;
	}

	private addResizeHandles(selectionBox: HTMLElement): void {
		const handlePositions = [
			{ position: "nw", top: "-4px", left: "-4px", cursor: "nw-resize" },
			{ position: "n", top: "-4px", left: "50%", marginLeft: "-4px", cursor: "n-resize" },
			{ position: "ne", top: "-4px", right: "-4px", cursor: "ne-resize" },
			{ position: "e", top: "50%", right: "-4px", marginTop: "-4px", cursor: "e-resize" },
			{ position: "se", bottom: "-4px", right: "-4px", cursor: "se-resize" },
			{ position: "s", bottom: "-4px", left: "50%", marginLeft: "-4px", cursor: "s-resize" },
			{ position: "sw", bottom: "-4px", left: "-4px", cursor: "sw-resize" },
			{ position: "w", top: "50%", left: "-4px", marginTop: "-4px", cursor: "w-resize" },
		];

		handlePositions.forEach(({ position, ...styles }) => {
			const handle = document.createElement("div");
			handle.className = "resize-handle";
			handle.dataset.resizeHandle = position;
			handle.style.position = "absolute";
			handle.style.width = "8px";
			handle.style.height = "8px";
			handle.style.backgroundColor = "#007bff";
			handle.style.border = "1px solid white";
			handle.style.pointerEvents = "auto";

			// Apply position styles
			Object.assign(handle.style, styles);

			selectionBox.appendChild(handle);
		});
	}

	clear(): void {
		this.selectionBoxes.forEach((box) => box.remove());
		this.selectionBoxes.clear();

		if (this.groupSelectionBox) {
			this.groupSelectionBox.remove();
			this.groupSelectionBox = null;
		}

		if (this.selectionInfoElement) {
			this.selectionInfoElement.remove();
			this.selectionInfoElement = null;
		}
	}
}
