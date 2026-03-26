import type {
	CanvasPointerEvent,
	PluginContext,
	ShapeData,
	ToolContext,
	UsketchPlugin,
} from "@edv4h/usketch-shared";
import { generateId } from "@edv4h/usketch-shared";
import { containsAABB, createAddShapeCommand, createReparentCommand } from "@edv4h/usketch-store";
import {
	createDefaultFrame,
	getBoundsFrame,
	hitTestFrame,
	renderFrame,
	resizeFrame,
} from "./shapes/frame.js";

function FrameIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
			{/* Hash/frame grid */}
			<line x1="7" y1="2" x2="7" y2="18" strokeWidth="1.5" strokeLinecap="round" />
			<line x1="13" y1="2" x2="13" y2="18" strokeWidth="1.5" strokeLinecap="round" />
			<line x1="2" y1="7" x2="18" y2="7" strokeWidth="1.5" strokeLinecap="round" />
			<line x1="2" y1="13" x2="18" y2="13" strokeWidth="1.5" strokeLinecap="round" />
		</svg>
	);
}

export const framePlugin: UsketchPlugin = {
	id: "usketch-plugin-shape-frame",
	name: "フレーム",

	setup(ctx: PluginContext) {
		// Register the "frame" shape type
		ctx.shapes.register("frame", {
			render: renderFrame,
			getBounds: getBoundsFrame,
			hitTest: hitTestFrame,
			resize: resizeFrame,
			createDefault: createDefaultFrame,
			renderTarget: "html",
			minSize: { width: 50, height: 50 },
		});

		// Drawing tool state
		let drawState: { startX: number; startY: number; shapeId: string } | null = null;

		function onPointerDown(toolCtx: ToolContext, event: CanvasPointerEvent) {
			const id = generateId();
			drawState = { startX: event.worldPoint.x, startY: event.worldPoint.y, shapeId: id };
			const shape = createDefaultFrame({ id, x: event.worldPoint.x, y: event.worldPoint.y });
			shape.width = 0;
			shape.height = 0;
			shape.style = {
				...shape.style,
				stroke: toolCtx.store.getStyleSettings().stroke,
			};
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
			if (shape && shape.width > 10 && shape.height > 10) {
				toolCtx.store.deleteShape(drawState.shapeId);
				toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, shape));
			} else {
				toolCtx.store.deleteShape(drawState.shapeId);
			}
			drawState = null;
			toolCtx.store.setActiveToolId("select");
		}

		ctx.tools.register("frame-draw", {
			icon: FrameIcon,
			cursor: "crosshair",
			shortcut: "f",
			order: 11,
			onPointerDown,
			onPointerMove,
			onPointerUp,
			onDeactivate() {
				if (drawState) {
					ctx.store.deleteShape(drawState.shapeId);
					drawState = null;
				}
			},
		});

		// ── Auto-parenting ──

		// On move-end: reparent moved shapes (emitted by select tool after move command commits).
		// Use setTimeout to defer reparent until after React finishes the current render cycle,
		// since the emit happens inside a queueMicrotask from the select tool.
		const unsubMoveEnd = ctx.events.on<{ shapeIds: string[] }>("shapes:move-end", (data) => {
			if (!data?.shapeIds) return;
			setTimeout(() => {
				for (const shapeId of data.shapeIds) {
					autoReparent(shapeId);
				}
			}, 0);
		});

		// On shape:added (e.g. drawing inside a frame)
		const unsubAdded = ctx.store.onMutation((event) => {
			if (event.type !== "shape:added") return;
			const payload = event.payload as { id: string } | undefined;
			if (!payload?.id) return;
			const shape = ctx.store.getShape(payload.id);
			if (!shape || shape.type === "frame" || shape.type === "connector") return;
			autoReparent(payload.id);
		});

		function autoReparent(shapeId: string) {
			const shape = ctx.store.getShape(shapeId);
			if (!shape || shape.type === "frame" || shape.type === "connector") return;

			const shapeBounds = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };

			// Find the smallest frame that fully contains this shape
			let bestFrame: ShapeData | null = null;
			for (const [id, candidate] of ctx.store.getShapes()) {
				if (id === shapeId || candidate.type !== "frame") continue;
				const frameBounds = {
					x: candidate.x,
					y: candidate.y,
					width: candidate.width,
					height: candidate.height,
				};
				if (containsAABB(frameBounds, shapeBounds)) {
					if (
						!bestFrame ||
						candidate.width * candidate.height < bestFrame.width * bestFrame.height
					) {
						bestFrame = candidate;
					}
				}
			}

			const currentParentId = shape.parentId as string | undefined;
			const newParentId = bestFrame?.id;

			if (currentParentId !== newParentId) {
				ctx.commands.execute(createReparentCommand(ctx.store, [shapeId], newParentId ?? undefined));
			}
		}

		// ── Frame move: move all children along with the frame ──
		const unsubMove = ctx.store.onMutation((event) => {
			if (event.type !== "shape:updated") return;
			const payload = event.payload as { id: string } | undefined;
			if (!payload?.id) return;

			const shape = ctx.store.getShape(payload.id);
			if (!shape || shape.type !== "frame") return;

			// This is handled by the select tool which includes children in snapshots
			// when moving a frame. No additional logic needed here.
		});

		(this as UsketchPlugin).teardown = () => {
			unsubMoveEnd();
			unsubAdded();
			unsubMove();
		};
	},
};
