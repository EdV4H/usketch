import {
	type BoundingBox,
	type CanvasPointerEvent,
	DEFAULT_STYLE,
	generateId,
	type PluginContext,
	type Point,
	type ResizeHandle,
	type ShapeData,
	type ToolContext,
	type UsketchPlugin,
} from "@edv4h/usketch-shared";
import { createAddShapeCommand } from "@edv4h/usketch-store";

function render(data: ShapeData) {
	const cx = data.x + data.width / 2;
	const cy = data.y + data.height / 2;
	const rx = data.width / 2;
	const ry = data.height / 2;
	return (
		<ellipse
			cx={cx}
			cy={cy}
			rx={rx}
			ry={ry}
			fill={data.style.fill}
			stroke={data.style.stroke}
			strokeWidth={data.style.strokeWidth}
			opacity={data.style.opacity}
		/>
	);
}

function getBounds(data: ShapeData): BoundingBox {
	return { x: data.x, y: data.y, width: data.width, height: data.height };
}

function hitTest(data: ShapeData, point: Point): boolean {
	const cx = data.x + data.width / 2;
	const cy = data.y + data.height / 2;
	const rx = data.width / 2;
	const ry = data.height / 2;
	if (rx === 0 || ry === 0) return false;
	const dx = (point.x - cx) / rx;
	const dy = (point.y - cy) / ry;
	return dx * dx + dy * dy <= 1;
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
	return { ...data, x, y, width: Math.max(1, width), height: Math.max(1, height) };
}

function createDefault(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: "ellipse",
		x: params.x,
		y: params.y,
		width: 100,
		height: 80,
		style: { ...DEFAULT_STYLE },
	};
}

function EllipseIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20">
			<ellipse cx="10" cy="10" rx="7" ry="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
		</svg>
	);
}

export const ellipsePlugin: UsketchPlugin = {
	id: "usketch-plugin-shape-ellipse",
	name: "楕円",
	type: "shape",

	setup(ctx: PluginContext) {
		// ── Local draw state (scoped to this setup closure) ──
		let drawState: { startX: number; startY: number; shapeId: string } | null = null;

		function onPointerDown(toolCtx: ToolContext, event: CanvasPointerEvent) {
			const id = generateId();
			drawState = { startX: event.worldPoint.x, startY: event.worldPoint.y, shapeId: id };
			const shape = createDefault({ id, x: event.worldPoint.x, y: event.worldPoint.y });
			shape.width = 0;
			shape.height = 0;
			shape.style = { ...toolCtx.store.getStyleSettings() };
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
			if (shape && shape.width > 2 && shape.height > 2) {
				// Replace with undoable command
				toolCtx.store.deleteShape(drawState.shapeId);
				toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, shape));
			} else {
				toolCtx.store.deleteShape(drawState.shapeId);
			}
			drawState = null;
			toolCtx.store.setActiveToolId("select");
		}

		ctx.shapes.register("ellipse", {
			render,
			getBounds,
			hitTest,
			resize,
			createDefault,
		});

		ctx.tools.register("ellipse-draw", {
			icon: EllipseIcon,
			cursor: "crosshair",
			shortcut: "o",
			order: 20,
			onPointerDown,
			onPointerMove,
			onPointerUp,
		});
	},
};
