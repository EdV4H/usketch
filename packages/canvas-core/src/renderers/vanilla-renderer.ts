import type { BackgroundOptions, BackgroundRenderer } from "@usketch/backgrounds";
import { NoneRenderer } from "@usketch/backgrounds";
import type { Camera, Shape } from "@usketch/shared-types";
import {
	applyCameraTransform,
	applyShapeTransform,
	getCanvasMousePosition,
	screenToWorld,
} from "@usketch/shared-utils";
import { SelectionLayer } from "@usketch/ui-components";
import type { Renderer, RendererEventHandlers } from "../interfaces/renderer";

/**
 * Vanilla DOM Renderer implementation
 * This renderer uses traditional DOM manipulation for rendering shapes
 */
export class VanillaRenderer implements Renderer {
	private container: HTMLElement | null = null;
	private shapesContainer: HTMLElement | null = null;
	private selectionContainer: HTMLElement | null = null;
	private previewContainer: HTMLElement | null = null;
	private backgroundContainer: HTMLElement | null = null;

	private selectionLayer: SelectionLayer | null = null;
	private backgroundRenderer: BackgroundRenderer;
	private backgroundConfig?: unknown;

	private currentCamera: Camera = { x: 0, y: 0, zoom: 1 };
	private shapeElements: Map<string, HTMLElement> = new Map();

	constructor() {
		// Default background is none
		this.backgroundRenderer = new NoneRenderer();
	}

	initialize(container: HTMLElement): void {
		this.container = container;

		// Add necessary classes and attributes
		this.container.classList.add("whiteboard-canvas");
		this.container.setAttribute("role", "application");

		// Create background container
		this.backgroundContainer = this.createElement("div", "background-layer", {
			position: "absolute",
			top: "0",
			left: "0",
			width: "100%",
			height: "100%",
			pointerEvents: "none",
		});
		container.appendChild(this.backgroundContainer);

		// Create shapes container
		this.shapesContainer = this.createElement("div", "shape-layer", {
			position: "absolute",
			top: "0",
			left: "0",
			width: "100%",
			height: "100%",
			transformOrigin: "0 0",
		});
		container.appendChild(this.shapesContainer);

		// Create preview container for drawing tools
		this.previewContainer = this.createElement("div", "preview-layer", {
			position: "absolute",
			top: "0",
			left: "0",
			width: "100%",
			height: "100%",
			transformOrigin: "0 0",
			pointerEvents: "none",
		});
		container.appendChild(this.previewContainer);

		// Create selection container
		this.selectionContainer = this.createElement("div", "selection-layer", {
			position: "absolute",
			top: "0",
			left: "0",
			width: "100%",
			height: "100%",
			transformOrigin: "0 0",
			pointerEvents: "none",
		});
		container.appendChild(this.selectionContainer);

		// Initialize selection layer
		this.selectionLayer = new SelectionLayer(this.selectionContainer);
	}

	private createElement(
		tag: string,
		className: string,
		styles: Record<string, string>,
	): HTMLElement {
		const element = document.createElement(tag);
		element.className = className;
		Object.assign(element.style, styles);
		return element;
	}

	renderShape(shape: Shape): void {
		if (!this.shapesContainer) return;

		const element = this.createShapeElement(shape);
		this.shapeElements.set(shape.id, element);
		this.shapesContainer.appendChild(element);
	}

	updateShape(shape: Shape): void {
		const element = this.shapeElements.get(shape.id);
		if (!element || !this.shapesContainer) return;

		// Remove old element and create new one
		element.remove();
		this.renderShape(shape);
	}

	removeShape(shapeId: string): void {
		const element = this.shapeElements.get(shapeId);
		if (element) {
			element.remove();
			this.shapeElements.delete(shapeId);
		}
	}

	clearShapes(): void {
		if (this.shapesContainer) {
			this.shapesContainer.innerHTML = "";
			this.shapeElements.clear();
		}
	}

	renderShapes(shapes: Shape[]): void {
		if (!this.shapesContainer) return;

		// Clear and re-render all shapes
		this.clearShapes();
		for (const shape of shapes) {
			this.renderShape(shape);
		}
	}

	updateCamera(camera: Camera): void {
		this.currentCamera = camera;

		// Update transforms for all containers
		if (this.shapesContainer) {
			applyCameraTransform(this.shapesContainer, camera);
		}
		if (this.previewContainer) {
			applyCameraTransform(this.previewContainer, camera);
		}
		if (this.selectionContainer) {
			applyCameraTransform(this.selectionContainer, camera);
		}

		// Update background
		this.renderBackgroundWithCamera(camera);
	}

	renderBackground(options: BackgroundOptions): void {
		if (!this.backgroundContainer) return;

		// Clean up existing background
		if (this.backgroundRenderer?.cleanup) {
			this.backgroundRenderer.cleanup(this.backgroundContainer);
		}

		// Set new background
		this.backgroundRenderer = options.renderer;
		this.backgroundConfig = options.config;

		// Render with current camera
		this.renderBackgroundWithCamera(this.currentCamera);
	}

	updateBackground(options: BackgroundOptions): void {
		this.renderBackground(options);
	}

	private renderBackgroundWithCamera(camera: Camera): void {
		if (this.backgroundContainer && this.backgroundRenderer) {
			this.backgroundRenderer.render(this.backgroundContainer, camera, this.backgroundConfig);
		}
	}

	renderSelection(shapes: Shape[]): void {
		if (this.selectionLayer) {
			this.selectionLayer.updateSelection(shapes);
		}
	}

	clearSelection(): void {
		if (this.selectionLayer) {
			this.selectionLayer.updateSelection([]);
		}
	}

	renderPreview(shape: Shape | null): void {
		if (!this.previewContainer) return;

		// Clear previous preview
		this.previewContainer.innerHTML = "";

		if (shape) {
			// Create preview element
			const element = this.createShapeElement(shape);
			element.style.opacity = "0.5";
			element.style.pointerEvents = "none";
			this.previewContainer.appendChild(element);
		}
	}

	clearPreview(): void {
		if (this.previewContainer) {
			this.previewContainer.innerHTML = "";
		}
	}

	setupEventListeners(handlers: RendererEventHandlers): () => void {
		if (!this.container) return () => {};

		const container = this.container;
		const cleanupFunctions: Array<() => void> = [];

		// Helper to convert mouse position to world coordinates
		const getWorldPos = (event: MouseEvent) => {
			const mousePos = getCanvasMousePosition(event, container);
			return screenToWorld(mousePos, this.currentCamera);
		};

		// Pointer events
		if (handlers.onPointerDown) {
			const handlePointerDown = (e: PointerEvent) => {
				handlers.onPointerDown!(e, getWorldPos(e));
			};
			container.addEventListener("pointerdown", handlePointerDown);
			cleanupFunctions.push(() => container.removeEventListener("pointerdown", handlePointerDown));
		}

		if (handlers.onPointerMove) {
			const handlePointerMove = (e: PointerEvent) => {
				handlers.onPointerMove!(e, getWorldPos(e));
			};
			container.addEventListener("pointermove", handlePointerMove);
			cleanupFunctions.push(() => container.removeEventListener("pointermove", handlePointerMove));
		}

		if (handlers.onPointerUp) {
			const handlePointerUp = (e: PointerEvent) => {
				handlers.onPointerUp!(e, getWorldPos(e));
			};
			container.addEventListener("pointerup", handlePointerUp);
			cleanupFunctions.push(() => container.removeEventListener("pointerup", handlePointerUp));
		}

		// Wheel event
		if (handlers.onWheel) {
			const handleWheel = (e: WheelEvent) => {
				handlers.onWheel!(e);
			};
			container.addEventListener("wheel", handleWheel, { passive: false });
			cleanupFunctions.push(() => container.removeEventListener("wheel", handleWheel));
		}

		// Keyboard events (on document)
		if (handlers.onKeyDown) {
			const handleKeyDown = (e: KeyboardEvent) => {
				handlers.onKeyDown!(e);
			};
			document.addEventListener("keydown", handleKeyDown);
			cleanupFunctions.push(() => document.removeEventListener("keydown", handleKeyDown));
		}

		if (handlers.onKeyUp) {
			const handleKeyUp = (e: KeyboardEvent) => {
				handlers.onKeyUp!(e);
			};
			document.addEventListener("keyup", handleKeyUp);
			cleanupFunctions.push(() => document.removeEventListener("keyup", handleKeyUp));
		}

		// Prevent context menu
		const handleContextMenu = (e: Event) => e.preventDefault();
		container.addEventListener("contextmenu", handleContextMenu);
		cleanupFunctions.push(() => container.removeEventListener("contextmenu", handleContextMenu));

		// Return cleanup function
		return () => {
			cleanupFunctions.forEach((cleanup) => cleanup());
		};
	}

	destroy(): void {
		// Clean up background
		if (this.backgroundRenderer?.cleanup && this.backgroundContainer) {
			this.backgroundRenderer.cleanup(this.backgroundContainer);
		}

		// Remove all DOM elements
		this.backgroundContainer?.remove();
		this.shapesContainer?.remove();
		this.previewContainer?.remove();
		this.selectionContainer?.remove();

		// Clear references
		this.container = null;
		this.backgroundContainer = null;
		this.shapesContainer = null;
		this.previewContainer = null;
		this.selectionContainer = null;
		this.selectionLayer = null;
		this.shapeElements.clear();
	}

	getContainer(): HTMLElement | null {
		return this.container;
	}

	// Shape creation methods (extracted from original Canvas class)
	private createShapeElement(shape: Shape): HTMLElement {
		const element = document.createElement("div");
		element.style.position = "absolute";
		element.style.pointerEvents = "auto";

		// Set data attributes for shape identification
		element.setAttribute("data-shape-id", shape.id);
		element.setAttribute("data-shape-type", shape.type);
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
			case "freedraw":
				this.createFreedrawElement(element, shape);
				break;
		}

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

	private createFreedrawElement(
		element: HTMLElement,
		shape: Shape & { points: Array<{ x: number; y: number }> },
	): void {
		const shapeX = shape.x || 0;
		const shapeY = shape.y || 0;
		const width = (shape as any).width || 100;
		const height = (shape as any).height || 100;
		const strokeWidth = shape.strokeWidth || 2;

		element.style.width = `${width}px`;
		element.style.height = `${height}px`;

		// Create an SVG to render the path
		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("width", width.toString());
		svg.setAttribute("height", height.toString());
		svg.style.position = "absolute";
		svg.style.top = "0";
		svg.style.left = "0";
		svg.style.width = "100%";
		svg.style.height = "100%";
		svg.style.overflow = "visible";

		// Create path element
		const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

		// Build path data
		const pathData = shape.points
			.map((point, index) => {
				const x = point.x - shapeX;
				const y = point.y - shapeY;
				return index === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
			})
			.join(" ");

		path.setAttribute("d", pathData);
		path.setAttribute("stroke", shape.strokeColor);
		path.setAttribute("stroke-width", strokeWidth.toString());
		path.setAttribute("fill", "none");
		path.setAttribute("stroke-linecap", "round");
		path.setAttribute("stroke-linejoin", "round");

		svg.appendChild(path);
		element.appendChild(svg);
	}
}
