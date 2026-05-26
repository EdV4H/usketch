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
} from "@edv4h/usketch-shared";
import { createAddShapeCommand } from "@edv4h/usketch-store";
import type { CounterShapeData } from "./types.js";

// ── Shape Definition ──

/**
 * Simplified LOD component: shows only the current count, large and centered.
 * The +/- buttons are dropped because LOD mode is not interactive anyway.
 */
function SimplifiedCounter({ shape }: { shape: ShapeData }) {
	const data = shape as CounterShapeData;
	const count = data.count ?? 0;
	const rotation = typeof shape.rotation === "number" ? shape.rotation : 0;
	return (
		<div
			style={{
				position: "absolute",
				left: shape.x,
				top: shape.y,
				width: shape.width,
				height: shape.height,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background: (shape.style?.fill as string) || "#ffffff",
				border: `1px solid ${(shape.style?.stroke as string) || "#999999"}`,
				borderRadius: 4,
				fontSize: Math.max(12, Math.min(shape.width, shape.height) * 0.4),
				fontWeight: 700,
				color: "#222",
				pointerEvents: "none",
				overflow: "hidden",
				transform: rotation ? `rotate(${rotation}deg)` : undefined,
				transformOrigin: "center center",
			}}
		>
			{count}
		</div>
	);
}

function render(shape: ShapeData) {
	const data = shape as CounterShapeData;
	const count = data.count ?? 0;

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				gap: 8,
				background: data.style.fill,
				border: `${data.style.strokeWidth}px solid ${data.style.stroke}`,
				borderRadius: 8,
				fontFamily: "system-ui, sans-serif",
				userSelect: "none",
				boxSizing: "border-box",
			}}
		>
			<div style={{ fontSize: 32, fontWeight: "bold", color: "#1e1e1e" }}>{count}</div>
			<div style={{ display: "flex", gap: 8 }}>
				<button
					type="button"
					onPointerDown={(e) => e.stopPropagation()}
					onClick={(e) => {
						e.stopPropagation();
						// Dispatch a custom event that the plugin listens to
						window.dispatchEvent(
							new CustomEvent("usketch:counter-update", {
								detail: { id: data.id, delta: -1 },
							}),
						);
					}}
					style={buttonStyle}
				>
					−
				</button>
				<button
					type="button"
					onPointerDown={(e) => e.stopPropagation()}
					onClick={(e) => {
						e.stopPropagation();
						window.dispatchEvent(
							new CustomEvent("usketch:counter-update", {
								detail: { id: data.id, delta: 1 },
							}),
						);
					}}
					style={buttonStyle}
				>
					+
				</button>
			</div>
		</div>
	);
}

const buttonStyle: React.CSSProperties = {
	width: 32,
	height: 32,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	border: "1px solid #ccc",
	borderRadius: 6,
	background: "#f5f5f5",
	fontSize: 18,
	cursor: "pointer",
	color: "#333",
};

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
	return { ...data, x, y, width: Math.max(100, width), height: Math.max(100, height) };
}

function createDefault(params: { id: string; x: number; y: number }): CounterShapeData {
	return {
		id: params.id,
		type: "counter",
		x: params.x,
		y: params.y,
		width: 140,
		height: 120,
		style: { fill: "#ffffff", stroke: "#1e1e1e", strokeWidth: 2, opacity: 1 },
		count: 0,
	};
}

// ── Icon ──

function CounterIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20">
			<rect
				x="3"
				y="3"
				width="14"
				height="14"
				rx="2"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			<text x="10" y="13" textAnchor="middle" fontSize="10" fill="currentColor">
				#
			</text>
		</svg>
	);
}

// ── Plugin ──

export function createCounterPlugin(): UsketchPlugin {
	return {
		id: "usketch-plugin-shape-counter",
		name: "カウンター",

		setup(ctx: PluginContext) {
			// Register shape with HTML render target
			ctx.shapes.register("counter", {
				render,
				getBounds,
				hitTest,
				resize,
				createDefault,
				renderTarget: "html",
				minSize: { width: 100, height: 100 },
				simplifiedComponent: SimplifiedCounter,
			});

			// Listen for counter updates from the rendered buttons
			const onCounterUpdate = (e: Event) => {
				const { id, delta } = (e as CustomEvent).detail;
				const shape = ctx.store.getShape(id) as CounterShapeData | undefined;
				if (shape) {
					const count = (shape.count ?? 0) + delta;
					ctx.store.updateShape(id, { count } as Partial<ShapeData>);
				}
			};
			window.addEventListener("usketch:counter-update", onCounterUpdate);

			// Draw tool
			let drawState: { startX: number; startY: number; shapeId: string } | null = null;

			function onPointerDown(toolCtx: ToolContext, event: CanvasPointerEvent) {
				const id = generateId();
				drawState = { startX: event.worldPoint.x, startY: event.worldPoint.y, shapeId: id };
				const shape = createDefault({ id, x: event.worldPoint.x, y: event.worldPoint.y });
				shape.width = 0;
				shape.height = 0;
				toolCtx.store.addShape(shape);
			}

			function onPointerMove(toolCtx: ToolContext, event: CanvasPointerEvent) {
				if (!drawState) return;
				const x = Math.min(drawState.startX, event.worldPoint.x);
				const y = Math.min(drawState.startY, event.worldPoint.y);
				const width = Math.abs(event.worldPoint.x - drawState.startX);
				const height = Math.abs(event.worldPoint.y - drawState.startY);
				toolCtx.store.updateShape(drawState.shapeId, { x, y, width, height });
			}

			function onPointerUp(toolCtx: ToolContext) {
				if (!drawState) return;
				const shape = toolCtx.store.getShape(drawState.shapeId);
				if (shape && shape.width < 10 && shape.height < 10) {
					// Too small — replace with default size
					toolCtx.store.deleteShape(drawState.shapeId);
					const defaultShape = createDefault({
						id: drawState.shapeId,
						x: drawState.startX - 70,
						y: drawState.startY - 60,
					});
					toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, defaultShape));
				} else if (shape) {
					// Finalize via command for undo support
					toolCtx.store.deleteShape(drawState.shapeId);
					toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, shape));
				}
				drawState = null;
				toolCtx.store.setActiveToolId("select");
			}

			ctx.tools.register("counter-draw", {
				icon: CounterIcon,
				cursor: "crosshair",
				shortcut: "c",
				order: 40,
				onPointerDown,
				onPointerMove,
				onPointerUp,
			});

			return () => {
				window.removeEventListener("usketch:counter-update", onCounterUpdate);
			};
		},
	};
}
