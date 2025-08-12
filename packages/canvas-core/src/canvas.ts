import { ToolManager } from "@whiteboard/drawing-tools";
import type { Camera, Shape } from "@whiteboard/shared-types";
import {
	applyCameraTransform,
	applyShapeTransform,
	getCanvasMousePosition,
	screenToWorld,
} from "@whiteboard/shared-utils";
import { whiteboardStore } from "@whiteboard/store";
import { SelectionLayer } from "@whiteboard/ui-components";

export class Canvas {
	private canvasElement: HTMLElement;
	private shapesContainer: HTMLElement;
	private selectionContainer: HTMLElement;
	private gridElement: HTMLElement;

	private isDragging = false;
	private dragStart = { x: 0, y: 0 };
	private dragStartCamera = { x: 0, y: 0, zoom: 1 };

	private toolManager: ToolManager;
	private selectionLayer: SelectionLayer;

	constructor(canvasElement: HTMLElement) {
		this.canvasElement = canvasElement;

		// Add necessary classes and attributes
		this.canvasElement.classList.add("whiteboard-canvas");
		this.canvasElement.setAttribute("role", "application");

		// Create shapes container
		this.shapesContainer = document.createElement("div");
		this.shapesContainer.className = "shape-layer";
		this.shapesContainer.style.position = "absolute";
		this.shapesContainer.style.top = "0";
		this.shapesContainer.style.left = "0";
		this.shapesContainer.style.width = "100%";
		this.shapesContainer.style.height = "100%";
		this.shapesContainer.style.transformOrigin = "0 0";

		// Get grid element
		this.gridElement = canvasElement.querySelector(".grid-background") as HTMLElement;

		// Add shapes container after grid
		canvasElement.appendChild(this.shapesContainer);

		// Create selection container
		this.selectionContainer = document.createElement("div");
		this.selectionContainer.className = "selection-layer";
		this.selectionContainer.style.position = "absolute";
		this.selectionContainer.style.top = "0";
		this.selectionContainer.style.left = "0";
		this.selectionContainer.style.width = "100%";
		this.selectionContainer.style.height = "100%";
		this.selectionContainer.style.transformOrigin = "0 0";
		this.selectionContainer.style.pointerEvents = "none";
		canvasElement.appendChild(this.selectionContainer);

		// Initialize selection layer
		this.selectionLayer = new SelectionLayer(this.selectionContainer);

		// Initialize tool manager
		this.toolManager = new ToolManager();

		this.setupEventListeners();
		this.subscribeToStore();
	}

	private setupEventListeners(): void {
		// Mouse events for pan and zoom
		this.canvasElement.addEventListener("mousedown", this.handleMouseDown.bind(this));
		this.canvasElement.addEventListener("mousemove", this.handleMouseMove.bind(this));
		this.canvasElement.addEventListener("mouseup", this.handleMouseUp.bind(this));
		this.canvasElement.addEventListener("wheel", this.handleWheel.bind(this), { passive: false });

		// Keyboard events
		document.addEventListener("keydown", this.handleKeyDown.bind(this));
		document.addEventListener("keyup", this.handleKeyUp.bind(this));

		// Prevent context menu
		this.canvasElement.addEventListener("contextmenu", (e) => e.preventDefault());
	}

	private handleMouseDown(event: MouseEvent): void {
		const store = whiteboardStore.getState();
		const mousePos = getCanvasMousePosition(event, this.canvasElement);
		const worldPos = screenToWorld(mousePos, store.camera);

		// Handle tool events first
		if (event.button === 0 && !event.altKey) {
			this.toolManager.handlePointerDown(event as PointerEvent, worldPos);
		} else if (event.button === 1 || (event.button === 0 && event.altKey)) {
			// Middle mouse button or Alt+Left mouse for panning
			this.isDragging = true;
			this.dragStart = mousePos;
			this.dragStartCamera = { ...store.camera };
			this.canvasElement.style.cursor = "grabbing";
		}
	}

	private handleMouseMove(event: MouseEvent): void {
		const mousePos = getCanvasMousePosition(event, this.canvasElement);
		const store = whiteboardStore.getState();
		const worldPos = screenToWorld(mousePos, store.camera);

		if (this.isDragging) {
			// Handle canvas panning
			const deltaX = (mousePos.x - this.dragStart.x) / this.dragStartCamera.zoom;
			const deltaY = (mousePos.y - this.dragStart.y) / this.dragStartCamera.zoom;

			whiteboardStore.getState().setCamera({
				x: this.dragStartCamera.x - deltaX,
				y: this.dragStartCamera.y - deltaY,
			});
		} else {
			// Handle tool events
			this.toolManager.handlePointerMove(event as PointerEvent, worldPos);
		}
	}

	private handleMouseUp(event: MouseEvent): void {
		const mousePos = getCanvasMousePosition(event, this.canvasElement);
		const store = whiteboardStore.getState();
		const worldPos = screenToWorld(mousePos, store.camera);

		if (this.isDragging) {
			this.isDragging = false;
			this.canvasElement.style.cursor = "default";
		} else {
			// Handle tool events
			this.toolManager.handlePointerUp(event as PointerEvent, worldPos);
		}
	}

	private handleWheel(event: WheelEvent): void {
		event.preventDefault();

		const store = whiteboardStore.getState();
		const mousePos = getCanvasMousePosition(event, this.canvasElement);

		// More natural zoom factor based on deltaY magnitude
		const scaleFactor = 1.002 ** -event.deltaY;
		const newZoom = Math.max(0.1, Math.min(5, store.camera.zoom * scaleFactor));

		// If zoom hasn't changed, return early
		if (newZoom === store.camera.zoom) return;

		// Calculate new camera position to keep mouse position fixed in world space
		const worldX = mousePos.x / store.camera.zoom + store.camera.x;
		const worldY = mousePos.y / store.camera.zoom + store.camera.y;

		const newCameraX = worldX - mousePos.x / newZoom;
		const newCameraY = worldY - mousePos.y / newZoom;

		whiteboardStore.getState().setCamera({
			x: newCameraX,
			y: newCameraY,
			zoom: newZoom,
		});
	}

	private subscribeToStore(): void {
		// Subscribe to store changes
		whiteboardStore.subscribe((state, prevState) => {
			this.updateCamera(state.camera);
			this.updateShapes(state.shapes, state.selectedShapeIds);

			// Update tool if changed
			if (state.currentTool !== prevState?.currentTool) {
				this.toolManager.setActiveTool(state.currentTool, false);
			}
		});

		// Set initial tool
		const initialState = whiteboardStore.getState();
		this.toolManager.setActiveTool(initialState.currentTool, false);
	}

	private updateCamera(camera: Camera): void {
		// Update shapes container transform
		applyCameraTransform(this.shapesContainer, camera);

		// Update selection container transform
		applyCameraTransform(this.selectionContainer, camera);

		// Update grid background
		if (this.gridElement) {
			const gridSize = 20 * camera.zoom;
			const offsetX = (-camera.x * camera.zoom) % gridSize;
			const offsetY = (-camera.y * camera.zoom) % gridSize;

			this.gridElement.style.backgroundSize = `${gridSize}px ${gridSize}px`;
			this.gridElement.style.backgroundPosition = `${offsetX}px ${offsetY}px`;
		}
	}

	private updateShapes(shapes: Record<string, Shape>, selectedShapeIds: Set<string>): void {
		// Clear existing shapes
		this.shapesContainer.innerHTML = "";

		// Render each shape
		Object.values(shapes).forEach((shape) => {
			const shapeElement = this.createShapeElement(shape);

			// Set selection state
			if (selectedShapeIds.has(shape.id)) {
				shapeElement.classList.add("selected");
				shapeElement.dataset.selected = "true";
			} else {
				shapeElement.dataset.selected = "false";
			}

			this.shapesContainer.appendChild(shapeElement);
		});

		// Update selection layer
		const selectedShapes = Array.from(selectedShapeIds)
			.map((id) => shapes[id])
			.filter((shape): shape is Shape => shape !== undefined);
		this.selectionLayer.updateSelection(selectedShapes);
	}

	private createShapeElement(shape: Shape): HTMLElement {
		const element = document.createElement("div");
		element.style.position = "absolute";
		element.style.pointerEvents = "auto";

		// Set data attributes for shape identification
		element.dataset.shapeId = shape.id;
		element.dataset.shapeType = shape.type;
		element.setAttribute("data-shape", "true");

		// Apply common styles
		element.style.opacity = shape.opacity.toString();

		// Apply shape transform
		applyShapeTransform(element, shape);

		// Create shape-specific content
		switch (shape.type) {
			case "rectangle":
				this.createRectangleElement(element, shape);
				break;
			case "ellipse":
				this.createEllipseElement(element, shape);
				break;
			// Add other shape types as needed
		}

		// Click handler is now managed by the SelectTool

		return element;
	}

	private createRectangleElement(
		element: HTMLElement,
		shape: Shape & { width: number; height: number },
	): void {
		element.style.width = `${shape.width}px`;
		element.style.height = `${shape.height}px`;
		element.style.backgroundColor = shape.fillColor;
		element.style.border = `${shape.strokeWidth}px solid ${shape.strokeColor}`;
		element.style.boxSizing = "border-box";
	}

	private createEllipseElement(
		element: HTMLElement,
		shape: Shape & { width: number; height: number },
	): void {
		element.style.width = `${shape.width}px`;
		element.style.height = `${shape.height}px`;
		element.style.backgroundColor = shape.fillColor;
		element.style.border = `${shape.strokeWidth}px solid ${shape.strokeColor}`;
		element.style.borderRadius = "50%";
		element.style.boxSizing = "border-box";
	}

	// Method to add a test shape for demonstration
	public addTestShape(): void {
		const testShape: Shape = {
			id: `test-rect-${Date.now()}`,
			type: "rectangle",
			x: 100,
			y: 100,
			width: 200,
			height: 100,
			rotation: 0,
			opacity: 1,
			strokeColor: "#333",
			fillColor: "#e0e0ff",
			strokeWidth: 2,
		} as any; // Using 'as any' temporarily until we have proper shape types

		whiteboardStore.getState().addShape(testShape);
	}

	private handleKeyDown(event: KeyboardEvent): void {
		const store = whiteboardStore.getState();

		// Handle Delete key
		if (event.key === "Delete" && store.selectedShapeIds.size > 0) {
			Array.from(store.selectedShapeIds).forEach((id) => {
				whiteboardStore.getState().removeShape(id);
			});
			return;
		}

		// Handle Ctrl+A / Cmd+A
		if ((event.ctrlKey || event.metaKey) && event.key === "a") {
			event.preventDefault();
			// Select all shapes
			Object.keys(store.shapes).forEach((id) => {
				whiteboardStore.getState().selectShape(id);
			});
			return;
		}

		this.toolManager.handleKeyDown(event);
	}

	private handleKeyUp(event: KeyboardEvent): void {
		this.toolManager.handleKeyUp(event);
	}

	// Public method to access tool manager
	public getToolManager(): ToolManager {
		return this.toolManager;
	}

	public getStore(): typeof whiteboardStore {
		return whiteboardStore;
	}

	// Cleanup method for React
	public destroy(): void {
		// Remove event listeners
		this.canvasElement.removeEventListener("mousedown", this.handleMouseDown.bind(this));
		this.canvasElement.removeEventListener("mousemove", this.handleMouseMove.bind(this));
		this.canvasElement.removeEventListener("mouseup", this.handleMouseUp.bind(this));
		this.canvasElement.removeEventListener("wheel", this.handleWheel.bind(this));
		document.removeEventListener("keydown", this.handleKeyDown.bind(this));
		document.removeEventListener("keyup", this.handleKeyUp.bind(this));

		// Remove elements from DOM
		this.shapesContainer.remove();
		this.selectionContainer.remove();
	}
}
