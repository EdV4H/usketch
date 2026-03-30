import {
	type CanvasPointerEvent,
	cssColorToRgbaOrDefault,
	type GpuPrimitive,
	generateId,
	type PluginContext,
	type ShapeData,
	type ToolContext,
	type UsketchPlugin,
} from "@edv4h/usketch-shared";
import { createAddShapeCommand } from "@edv4h/usketch-store";
import { BASIC_SHAPE_SUBTYPES } from "./registry.js";
import { getArrowPoints, renderArrow } from "./shapes/arrow.js";
import { getDiamondPoints, renderDiamond } from "./shapes/diamond.js";
import { renderEllipse } from "./shapes/ellipse.js";
import { renderLine } from "./shapes/line.js";
import { renderRectangle } from "./shapes/rectangle.js";
import { renderRoundedRect } from "./shapes/rounded-rect.js";
import { getStarPoints, renderStar } from "./shapes/star.js";
import { getTrianglePoints, renderTriangle } from "./shapes/triangle.js";
import { getBounds } from "./shared/bounds.js";
import { aabbHitTest, ellipseHitTest, lineHitTest, pointInPolygon } from "./shared/hit-test.js";
import { createResize } from "./shared/resize.js";

const SHAPE_RENDERERS: Record<
	string,
	(data: Parameters<typeof renderRectangle>[0]) => ReturnType<typeof renderRectangle>
> = {
	rectangle: renderRectangle,
	"rounded-rect": renderRoundedRect,
	ellipse: renderEllipse,
	triangle: renderTriangle,
	diamond: renderDiamond,
	star: renderStar,
	arrow: renderArrow,
	line: renderLine,
};

type HitTestFn = (
	data: Parameters<typeof aabbHitTest>[0],
	point: Parameters<typeof aabbHitTest>[1],
) => boolean;

const SHAPE_HIT_TESTS: Record<string, HitTestFn> = {
	rectangle: aabbHitTest,
	"rounded-rect": aabbHitTest,
	ellipse: ellipseHitTest,
	triangle: (data, point) => pointInPolygon(point, getTrianglePoints(data)),
	diamond: (data, point) => pointInPolygon(point, getDiamondPoints(data)),
	star: (data, point) => pointInPolygon(point, getStarPoints(data)),
	arrow: (data, point) => pointInPolygon(point, getArrowPoints(data)),
	line: lineHitTest,
};

type GpuPrimitiveFn = (data: ShapeData) => GpuPrimitive | null;

function rectGpuPrimitive(data: ShapeData): GpuPrimitive | null {
	return {
		kind: "rect",
		bounds: { x: data.x, y: data.y, width: data.width, height: data.height },
		cornerRadius: (data.cornerRadius as number) ?? 0,
		fill: cssColorToRgbaOrDefault(data.style.fill),
		stroke: cssColorToRgbaOrDefault(data.style.stroke),
		strokeWidth: data.style.strokeWidth,
		opacity: data.style.opacity,
		rotation: data.rotation,
	};
}

function roundedRectGpuPrimitive(data: ShapeData): GpuPrimitive | null {
	const cornerRadius = Math.min(data.width, data.height) / 4;
	return {
		kind: "rect",
		bounds: { x: data.x, y: data.y, width: data.width, height: data.height },
		cornerRadius,
		fill: cssColorToRgbaOrDefault(data.style.fill),
		stroke: cssColorToRgbaOrDefault(data.style.stroke),
		strokeWidth: data.style.strokeWidth,
		opacity: data.style.opacity,
		rotation: data.rotation,
	};
}

function ellipseGpuPrimitive(data: ShapeData): GpuPrimitive | null {
	return {
		kind: "ellipse",
		bounds: { x: data.x, y: data.y, width: data.width, height: data.height },
		fill: cssColorToRgbaOrDefault(data.style.fill),
		stroke: cssColorToRgbaOrDefault(data.style.stroke),
		strokeWidth: data.style.strokeWidth,
		opacity: data.style.opacity,
		rotation: data.rotation,
	};
}

const SHAPE_GPU_PRIMITIVES: Record<string, GpuPrimitiveFn> = {
	rectangle: rectGpuPrimitive,
	"rounded-rect": roundedRectGpuPrimitive,
	ellipse: ellipseGpuPrimitive,
};

function BasicShapeIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20">
			<rect
				x="3"
				y="4"
				width="14"
				height="12"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				rx="1"
			/>
		</svg>
	);
}

export const basicShapePlugin: UsketchPlugin = {
	id: "usketch-plugin-shape-basic",
	name: "基本シェイプ",

	setup(ctx: PluginContext) {
		// Register all 8 shape types
		for (const subtype of BASIC_SHAPE_SUBTYPES) {
			const renderer = SHAPE_RENDERERS[subtype.type];
			const hitTestFn = SHAPE_HIT_TESTS[subtype.type];
			if (!renderer || !hitTestFn) continue;

			const gpuFn = SHAPE_GPU_PRIMITIVES[subtype.type];
			ctx.shapes.register(subtype.type, {
				render: renderer,
				getBounds,
				hitTest: hitTestFn,
				resize: createResize(1, 1),
				createDefault: subtype.createDefault,
				gpuPrimitive: gpuFn,
			});
		}

		// Tool state
		let currentSubtype = BASIC_SHAPE_SUBTYPES[0].type;
		let drawState: { startX: number; startY: number; shapeId: string } | null = null;

		// Listen for subtype changes from the toolbar picker
		ctx.events.on<{ type: string }>("basic-shape:select-subtype", (data) => {
			currentSubtype = data.type;
		});

		function onPointerDown(toolCtx: ToolContext, event: CanvasPointerEvent) {
			const subtype = BASIC_SHAPE_SUBTYPES.find((s) => s.type === currentSubtype);
			if (!subtype) return;

			const id = generateId();
			drawState = { startX: event.worldPoint.x, startY: event.worldPoint.y, shapeId: id };
			const shape = subtype.createDefault({ id, x: event.worldPoint.x, y: event.worldPoint.y });
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
				toolCtx.store.deleteShape(drawState.shapeId);
				toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, shape));
			} else {
				toolCtx.store.deleteShape(drawState.shapeId);
			}
			drawState = null;
			toolCtx.store.setActiveToolId("select");
		}

		ctx.tools.register("basic-shape-draw", {
			icon: BasicShapeIcon,
			cursor: "crosshair",
			shortcut: "r",
			order: 10,
			onPointerDown,
			onPointerMove,
			onPointerUp,
		});
	},
};
