import type { BackgroundOptions } from "@usketch/backgrounds";
import type { RendererEventHandlers } from "@usketch/canvas-core";
import type { Camera, Shape } from "@usketch/shared-types";

/**
 * State manager for React renderer
 * Manages the state that React components need
 */
export class ReactStateManager {
	private shapes: Shape[] = [];
	private camera: Camera = { x: 0, y: 0, zoom: 1 };
	private selectedShapes: Shape[] = [];
	private previewShape: Shape | null = null;
	private background: BackgroundOptions | null = null;
	private eventHandlers: RendererEventHandlers | null = null;

	addShape(shape: Shape): void {
		const existing = this.shapes.findIndex((s) => s.id === shape.id);
		if (existing >= 0) {
			this.shapes[existing] = shape;
		} else {
			this.shapes.push(shape);
		}
	}

	updateShape(shape: Shape): void {
		const index = this.shapes.findIndex((s) => s.id === shape.id);
		if (index >= 0) {
			this.shapes[index] = shape;
		}
	}

	removeShape(shapeId: string): void {
		this.shapes = this.shapes.filter((s) => s.id !== shapeId);
	}

	clearShapes(): void {
		this.shapes = [];
	}

	setShapes(shapes: Shape[]): void {
		this.shapes = [...shapes];
	}

	setCamera(camera: Camera): void {
		this.camera = camera;
	}

	setSelectedShapes(shapes: Shape[]): void {
		this.selectedShapes = [...shapes];
	}

	clearSelectedShapes(): void {
		this.selectedShapes = [];
	}

	setPreviewShape(shape: Shape | null): void {
		this.previewShape = shape;
	}

	clearPreviewShape(): void {
		this.previewShape = null;
	}

	setBackground(options: BackgroundOptions): void {
		this.background = options;
	}

	setEventHandlers(handlers: RendererEventHandlers): void {
		this.eventHandlers = handlers;
	}

	clearEventHandlers(): void {
		this.eventHandlers = null;
	}

	getEventHandlers(): RendererEventHandlers | null {
		return this.eventHandlers;
	}

	getState() {
		return {
			shapes: [...this.shapes],
			camera: { ...this.camera },
			selectedShapes: [...this.selectedShapes],
			previewShape: this.previewShape,
			background: this.background,
		};
	}

	clear(): void {
		this.shapes = [];
		this.selectedShapes = [];
		this.previewShape = null;
		this.background = null;
		this.eventHandlers = null;
	}
}
