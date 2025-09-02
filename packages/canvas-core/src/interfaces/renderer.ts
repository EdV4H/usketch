import type { BackgroundOptions } from "@usketch/backgrounds";
import type { Camera, Shape } from "@usketch/shared-types";

/**
 * Renderer interface for abstracting the rendering layer
 * This allows different rendering implementations (Vanilla DOM, React, Vue, etc.)
 */
export interface Renderer {
	/**
	 * Initialize the renderer with a container element
	 */
	initialize(container: HTMLElement): void;

	/**
	 * Render a single shape
	 */
	renderShape(shape: Shape): void;

	/**
	 * Update an existing shape
	 */
	updateShape(shape: Shape): void;

	/**
	 * Remove a shape from the rendering
	 */
	removeShape(shapeId: string): void;

	/**
	 * Clear all shapes from the rendering
	 */
	clearShapes(): void;

	/**
	 * Render multiple shapes at once (batch operation)
	 */
	renderShapes(shapes: Shape[]): void;

	/**
	 * Update the camera transformation
	 */
	updateCamera(camera: Camera): void;

	/**
	 * Render the background
	 */
	renderBackground(options: BackgroundOptions): void;

	/**
	 * Update background
	 */
	updateBackground(options: BackgroundOptions): void;

	/**
	 * Render selection indicators for selected shapes
	 */
	renderSelection(shapes: Shape[]): void;

	/**
	 * Clear selection indicators
	 */
	clearSelection(): void;

	/**
	 * Render a preview shape (for drawing tools)
	 */
	renderPreview(shape: Shape | null): void;

	/**
	 * Clear the preview
	 */
	clearPreview(): void;

	/**
	 * Set up event listeners on the renderer's container
	 * Returns a cleanup function
	 */
	setupEventListeners(handlers: RendererEventHandlers): () => void;

	/**
	 * Destroy the renderer and clean up resources
	 */
	destroy(): void;

	/**
	 * Get the container element
	 */
	getContainer(): HTMLElement | null;
}

/**
 * Event handlers that the renderer should support
 */
export interface RendererEventHandlers {
	onPointerDown?: (event: PointerEvent, worldPos: { x: number; y: number }) => void;
	onPointerMove?: (event: PointerEvent, worldPos: { x: number; y: number }) => void;
	onPointerUp?: (event: PointerEvent, worldPos: { x: number; y: number }) => void;
	onWheel?: (event: WheelEvent) => void;
	onKeyDown?: (event: KeyboardEvent) => void;
	onKeyUp?: (event: KeyboardEvent) => void;
}

/**
 * Renderer factory function type
 */
export type RendererFactory = (container: HTMLElement) => Renderer;
