import { expect, vi } from "vitest";

/**
 * Canvas関連のテストヘルパー
 */

/**
 * Create a mock canvas element
 */
export function createMockCanvas(width = 800, height = 600): HTMLCanvasElement {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;

	// Mock getContext
	const ctx = createMockContext2D();
	vi.spyOn(canvas, "getContext").mockImplementation((contextType: string) => {
		if (contextType === "2d") {
			return ctx;
		}
		return null;
	});

	return canvas;
}

/**
 * Create a mock 2D rendering context
 */
export function createMockContext2D(): CanvasRenderingContext2D {
	const ctx = {
		// State
		save: vi.fn(),
		restore: vi.fn(),

		// Transform
		scale: vi.fn(),
		rotate: vi.fn(),
		translate: vi.fn(),
		transform: vi.fn(),
		setTransform: vi.fn(),
		resetTransform: vi.fn(),

		// Compositing
		globalAlpha: 1,
		globalCompositeOperation: "source-over" as GlobalCompositeOperation,

		// Colors and styles
		strokeStyle: "#000000",
		fillStyle: "#000000",

		// Shadows
		shadowOffsetX: 0,
		shadowOffsetY: 0,
		shadowBlur: 0,
		shadowColor: "rgba(0, 0, 0, 0)",

		// Line styles
		lineWidth: 1,
		lineCap: "butt" as CanvasLineCap,
		lineJoin: "miter" as CanvasLineJoin,
		miterLimit: 10,
		lineDashOffset: 0,
		setLineDash: vi.fn(),
		getLineDash: vi.fn(() => []),

		// Text styles
		font: "10px sans-serif",
		textAlign: "start" as CanvasTextAlign,
		textBaseline: "alphabetic" as CanvasTextBaseline,
		direction: "ltr" as CanvasDirection,

		// Fill and stroke
		fillRect: vi.fn(),
		strokeRect: vi.fn(),
		clearRect: vi.fn(),

		// Path methods
		beginPath: vi.fn(),
		closePath: vi.fn(),
		moveTo: vi.fn(),
		lineTo: vi.fn(),
		bezierCurveTo: vi.fn(),
		quadraticCurveTo: vi.fn(),
		arc: vi.fn(),
		arcTo: vi.fn(),
		ellipse: vi.fn(),
		rect: vi.fn(),

		// Drawing paths
		fill: vi.fn(),
		stroke: vi.fn(),
		clip: vi.fn(),
		isPointInPath: vi.fn(() => false),
		isPointInStroke: vi.fn(() => false),

		// Text
		fillText: vi.fn(),
		strokeText: vi.fn(),
		measureText: vi.fn((text: string) => ({
			width: text.length * 10,
			actualBoundingBoxLeft: 0,
			actualBoundingBoxRight: text.length * 10,
			actualBoundingBoxAscent: 10,
			actualBoundingBoxDescent: 0,
			fontBoundingBoxAscent: 10,
			fontBoundingBoxDescent: 0,
		})),

		// Drawing images
		drawImage: vi.fn(),

		// Pixel manipulation
		createImageData: vi.fn((width: number, height: number) => ({
			width,
			height,
			data: new Uint8ClampedArray(width * height * 4),
			colorSpace: "srgb" as PredefinedColorSpace,
		})),
		getImageData: vi.fn((_sx: number, _sy: number, sw: number, sh: number) => ({
			width: sw,
			height: sh,
			data: new Uint8ClampedArray(sw * sh * 4),
			colorSpace: "srgb" as PredefinedColorSpace,
		})),
		putImageData: vi.fn(),

		// Gradients and patterns
		createLinearGradient: vi.fn(() => ({
			addColorStop: vi.fn(),
		})),
		createRadialGradient: vi.fn(() => ({
			addColorStop: vi.fn(),
		})),
		createPattern: vi.fn(() => null),

		// Other
		canvas: {} as HTMLCanvasElement,
		getContextAttributes: vi.fn(() => ({
			alpha: true,
			desynchronized: false,
			colorSpace: "srgb" as PredefinedColorSpace,
			willReadFrequently: false,
		})),
	};

	return ctx as unknown as CanvasRenderingContext2D;
}

/**
 * Setup canvas test environment
 */
export function setupCanvasTest(): {
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
} {
	const canvas = createMockCanvas();
	const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

	// Add canvas to document
	document.body.appendChild(canvas);

	return { canvas, ctx };
}

/**
 * Get call arguments for a specific canvas method
 */
export function getCanvasMethodCalls(
	ctx: CanvasRenderingContext2D,
	methodName: keyof CanvasRenderingContext2D,
): any[][] {
	const method = ctx[methodName];
	if (typeof method === "function" && "mock" in method) {
		return (method as any).mock.calls;
	}
	return [];
}

/**
 * Assert canvas path contains specific commands
 */
export function assertCanvasPath(
	ctx: CanvasRenderingContext2D,
	expectedCommands: Array<{
		method: keyof CanvasRenderingContext2D;
		args?: any[];
	}>,
): void {
	expectedCommands.forEach(({ method, args }) => {
		const methodFn = ctx[method];
		if (typeof methodFn === "function") {
			if (args) {
				expect(methodFn).toHaveBeenCalledWith(...args);
			} else {
				expect(methodFn).toHaveBeenCalled();
			}
		}
	});
}

/**
 * Create a mock image element
 */
export function createMockImage(src: string, width = 100, height = 100): HTMLImageElement {
	const img = new Image();
	Object.defineProperty(img, "src", {
		get: () => src,
		set: vi.fn(),
	});
	Object.defineProperty(img, "width", {
		value: width,
		writable: false,
	});
	Object.defineProperty(img, "height", {
		value: height,
		writable: false,
	});
	Object.defineProperty(img, "complete", {
		value: true,
		writable: false,
	});

	return img;
}

/**
 * Mock canvas toBlob method
 */
export function mockCanvasToBlob(canvas: HTMLCanvasElement): void {
	canvas.toBlob = vi.fn((callback: BlobCallback) => {
		const blob = new Blob(["mock"], { type: "image/png" });
		setTimeout(() => callback(blob), 0);
	});
}

/**
 * Mock canvas toDataURL method
 */
export function mockCanvasToDataURL(
	canvas: HTMLCanvasElement,
	dataURL = "data:image/png;base64,mock",
): void {
	canvas.toDataURL = vi.fn(() => dataURL);
}

/**
 * Create path commands recorder
 */
export function createPathRecorder(): {
	commands: Array<{ method: string; args: any[] }>;
	record: (ctx: CanvasRenderingContext2D) => void;
	getPath: () => string;
} {
	const commands: Array<{ method: string; args: any[] }> = [];

	const pathMethods = [
		"beginPath",
		"closePath",
		"moveTo",
		"lineTo",
		"bezierCurveTo",
		"quadraticCurveTo",
		"arc",
		"arcTo",
		"ellipse",
		"rect",
	];

	return {
		commands,
		record: (ctx: CanvasRenderingContext2D) => {
			pathMethods.forEach((method) => {
				const original = (ctx as any)[method];
				if (typeof original === "function") {
					vi.spyOn(ctx as any, method).mockImplementation((...args: any[]) => {
						commands.push({ method, args });
						return original.apply(ctx, args);
					});
				}
			});
		},
		getPath: () => {
			return commands.map(({ method, args }) => `${method}(${args.join(", ")})`).join(" → ");
		},
	};
}
