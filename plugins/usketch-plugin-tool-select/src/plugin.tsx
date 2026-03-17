import type {
	CanvasPointerEvent,
	PluginContext,
	Point,
	ResizeHandle,
	ShapeData,
	ToolContext,
	UsketchPlugin,
} from "@edv4h/usketch-shared";
import {
	createDeleteShapeCommand,
	createMoveShapesCommand,
	createUpdateShapeCommand,
} from "@edv4h/usketch-store";
import {
	applyFlip,
	findHandleAtScreenPoint,
	fixAnchorDrift,
	getCursorForHandle,
} from "./resize-utils.js";
import { SelectionOverlay } from "./selection-overlay.js";

// ── Hit test helpers ──

function findShapeAtPoint(ctx: ToolContext, point: Point): string | null {
	const shapes = ctx.store.getShapes();
	// Iterate in reverse insertion order (top-most shape first)
	const entries = [...shapes.entries()].reverse();
	for (const [id, data] of entries) {
		const def = ctx.shapes.get(data.type);
		if (def?.hitTest(data, point)) {
			return id;
		}
	}
	return null;
}

// ── Icon ──

function SelectIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20">
			<path
				d="M6 2L6 16L10 12L14 16L16 14L12 10L16 6Z"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

// ── Shared helper ──

function deleteSelectedShapes(ctx: PluginContext) {
	const selection = ctx.store.getSelection();
	if (selection.size === 0) return;
	if (ctx.store.getActiveToolId() !== "select") return;
	for (const id of selection) {
		ctx.commands.execute(createDeleteShapeCommand(ctx.store, id));
	}
	ctx.store.clearSelection();
}

// ── Drag state types ──

type DragState =
	| { mode: "move"; startPoint: Point; startPositions: Map<string, Point> }
	| {
			mode: "resize";
			shapeId: string;
			handle: ResizeHandle;
			startPoint: Point;
			startData: ShapeData;
	  }
	| null;

// ── Plugin ──

export const selectToolPlugin: UsketchPlugin = {
	id: "usketch-plugin-tool-select",
	name: "選択",

	setup(ctx: PluginContext) {
		// ── Local drag state (scoped to this setup closure) ──
		let dragState: DragState = null;
		let overrideCursor = "";

		// Inject a <style> tag to override canvas cursor via !important
		const styleEl = document.createElement("style");
		styleEl.dataset.selectTool = "";
		document.head.appendChild(styleEl);

		function setOverrideCursor(cursor: string) {
			if (cursor === overrideCursor) return;
			overrideCursor = cursor;
			styleEl.textContent = cursor ? `* { cursor: ${cursor} !important; }` : "";
		}

		// ── Tool handlers ──

		function onPointerDown(toolCtx: ToolContext, event: CanvasPointerEvent) {
			const viewport = toolCtx.store.getViewport();

			// 1. Check resize handle hit first (single selection only)
			const handleHit = findHandleAtScreenPoint(
				event.screenPoint,
				toolCtx.shapes,
				toolCtx.store,
				viewport,
			);
			if (handleHit) {
				const shape = toolCtx.store.getShape(handleHit.shapeId);
				if (shape) {
					setOverrideCursor(getCursorForHandle(handleHit.handle));
					dragState = {
						mode: "resize",
						shapeId: handleHit.shapeId,
						handle: handleHit.handle,
						startPoint: { x: event.worldPoint.x, y: event.worldPoint.y },
						startData: { ...shape },
					};
					return;
				}
			}

			// 2. Existing move/selection logic
			const hitId = findShapeAtPoint(toolCtx, event.worldPoint);
			const selection = toolCtx.store.getSelection();

			if (hitId) {
				if (event.shiftKey) {
					// Toggle shape in selection
					if (selection.has(hitId)) {
						toolCtx.store.removeFromSelection(hitId);
					} else {
						toolCtx.store.addToSelection(hitId);
					}
				} else {
					// If clicking on an already-selected shape, keep selection (for multi-drag)
					if (!selection.has(hitId)) {
						toolCtx.store.setSelection([hitId]);
					}
				}

				// Start drag-move for all selected shapes
				const currentSelection = toolCtx.store.getSelection();
				const startPositions = new Map<string, Point>();
				for (const id of currentSelection) {
					const shape = toolCtx.store.getShape(id);
					if (shape) {
						startPositions.set(id, { x: shape.x, y: shape.y });
					}
				}
				dragState = {
					mode: "move",
					startPoint: { x: event.worldPoint.x, y: event.worldPoint.y },
					startPositions,
				};
			} else {
				// Click on empty — clear selection
				if (!event.shiftKey) {
					toolCtx.store.clearSelection();
				}
				dragState = null;
			}
		}

		function onPointerMove(toolCtx: ToolContext, event: CanvasPointerEvent) {
			if (!dragState) {
				// Hover: check for handle and update cursor
				const viewport = toolCtx.store.getViewport();
				const handleHit = findHandleAtScreenPoint(
					event.screenPoint,
					toolCtx.shapes,
					toolCtx.store,
					viewport,
				);
				setOverrideCursor(handleHit ? getCursorForHandle(handleHit.handle) : "");
				return;
			}

			if (dragState.mode === "resize") {
				const rawDelta: Point = {
					x: event.worldPoint.x - dragState.startPoint.x,
					y: event.worldPoint.y - dragState.startPoint.y,
				};
				const def = toolCtx.shapes.get(dragState.startData.type);
				if (!def) return;

				// Flip detection: if delta would make width/height negative, flip handle
				const flip = applyFlip(dragState.handle, dragState.startData, rawDelta);
				if (flip.flipped) {
					// Update drag state with flipped handle and new anchor
					dragState = {
						...dragState,
						handle: flip.handle,
						startData: { ...dragState.startData, ...flip.startData },
						startPoint: {
							x: event.worldPoint.x - flip.delta.x,
							y: event.worldPoint.y - flip.delta.y,
						},
					};
					setOverrideCursor(getCursorForHandle(flip.handle));
				}

				const delta: Point = {
					x: event.worldPoint.x - dragState.startPoint.x,
					y: event.worldPoint.y - dragState.startPoint.y,
				};
				const resized = def.resize(dragState.startData, dragState.handle, delta);
				// Fix anchor drift from minSize clamping
				const fixed = fixAnchorDrift(dragState.handle, dragState.startData, resized);
				resized.x = fixed.x;
				resized.y = fixed.y;
				const updates: Partial<ShapeData> = {};
				for (const key of Object.keys(resized)) {
					if (key === "id" || key === "type" || key === "style") continue;
					const resizedValue = resized[key];
					const startValue = dragState.startData[key];
					if (resizedValue !== startValue) {
						updates[key] = resizedValue;
					}
				}
				if (Object.keys(updates).length > 0) {
					toolCtx.store.updateShape(dragState.shapeId, updates);
				}
				return;
			}

			// mode === "move"
			const dx = event.worldPoint.x - dragState.startPoint.x;
			const dy = event.worldPoint.y - dragState.startPoint.y;

			for (const [id, startPos] of dragState.startPositions) {
				toolCtx.store.updateShape(id, {
					x: startPos.x + dx,
					y: startPos.y + dy,
				});
			}
		}

		function onPointerUp(toolCtx: ToolContext, _event: CanvasPointerEvent) {
			if (!dragState) return;

			if (dragState.mode === "resize") {
				setOverrideCursor("");
				const currentShape = toolCtx.store.getShape(dragState.shapeId);
				if (currentShape) {
					// Build from/to diffs for undo
					const from: Partial<ShapeData> = {};
					const to: Partial<ShapeData> = {};
					for (const key of Object.keys(currentShape)) {
						if (key === "id" || key === "type" || key === "style") continue;
						const currentValue = currentShape[key];
						const startValue = dragState.startData[key];
						if (currentValue !== startValue) {
							from[key] = startValue;
							to[key] = currentValue;
						}
					}

					if (Object.keys(to).length > 0) {
						// Reset to start, then execute command for undo support
						toolCtx.store.updateShape(dragState.shapeId, from);
						toolCtx.commands.execute(
							createUpdateShapeCommand(toolCtx.store, dragState.shapeId, from, to),
						);
					}
				}
				dragState = null;
				return;
			}

			// mode === "move"
			// Calculate actual displacement from current (snap-adjusted) positions
			const shapeIds = [...dragState.startPositions.keys()];
			const firstId = shapeIds[0];
			const firstStart = dragState.startPositions.get(firstId);
			const firstCurrent = firstId ? toolCtx.store.getShape(firstId) : undefined;

			const dx = firstCurrent && firstStart ? firstCurrent.x - firstStart.x : 0;
			const dy = firstCurrent && firstStart ? firstCurrent.y - firstStart.y : 0;

			// Only create undoable command if shapes actually moved
			if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
				// Reset positions to start, then execute command for undo support
				for (const [id, startPos] of dragState.startPositions) {
					toolCtx.store.updateShape(id, { x: startPos.x, y: startPos.y });
				}
				toolCtx.commands.execute(createMoveShapesCommand(toolCtx.store, shapeIds, dx, dy));
			}

			dragState = null;
		}

		function onDeactivate(_toolCtx: ToolContext) {
			dragState = null;
			setOverrideCursor("");
		}

		ctx.tools.register("select", {
			icon: SelectIcon,
			cursor: "default",
			shortcut: "v",
			order: 0,
			onPointerDown,
			onPointerMove,
			onPointerUp,
			onDeactivate,
		});

		// ── Selection overlay layer ──

		ctx.layers.register({
			id: "selection-overlay",
			order: 80,
			fixed: true,
			render: (renderCtx) => (
				<SelectionOverlay store={ctx.store} shapes={ctx.shapes} viewport={renderCtx.viewport} />
			),
		});

		// Delete selected shapes
		ctx.shortcuts.register("Delete", () => deleteSelectedShapes(ctx));
		ctx.shortcuts.register("Backspace", () => deleteSelectedShapes(ctx));

		// ── Teardown ──
		(this as UsketchPlugin).teardown = () => {
			setOverrideCursor("");
			styleEl.remove();
			ctx.layers.unregister("selection-overlay");
		};
	},
};
