import type { Point, Shape } from "@usketch/shared-types";
import { DEFAULT_FREEDRAW_STYLES, DEFAULT_SHAPE_STYLES } from "@usketch/shared-types";
import { v4 as uuidv4 } from "uuid";
import { assign, setup } from "xstate";

// === Shape Drawing Tool (Rectangle, Ellipse, Freedraw) ===
export type ShapeType = "rectangle" | "ellipse" | "freedraw";

export interface ShapeDrawingContext {
	shapeType: ShapeType;
	startPoint: Point | null;
	currentPoint: Point | null;
	previewShape: Shape | null;
	pathCommands: string[]; // For freedraw
}

export type ShapeDrawingEvent =
	| { type: "POINTER_DOWN"; point: Point; position: Point }
	| { type: "POINTER_MOVE"; point: Point; position: Point }
	| { type: "POINTER_UP"; point: Point; position: Point }
	| { type: "ESCAPE" }
	| { type: "CANCEL" };

/**
 * Create a shape drawing tool state machine
 * Supports rectangle, ellipse, and freedraw
 */
export function createShapeDrawingTool(shapeType: ShapeType) {
	return setup({
		types: {
			context: {} as ShapeDrawingContext,
			events: {} as ShapeDrawingEvent,
		},
		actions: {
			startDrawing: assign(({ context, event }) => {
				if (event.type !== "POINTER_DOWN") return {};

				const startPoint = event.point;

				// For freedraw, initialize path
				if (context.shapeType === "freedraw") {
					return {
						startPoint,
						currentPoint: startPoint,
						pathCommands: [`M ${startPoint.x} ${startPoint.y}`],
					};
				}

				return {
					startPoint,
					currentPoint: startPoint,
				};
			}),

			updateDrawing: assign(({ context, event }) => {
				if (event.type !== "POINTER_MOVE") return {};

				const currentPoint = event.point;

				// For freedraw, add line command
				if (context.shapeType === "freedraw" && context.pathCommands) {
					return {
						currentPoint,
						pathCommands: [...context.pathCommands, `L ${currentPoint.x} ${currentPoint.y}`],
					};
				}

				return {
					currentPoint,
				};
			}),

			updatePreview: assign(({ context }) => {
				if (!context.startPoint || !context.currentPoint) return {};

				const { startPoint, currentPoint, shapeType } = context;

				if (shapeType === "rectangle") {
					const minX = Math.min(startPoint.x, currentPoint.x);
					const minY = Math.min(startPoint.y, currentPoint.y);
					const width = Math.abs(currentPoint.x - startPoint.x);
					const height = Math.abs(currentPoint.y - startPoint.y);

					return {
						previewShape: {
							id: `preview-${uuidv4()}`,
							type: "rectangle",
							x: minX,
							y: minY,
							width,
							height,
							fillColor: DEFAULT_SHAPE_STYLES.fillColor,
							strokeColor: DEFAULT_SHAPE_STYLES.strokeColor,
							strokeWidth: DEFAULT_SHAPE_STYLES.strokeWidth,
							opacity: DEFAULT_SHAPE_STYLES.opacity * 0.5,
							rotation: 0,
						} as Shape,
					};
				}

				if (shapeType === "ellipse") {
					const minX = Math.min(startPoint.x, currentPoint.x);
					const minY = Math.min(startPoint.y, currentPoint.y);
					const width = Math.abs(currentPoint.x - startPoint.x);
					const height = Math.abs(currentPoint.y - startPoint.y);

					return {
						previewShape: {
							id: `preview-${uuidv4()}`,
							type: "ellipse",
							x: minX,
							y: minY,
							width,
							height,
							fillColor: DEFAULT_SHAPE_STYLES.fillColor,
							strokeColor: DEFAULT_SHAPE_STYLES.strokeColor,
							strokeWidth: DEFAULT_SHAPE_STYLES.strokeWidth,
							opacity: DEFAULT_SHAPE_STYLES.opacity * 0.5,
							rotation: 0,
						} as Shape,
					};
				}

				if (shapeType === "freedraw" && context.pathCommands) {
					const pathData = context.pathCommands.join(" ");
					const bounds = calculatePathBounds(context.pathCommands);

					return {
						previewShape: {
							id: `preview-${uuidv4()}`,
							type: "freedraw",
							x: bounds.minX,
							y: bounds.minY,
							width: bounds.width,
							height: bounds.height,
							path: pathData,
							points: extractPointsFromPath(context.pathCommands),
							strokeColor: DEFAULT_FREEDRAW_STYLES.strokeColor,
							strokeWidth: DEFAULT_FREEDRAW_STYLES.strokeWidth,
							fillColor: DEFAULT_FREEDRAW_STYLES.fillColor,
							opacity: DEFAULT_FREEDRAW_STYLES.opacity * 0.5,
							rotation: 0,
						} as Shape,
					};
				}

				return {};
			}),

			finalizeShape: ({ context }) => {
				if (!context.startPoint || !context.currentPoint) return;

				const { startPoint, currentPoint, shapeType } = context;

				if (shapeType === "rectangle" || shapeType === "ellipse") {
					const minX = Math.min(startPoint.x, currentPoint.x);
					const minY = Math.min(startPoint.y, currentPoint.y);
					const width = Math.abs(currentPoint.x - startPoint.x);
					const height = Math.abs(currentPoint.y - startPoint.y);

					// Only create if size is significant
					if (width > 5 && height > 5) {
						const shape: Shape = {
							id: uuidv4(),
							type: shapeType,
							x: minX,
							y: minY,
							width,
							height,
							fillColor: DEFAULT_SHAPE_STYLES.fillColor,
							strokeColor: DEFAULT_SHAPE_STYLES.strokeColor,
							strokeWidth: DEFAULT_SHAPE_STYLES.strokeWidth,
							opacity: DEFAULT_SHAPE_STYLES.opacity,
							rotation: 0,
						};

						// Store in window for pickup by ToolManager
						(window as any).__lastCreatedShape = shape;
					}
				} else if (shapeType === "freedraw" && context.pathCommands) {
					const bounds = calculatePathBounds(context.pathCommands);

					if (bounds.width > 5 || bounds.height > 5) {
						const shape: Shape = {
							id: uuidv4(),
							type: "freedraw",
							x: bounds.minX,
							y: bounds.minY,
							width: bounds.width,
							height: bounds.height,
							path: context.pathCommands.join(" "),
							points: extractPointsFromPath(context.pathCommands),
							strokeColor: DEFAULT_FREEDRAW_STYLES.strokeColor,
							strokeWidth: DEFAULT_FREEDRAW_STYLES.strokeWidth,
							fillColor: DEFAULT_FREEDRAW_STYLES.fillColor,
							opacity: DEFAULT_FREEDRAW_STYLES.opacity,
							rotation: 0,
						};

						(window as any).__lastCreatedShape = shape;
					}
				}
			},

			clearPreview: assign(() => ({
				previewShape: null,
				startPoint: null,
				currentPoint: null,
				pathCommands: [],
			})),
		},
		guards: {
			hasValidSize: ({ context }) => {
				if (!context.startPoint || !context.currentPoint) return false;
				const width = Math.abs(context.currentPoint.x - context.startPoint.x);
				const height = Math.abs(context.currentPoint.y - context.startPoint.y);
				return width > 5 || height > 5;
			},
		},
	}).createMachine({
		id: `${shapeType}Tool`,
		initial: "idle",
		context: {
			shapeType,
			startPoint: null,
			currentPoint: null,
			previewShape: null,
			pathCommands: [],
		},
		states: {
			idle: {
				on: {
					POINTER_DOWN: {
						target: "drawing",
						actions: "startDrawing",
					},
				},
			},
			drawing: {
				entry: "updatePreview",
				on: {
					POINTER_MOVE: {
						actions: ["updateDrawing", "updatePreview"],
					},
					POINTER_UP: {
						target: "idle",
						actions: ["finalizeShape", "clearPreview"],
					},
					ESCAPE: {
						target: "idle",
						actions: "clearPreview",
					},
					CANCEL: {
						target: "idle",
						actions: "clearPreview",
					},
				},
			},
		},
	});
}

// Helper functions
function calculatePathBounds(pathCommands: string[]) {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	pathCommands.forEach((cmd) => {
		const matches = cmd.match(/[\d.-]+/g);
		if (matches && matches.length >= 2) {
			const x = parseFloat(matches[0]);
			const y = parseFloat(matches[1]);
			minX = Math.min(minX, x);
			minY = Math.min(minY, y);
			maxX = Math.max(maxX, x);
			maxY = Math.max(maxY, y);
		}
	});

	return {
		minX,
		minY,
		width: maxX - minX,
		height: maxY - minY,
	};
}

function extractPointsFromPath(pathCommands: string[]): Point[] {
	return pathCommands
		.map((cmd) => {
			const matches = cmd.match(/[\d.-]+/g);
			if (matches && matches.length >= 2) {
				return {
					x: parseFloat(matches[0]),
					y: parseFloat(matches[1]),
				};
			}
			return null;
		})
		.filter((p): p is Point => p !== null);
}

// Export pre-configured tools
export const rectangleToolMachine = createShapeDrawingTool("rectangle");
export const ellipseToolMachine = createShapeDrawingTool("ellipse");
export const freedrawToolMachine = createShapeDrawingTool("freedraw");
