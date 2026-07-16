import { createEditableTextController } from "@edv4h/usketch-shape-utils";
import {
	type BoundingBox,
	type CanvasPointerEvent,
	generateId,
	type PluginContext,
	type Point,
	type ResizeHandle,
	type ShapeData,
	type ToolContext,
	type UsketchPlugin,
	withRotation,
} from "@edv4h/usketch-shared";
import { createAddShapeCommand } from "@edv4h/usketch-store";
import {
	DEFAULT_STICKY_COLOR,
	DEFAULT_STICKY_SIZE,
	STICKY_COLOR_KEYS,
	STICKY_COLORS,
} from "./constants.js";
import { render } from "./render.js";
import type { StickyShapeData } from "./types.js";

export type { StickyShapeData } from "./types.js";

/**
 * LOD component: colored rectangle with one line of text truncated.
 * Drops the rich formatting / editing affordances.
 */
function SimplifiedSticky({ shape }: { shape: ShapeData }) {
	const data = shape as StickyShapeData;
	const fill = data.style?.fill || data.color || "#fff59d";
	const text = String(data.text ?? "").split("\n")[0] ?? "";
	const rotation = typeof data.rotation === "number" ? data.rotation : 0;
	return (
		<div
			style={{
				position: "absolute",
				left: data.x,
				top: data.y,
				width: data.width,
				height: data.height,
				background: fill,
				boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
				padding: 6,
				fontSize: Math.max(10, data.height * 0.18),
				color: "#333",
				overflow: "hidden",
				whiteSpace: "nowrap",
				textOverflow: "ellipsis",
				pointerEvents: "none",
				transform: rotation ? `rotate(${rotation}deg)` : undefined,
				transformOrigin: "center center",
			}}
		>
			{text}
		</div>
	);
}

// ── Shape helpers ──

function getBounds(data: ShapeData): BoundingBox {
	return { x: data.x, y: data.y, width: data.width, height: data.height };
}

function hitTest(data: ShapeData, point: Point): boolean {
	return (
		point.x >= data.x &&
		point.x <= data.x + data.width &&
		point.y >= data.y &&
		point.y <= data.y + data.height
	);
}

function resize(data: ShapeData, handle: ResizeHandle, delta: Point): ShapeData {
	let { x, y, width, height } = data;
	switch (handle) {
		case "se":
			width += delta.x;
			height += delta.y;
			break;
		case "nw":
			x += delta.x;
			y += delta.y;
			width -= delta.x;
			height -= delta.y;
			break;
		case "ne":
			y += delta.y;
			width += delta.x;
			height -= delta.y;
			break;
		case "sw":
			x += delta.x;
			width -= delta.x;
			height += delta.y;
			break;
		case "e":
			width += delta.x;
			break;
		case "w":
			x += delta.x;
			width -= delta.x;
			break;
		case "n":
			y += delta.y;
			height -= delta.y;
			break;
		case "s":
			height += delta.y;
			break;
	}
	return {
		...data,
		x,
		y,
		width: Math.max(100, width),
		height: Math.max(100, height),
	};
}

function createDefault(params: { id: string; x: number; y: number }): StickyShapeData {
	return {
		id: params.id,
		type: "sticky",
		x: params.x,
		y: params.y,
		width: DEFAULT_STICKY_SIZE.width,
		height: DEFAULT_STICKY_SIZE.height,
		style: {
			fill: STICKY_COLORS[DEFAULT_STICKY_COLOR],
			stroke: "none",
			strokeWidth: 0,
			opacity: 1,
		},
		text: "",
		fontSize: 16,
		isEditing: false,
		stickyColor: DEFAULT_STICKY_COLOR,
	};
}

function serializeForAi(shape: ShapeData): Record<string, unknown> {
	const data = shape as StickyShapeData;
	return { text: data.text, stickyColor: data.stickyColor };
}

function debugFields(shape: ShapeData): Record<string, unknown> {
	// Mirror the renderer's `??` fallbacks so the HUD shows the value the user
	// actually sees on the canvas, not a placeholder zero / blank.
	const data = shape as StickyShapeData;
	return {
		text: data.text ?? "",
		fontSize: data.fontSize ?? 16,
		stickyColor: data.stickyColor ?? DEFAULT_STICKY_COLOR,
		isEditing: data.isEditing ?? false,
	};
}

// ── Icon ──

function StickyIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20">
			<path
				d="M4 3h12a1 1 0 011 1v9l-4 4H4a1 1 0 01-1-1V4a1 1 0 011-1z"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinejoin="round"
			/>
			<path d="M13 13v4l4-4h-4z" fill="currentColor" opacity="0.3" />
		</svg>
	);
}

// ── Plugin ──

export function createStickyPlugin(): UsketchPlugin {
	return {
		id: "usketch-plugin-shape-sticky",
		name: "付箋",

		setup(ctx: PluginContext) {
			// Shared editable-text controller (machine + DOM/canvas wiring).
			const editor = createEditableTextController(ctx, {
				isEditableType: (type) => type === "sticky",
				hitTest,
				growHeight: true,
				minHeight: 100,
			});

			// ── Sticky color state ──
			let currentColor = DEFAULT_STICKY_COLOR;

			ctx.events.on<{ color: string }>("sticky:select-color", (data) => {
				currentColor = data.color;
			});

			// ── 操作を Action として公開（Control HUD が自動でUI化） ──
			const offColorAction = ctx.actions.register({
				id: "sticky:select-color",
				label: "Sticky color",
				group: "Sticky",
				params: [
					{
						name: "color",
						type: "enum",
						default: DEFAULT_STICKY_COLOR,
						options: STICKY_COLOR_KEYS.map((k) => ({ value: String(k), label: String(k) })),
					},
				],
				run: ({ color }) => ctx.events.emit("sticky:select-color", { color }),
			});

			// ── Shape registration ──
			ctx.shapes.register("sticky", {
				render,
				getBounds,
				hitTest: withRotation(hitTest),
				resize,
				createDefault,
				renderTarget: "html",
				minSize: { width: 100, height: 100 },
				simplifiedComponent: SimplifiedSticky,
				serializeForAi,
				debugFields,
			});

			// ── Draw tool registration ──
			let drawState: { startX: number; startY: number; shapeId: string } | null = null;

			ctx.tools.register("sticky-draw", {
				icon: StickyIcon,
				cursor: "crosshair",
				shortcut: "s",
				order: 26,

				onPointerDown(toolCtx: ToolContext, event: CanvasPointerEvent) {
					const id = generateId();
					const shape = createDefault({ id, x: event.worldPoint.x, y: event.worldPoint.y });
					shape.stickyColor = currentColor;
					shape.style = {
						...shape.style,
						fill: STICKY_COLORS[currentColor] ?? STICKY_COLORS[DEFAULT_STICKY_COLOR],
					};
					drawState = { startX: event.worldPoint.x, startY: event.worldPoint.y, shapeId: id };
					shape.width = 0;
					shape.height = 0;
					toolCtx.store.addShape(shape);
				},

				onPointerMove(toolCtx: ToolContext, event: CanvasPointerEvent) {
					if (!drawState) return;
					const x = Math.min(drawState.startX, event.worldPoint.x);
					const y = Math.min(drawState.startY, event.worldPoint.y);
					const width = Math.abs(event.worldPoint.x - drawState.startX);
					const height = Math.abs(event.worldPoint.y - drawState.startY);
					toolCtx.store.updateShape(drawState.shapeId, { x, y, width, height });
				},

				onPointerUp(toolCtx: ToolContext) {
					if (!drawState) return;
					const shape = toolCtx.store.getShape(drawState.shapeId);
					toolCtx.store.deleteShape(drawState.shapeId);

					if (shape && shape.width > 2 && shape.height > 2) {
						// Dragged: use custom size
						toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, shape));
						toolCtx.store.setSelection([shape.id]);
					} else {
						// Clicked: use default size, center on click point
						const defaultShape = createDefault({
							id: drawState.shapeId,
							x: drawState.startX - DEFAULT_STICKY_SIZE.width / 2,
							y: drawState.startY - DEFAULT_STICKY_SIZE.height / 2,
						});
						defaultShape.stickyColor = currentColor;
						defaultShape.style = {
							...defaultShape.style,
							fill: STICKY_COLORS[currentColor] ?? STICKY_COLORS[DEFAULT_STICKY_COLOR],
						};
						toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, defaultShape));
						toolCtx.store.setSelection([defaultShape.id]);
						editor.beginEdit(defaultShape.id);
					}

					drawState = null;
					toolCtx.store.resetToDefaultTool();
				},
			});

			// ── Teardown ──
			return () => {
				editor.teardown();
				offColorAction();
			};
		},
	};
}
