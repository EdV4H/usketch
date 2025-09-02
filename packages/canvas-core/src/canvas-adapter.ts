import type { BackgroundOptions } from "@usketch/backgrounds";
import { whiteboardStore } from "@usketch/store";
import type { ToolManager } from "@usketch/tools";
import { CanvasManager } from "./managers/canvas-manager";
import { VanillaRenderer } from "./renderers/vanilla-renderer";

export interface CanvasOptions {
	background?: BackgroundOptions;
}

/**
 * Canvas Adapter - Maintains backward compatibility with existing Canvas API
 * while using the new CanvasManager and Renderer architecture
 */
export class Canvas {
	private canvasManager: CanvasManager;
	private renderer: VanillaRenderer;

	constructor(canvasElement: HTMLElement, options?: CanvasOptions) {
		// Create renderer and manager
		this.renderer = new VanillaRenderer();
		this.canvasManager = new CanvasManager(this.renderer, canvasElement);

		// Set initial background if provided
		if (options?.background) {
			this.canvasManager.setBackground(options.background);
		}

		// Expose for debugging in dev mode
		// We'll rely on bundler to handle this
		if (typeof window !== "undefined") {
			(window as any).__whiteboardStore = whiteboardStore;
			(window as any).__canvas = this;
		}
	}

	/**
	 * Set the background of the canvas
	 */
	public setBackground(options: BackgroundOptions): void {
		this.canvasManager.setBackground(options);
	}

	/**
	 * Add a test shape for demonstration
	 */
	public addTestShape(): void {
		this.canvasManager.addTestShape();
	}

	/**
	 * Get the tool manager instance
	 */
	public getToolManager(): ToolManager {
		return this.canvasManager.getToolManager();
	}

	/**
	 * Get the store instance
	 */
	public getStore(): typeof whiteboardStore {
		return this.canvasManager.getStore();
	}

	/**
	 * Clean up and destroy the canvas
	 */
	public destroy(): void {
		this.canvasManager.destroy();
	}
}
