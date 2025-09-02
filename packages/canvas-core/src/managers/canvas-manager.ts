import type { BackgroundOptions } from "@usketch/backgrounds";
import type { Camera, Shape } from "@usketch/shared-types";
import { getCanvasMousePosition } from "@usketch/shared-utils";
import { whiteboardStore } from "@usketch/store";
import { createDefaultToolManager, type ToolManager } from "@usketch/tools";
import type { Renderer, RendererEventHandlers } from "../interfaces/renderer";

/**
 * CanvasManager - Core business logic for canvas operations
 * This class is renderer-agnostic and delegates all rendering to the provided Renderer implementation
 */
export class CanvasManager {
	private renderer: Renderer;
	private toolManager: ToolManager;
	private isDragging = false;
	private dragStart = { x: 0, y: 0 };
	private dragStartCamera = { x: 0, y: 0, zoom: 1 };
	private unsubscribe?: () => void;
	private cleanupEventListeners?: () => void;

	constructor(renderer: Renderer, container: HTMLElement) {
		this.renderer = renderer;
		this.toolManager = createDefaultToolManager();

		// Initialize renderer
		this.renderer.initialize(container);

		// Set up core logic
		this.setupEventHandlers();
		this.subscribeToStore();

		// Initial render
		const state = whiteboardStore.getState();
		this.handleCameraUpdate(state.camera);
		this.handleShapesUpdate(state.shapes, state.selectedShapeIds);
	}

	private setupEventHandlers(): void {
		const handlers: RendererEventHandlers = {
			onPointerDown: this.handlePointerDown.bind(this),
			onPointerMove: this.handlePointerMove.bind(this),
			onPointerUp: this.handlePointerUp.bind(this),
			onWheel: this.handleWheel.bind(this),
			onKeyDown: this.handleKeyDown.bind(this),
			onKeyUp: this.handleKeyUp.bind(this),
		};

		this.cleanupEventListeners = this.renderer.setupEventListeners(handlers);
	}

	private handlePointerDown(event: PointerEvent, worldPos: { x: number; y: number }): void {
		const store = whiteboardStore.getState();

		// Handle tool events first
		if (event.button === 0 && !event.altKey) {
			this.toolManager.handlePointerDown(event, worldPos);
			this.updatePreview();
		} else if (event.button === 1 || (event.button === 0 && event.altKey)) {
			// Middle mouse button or Alt+Left mouse for panning
			this.isDragging = true;
			const container = this.renderer.getContainer();
			if (container) {
				const mousePos = getCanvasMousePosition(event, container);
				this.dragStart = mousePos;
				this.dragStartCamera = { ...store.camera };
				container.style.cursor = "grabbing";
			}
		}
	}

	private handlePointerMove(event: PointerEvent, worldPos: { x: number; y: number }): void {
		const container = this.renderer.getContainer();
		if (!container) return;

		const mousePos = getCanvasMousePosition(event, container);

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
			this.toolManager.handlePointerMove(event, worldPos);
			this.updatePreview();
		}
	}

	private handlePointerUp(event: PointerEvent, worldPos: { x: number; y: number }): void {
		if (this.isDragging) {
			this.isDragging = false;
			const container = this.renderer.getContainer();
			if (container) {
				container.style.cursor = "default";
			}
		} else {
			// Handle tool events
			this.toolManager.handlePointerUp(event, worldPos);
			this.updatePreview();
		}
	}

	private handleWheel(event: WheelEvent): void {
		event.preventDefault();

		const container = this.renderer.getContainer();
		if (!container) return;

		const store = whiteboardStore.getState();
		const mousePos = getCanvasMousePosition(event, container);

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

	private handleKeyDown(event: KeyboardEvent): void {
		const store = whiteboardStore.getState();

		// Handle Delete key
		if (event.key === "Delete" && store.selectedShapeIds.size > 0) {
			store.removeSelectedShapes();
			return;
		}

		// Handle Escape key - clear selection
		if (event.key === "Escape") {
			if (store.selectedShapeIds.size > 0) {
				store.clearSelection();
			}
			return;
		}

		// Handle Select All (Ctrl/Cmd + A)
		if (event.key === "a" && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			store.selectAll();
			return;
		}

		// Handle Copy (Ctrl/Cmd + C) - future implementation
		if (event.key === "c" && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			// TODO: Implement copy functionality
			return;
		}

		// Handle Paste (Ctrl/Cmd + V) - future implementation
		if (event.key === "v" && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			// TODO: Implement paste functionality
			return;
		}

		// Handle Cut (Ctrl/Cmd + X) - future implementation
		if (event.key === "x" && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			// TODO: Implement cut functionality
			return;
		}

		this.toolManager.handleKeyDown(event);
	}

	private handleKeyUp(event: KeyboardEvent): void {
		this.toolManager.handleKeyUp(event);
	}

	private subscribeToStore(): void {
		// Subscribe to store changes
		this.unsubscribe = whiteboardStore.subscribe((state, prevState) => {
			// Update camera if changed
			if (state.camera !== prevState?.camera) {
				this.handleCameraUpdate(state.camera);
			}

			// Update shapes if changed
			if (
				state.shapes !== prevState?.shapes ||
				state.selectedShapeIds !== prevState?.selectedShapeIds
			) {
				this.handleShapesUpdate(state.shapes, state.selectedShapeIds);
			}

			// Update tool if changed
			if (state.currentTool !== prevState?.currentTool) {
				this.toolManager.setActiveTool(state.currentTool, false);
			}
		});

		// Set initial tool
		const initialState = whiteboardStore.getState();
		this.toolManager.setActiveTool(initialState.currentTool, false);
	}

	private handleCameraUpdate(camera: Camera): void {
		this.renderer.updateCamera(camera);
	}

	private handleShapesUpdate(shapes: Record<string, Shape>, selectedShapeIds: Set<string>): void {
		// Render all shapes
		this.renderer.clearShapes();
		this.renderer.renderShapes(Object.values(shapes));

		// Update selection
		const selectedShapes = Array.from(selectedShapeIds)
			.map((id) => shapes[id])
			.filter((shape): shape is Shape => shape !== undefined);

		if (selectedShapes.length > 0) {
			this.renderer.renderSelection(selectedShapes);
		} else {
			this.renderer.clearSelection();
		}
	}

	private updatePreview(): void {
		const previewShape = this.toolManager.getPreviewShape();
		this.renderer.renderPreview(previewShape);
	}

	/**
	 * Set the background of the canvas
	 */
	public setBackground(options: BackgroundOptions): void {
		this.renderer.updateBackground(options);
	}

	/**
	 * Add a test shape for demonstration
	 */
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
		} as Shape;

		whiteboardStore.getState().addShape(testShape);
	}

	/**
	 * Get the tool manager instance
	 */
	public getToolManager(): ToolManager {
		return this.toolManager;
	}

	/**
	 * Get the store instance
	 */
	public getStore(): typeof whiteboardStore {
		return whiteboardStore;
	}

	/**
	 * Clean up and destroy the canvas manager
	 */
	public destroy(): void {
		// Unsubscribe from store
		if (this.unsubscribe) {
			this.unsubscribe();
		}

		// Clean up event listeners
		if (this.cleanupEventListeners) {
			this.cleanupEventListeners();
		}

		// Clean up tool manager
		this.toolManager.destroy();

		// Clean up renderer
		this.renderer.destroy();
	}
}
