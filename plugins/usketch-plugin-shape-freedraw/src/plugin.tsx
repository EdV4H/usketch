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
	const points = (data.points as Point[]) ?? [];
	const pointsStr = points.map((p) => `${p.x},${p.y}`).join(" ");
	return (
		<polyline
			points={pointsStr}
			fill="none"
			stroke={data.style.stroke}
			strokeWidth={data.style.strokeWidth}
			opacity={data.style.opacity}
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	);
}

function getBounds(data: ShapeData): BoundingBox {
	const points = (data.points as Point[]) ?? [];
	if (points.length === 0) {
		return { x: data.x, y: data.y, width: 0, height: 0 };
	}
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (const p of points) {
		if (p.x < minX) minX = p.x;
		if (p.y < minY) minY = p.y;
		if (p.x > maxX) maxX = p.x;
		if (p.y > maxY) maxY = p.y;
	}
	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const lenSq = dx * dx + dy * dy;
	if (lenSq === 0) {
		const ex = point.x - a.x;
		const ey = point.y - a.y;
		return Math.sqrt(ex * ex + ey * ey);
	}
	let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq;
	t = Math.max(0, Math.min(1, t));
	const projX = a.x + t * dx;
	const projY = a.y + t * dy;
	const ex = point.x - projX;
	const ey = point.y - projY;
	return Math.sqrt(ex * ex + ey * ey);
}

function hitTest(data: ShapeData, point: Point): boolean {
	const points = (data.points as Point[]) ?? [];
	const threshold = 5;
	for (let i = 0; i < points.length - 1; i++) {
		if (distanceToSegment(point, points[i], points[i + 1]) <= threshold) {
			return true;
		}
	}
	return false;
}

function resize(data: ShapeData, handle: ResizeHandle, delta: Point): ShapeData {
	const points = (data.points as Point[]) ?? [];
	const bounds = getBounds(data);
	if (bounds.width === 0 && bounds.height === 0) return data;

	let newX = bounds.x;
	let newY = bounds.y;
	let newWidth = bounds.width;
	let newHeight = bounds.height;

	switch (handle) {
		case "se":
			newWidth += delta.x;
			newHeight += delta.y;
			break;
		case "nw":
			newX += delta.x;
			newY += delta.y;
			newWidth -= delta.x;
			newHeight -= delta.y;
			break;
		case "ne":
			newY += delta.y;
			newWidth += delta.x;
			newHeight -= delta.y;
			break;
		case "sw":
			newX += delta.x;
			newWidth -= delta.x;
			newHeight += delta.y;
			break;
		case "e":
			newWidth += delta.x;
			break;
		case "w":
			newX += delta.x;
			newWidth -= delta.x;
			break;
		case "n":
			newY += delta.y;
			newHeight -= delta.y;
			break;
		case "s":
			newHeight += delta.y;
			break;
	}

	newWidth = Math.max(1, newWidth);
	newHeight = Math.max(1, newHeight);

	const scaleX = bounds.width !== 0 ? newWidth / bounds.width : 1;
	const scaleY = bounds.height !== 0 ? newHeight / bounds.height : 1;

	const newPoints = points.map((p) => ({
		x: newX + (p.x - bounds.x) * scaleX,
		y: newY + (p.y - bounds.y) * scaleY,
	}));

	return {
		...data,
		x: newX,
		y: newY,
		width: newWidth,
		height: newHeight,
		points: newPoints,
	};
}

function move(data: ShapeData, dx: number, dy: number): Partial<ShapeData> {
	const points = (data.points as Point[]) ?? [];
	return {
		x: data.x + dx,
		y: data.y + dy,
		points: points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
	};
}

function applyBounds(data: ShapeData, newBounds: BoundingBox): Partial<ShapeData> {
	const points = (data.points as Point[]) ?? [];
	const oldBounds = getBounds(data);
	const scaleX = oldBounds.width !== 0 ? newBounds.width / oldBounds.width : 1;
	const scaleY = oldBounds.height !== 0 ? newBounds.height / oldBounds.height : 1;
	return {
		x: newBounds.x,
		y: newBounds.y,
		width: newBounds.width,
		height: newBounds.height,
		points: points.map((p) => ({
			x: newBounds.x + (p.x - oldBounds.x) * scaleX,
			y: newBounds.y + (p.y - oldBounds.y) * scaleY,
		})),
	};
}

function createDefault(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: "freedraw",
		x: params.x,
		y: params.y,
		width: 0,
		height: 0,
		style: { ...DEFAULT_STYLE },
		points: [],
	};
}

function computeBounds(points: Point[]): BoundingBox {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (const p of points) {
		if (p.x < minX) minX = p.x;
		if (p.y < minY) minY = p.y;
		if (p.x > maxX) maxX = p.x;
		if (p.y > maxY) maxY = p.y;
	}
	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function FreedrawIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20">
			<path
				d="M4 16 C6 10, 10 4, 16 6"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
		</svg>
	);
}

export const freedrawPlugin: UsketchPlugin = {
	id: "usketch-plugin-shape-freedraw",
	name: "フリーハンド",

	setup(ctx: PluginContext) {
		// ── Local draw state (scoped to this setup closure) ──
		let drawState: { shapeId: string; points: Point[] } | null = null;

		function onPointerDown(toolCtx: ToolContext, event: CanvasPointerEvent) {
			const id = generateId();
			const startPoint: Point = { x: event.worldPoint.x, y: event.worldPoint.y };
			drawState = { shapeId: id, points: [startPoint] };
			const shape = createDefault({ id, x: startPoint.x, y: startPoint.y });
			shape.points = [startPoint];
			shape.style = { ...toolCtx.store.getStyleSettings() };
			toolCtx.store.addShape(shape);
		}

		function onPointerMove(toolCtx: ToolContext, event: CanvasPointerEvent) {
			if (!drawState) return;
			const newPoint: Point = { x: event.worldPoint.x, y: event.worldPoint.y };
			drawState.points.push(newPoint);

			const bounds = computeBounds(drawState.points);
			toolCtx.store.updateShape(drawState.shapeId, {
				x: bounds.x,
				y: bounds.y,
				width: bounds.width,
				height: bounds.height,
				points: [...drawState.points],
			});
		}

		function onPointerUp(toolCtx: ToolContext) {
			if (!drawState) return;
			const shape = toolCtx.store.getShape(drawState.shapeId);
			if (shape && drawState.points.length > 1) {
				// Replace with undoable command
				toolCtx.store.deleteShape(drawState.shapeId);
				toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, shape));
			} else {
				toolCtx.store.deleteShape(drawState.shapeId);
			}
			drawState = null;
			toolCtx.store.setActiveToolId("select");
		}

		ctx.shapes.register("freedraw", {
			render,
			getBounds,
			hitTest,
			resize,
			createDefault,
			move,
			applyBounds,
		});

		ctx.tools.register("freedraw-draw", {
			icon: FreedrawIcon,
			cursor: "crosshair",
			shortcut: "p",
			order: 30,
			onPointerDown,
			onPointerMove,
			onPointerUp,
		});
	},
};
