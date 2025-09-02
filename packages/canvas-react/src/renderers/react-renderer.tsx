import type { BackgroundOptions } from "@usketch/backgrounds";
import type { Renderer, RendererEventHandlers } from "@usketch/canvas-core";
import type { Camera, Shape } from "@usketch/shared-types";
import { getCanvasMousePosition, screenToWorld } from "@usketch/shared-utils";
import type React from "react";
import { createRoot, type Root } from "react-dom/client";
import { CanvasView } from "../components/canvas-view";
import { ReactStateManager } from "../state/react-state-manager";

/**
 * React Renderer implementation
 * This renderer uses React components for rendering shapes
 */
export class ReactRenderer implements Renderer {
	private container: HTMLElement | null = null;
	private root: Root | null = null;
	private stateManager: ReactStateManager;
	private currentCamera: Camera = { x: 0, y: 0, zoom: 1 };

	constructor() {
		this.stateManager = new ReactStateManager();
	}

	initialize(container: HTMLElement): void {
		this.container = container;

		// Add necessary classes and attributes
		this.container.classList.add("whiteboard-canvas");
		this.container.setAttribute("role", "application");

		// Create React root
		this.root = createRoot(container);

		// Initial render
		this.render();
	}

	renderShape(shape: Shape): void {
		this.stateManager.addShape(shape);
		this.render();
	}

	updateShape(shape: Shape): void {
		this.stateManager.updateShape(shape);
		this.render();
	}

	removeShape(shapeId: string): void {
		this.stateManager.removeShape(shapeId);
		this.render();
	}

	clearShapes(): void {
		this.stateManager.clearShapes();
		this.render();
	}

	renderShapes(shapes: Shape[]): void {
		this.stateManager.setShapes(shapes);
		this.render();
	}

	updateCamera(camera: Camera): void {
		this.currentCamera = camera;
		this.stateManager.setCamera(camera);
		this.render();
	}

	renderBackground(options: BackgroundOptions): void {
		this.stateManager.setBackground(options);
		this.render();
	}

	updateBackground(options: BackgroundOptions): void {
		this.renderBackground(options);
	}

	renderSelection(shapes: Shape[]): void {
		this.stateManager.setSelectedShapes(shapes);
		this.render();
	}

	clearSelection(): void {
		this.stateManager.clearSelectedShapes();
		this.render();
	}

	renderPreview(shape: Shape | null): void {
		this.stateManager.setPreviewShape(shape);
		this.render();
	}

	clearPreview(): void {
		this.stateManager.clearPreviewShape();
		this.render();
	}

	setupEventListeners(handlers: RendererEventHandlers): () => void {
		if (!this.container) return () => {};

		// Store handlers in state manager for React components to use
		this.stateManager.setEventHandlers(handlers);

		// React components will handle events internally
		// Return cleanup function
		return () => {
			this.stateManager.clearEventHandlers();
		};
	}

	destroy(): void {
		// Unmount React
		if (this.root) {
			this.root.unmount();
			this.root = null;
		}

		// Clear state
		this.stateManager.clear();

		// Clear references
		this.container = null;
	}

	getContainer(): HTMLElement | null {
		return this.container;
	}

	private render(): void {
		if (!this.root) return;

		const state = this.stateManager.getState();

		this.root.render(
			<CanvasView
				shapes={state.shapes}
				camera={state.camera}
				selectedShapes={state.selectedShapes}
				previewShape={state.previewShape}
				background={state.background}
				onPointerDown={this.handlePointerDown.bind(this)}
				onPointerMove={this.handlePointerMove.bind(this)}
				onPointerUp={this.handlePointerUp.bind(this)}
				onWheel={this.handleWheel.bind(this)}
			/>,
		);
	}

	private handlePointerDown(event: React.PointerEvent): void {
		const handlers = this.stateManager.getEventHandlers();
		if (handlers?.onPointerDown && this.container) {
			const mousePos = getCanvasMousePosition(event.nativeEvent, this.container);
			const worldPos = screenToWorld(mousePos, this.currentCamera);
			handlers.onPointerDown(event.nativeEvent, worldPos);
		}
	}

	private handlePointerMove(event: React.PointerEvent): void {
		const handlers = this.stateManager.getEventHandlers();
		if (handlers?.onPointerMove && this.container) {
			const mousePos = getCanvasMousePosition(event.nativeEvent, this.container);
			const worldPos = screenToWorld(mousePos, this.currentCamera);
			handlers.onPointerMove(event.nativeEvent, worldPos);
		}
	}

	private handlePointerUp(event: React.PointerEvent): void {
		const handlers = this.stateManager.getEventHandlers();
		if (handlers?.onPointerUp && this.container) {
			const mousePos = getCanvasMousePosition(event.nativeEvent, this.container);
			const worldPos = screenToWorld(mousePos, this.currentCamera);
			handlers.onPointerUp(event.nativeEvent, worldPos);
		}
	}

	private handleWheel(event: React.WheelEvent): void {
		const handlers = this.stateManager.getEventHandlers();
		if (handlers?.onWheel) {
			handlers.onWheel(event.nativeEvent);
		}
	}
}
