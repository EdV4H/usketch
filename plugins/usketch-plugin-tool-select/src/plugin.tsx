import type {
	BoundingBox,
	CanvasPointerEvent,
	PluginContext,
	Point,
	ResizeHandle,
	ShapeData,
	ToolContext,
	UsketchPlugin,
} from "@edv4h/usketch-shared";
import {
	createBatchUpdateShapesCommand,
	createDeleteShapeCommand,
	createMoveShapesCommand,
	createUpdateShapeCommand,
} from "@edv4h/usketch-store";
import type { MarqueeMode, MarqueeRect } from "./marquee-state.js";
import { clearMarqueeListeners, setMarquee, setMarqueeMode } from "./marquee-state.js";
import {
	applyFlip,
	computeMultiResizeUpdates,
	computeRawBounds,
	findHandleAtScreenPoint,
	findMultiHandleAtScreenPoint,
	fixAnchorDrift,
	getAnchorEdges,
	getCursorForHandle,
	getMultiSelectionBounds,
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

function findShapesInRect(ctx: ToolContext, rect: BoundingBox, mode: MarqueeMode): string[] {
	const test = mode === "contain" ? boxContains : boxesIntersect;
	const shapes = ctx.store.getShapes();
	const ids: string[] = [];
	for (const [id, data] of shapes) {
		const def = ctx.shapes.get(data.type);
		const bounds = def
			? def.getBounds(data)
			: { x: data.x, y: data.y, width: data.width, height: data.height };
		if (test(rect, bounds)) {
			ids.push(id);
		}
	}
	return ids;
}

function boxesIntersect(a: BoundingBox, b: BoundingBox): boolean {
	return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Returns true if `a` fully contains `b` */
function boxContains(a: BoundingBox, b: BoundingBox): boolean {
	return (
		a.x <= b.x && a.y <= b.y && a.x + a.width >= b.x + b.width && a.y + a.height >= b.y + b.height
	);
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
	| {
			mode: "multi-resize";
			handle: ResizeHandle;
			startPoint: Point;
			startGroupBounds: BoundingBox;
			startShapeData: Map<string, { x: number; y: number; width: number; height: number }>;
	  }
	| {
			mode: "marquee";
			startWorldPoint: Point;
			startScreenPoint: Point;
			shiftKey: boolean;
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

			// 1b. Check multi-selection resize handle hit
			const selection = toolCtx.store.getSelection();
			if (selection.size > 1) {
				const groupBounds = getMultiSelectionBounds(toolCtx.store, toolCtx.shapes, selection);
				if (groupBounds) {
					const multiHandle = findMultiHandleAtScreenPoint(
						event.screenPoint,
						groupBounds,
						viewport,
					);
					if (multiHandle) {
						setOverrideCursor(getCursorForHandle(multiHandle));
						const startShapeData = new Map<
							string,
							{ x: number; y: number; width: number; height: number }
						>();
						for (const id of selection) {
							const shape = toolCtx.store.getShape(id);
							if (shape) {
								startShapeData.set(id, {
									x: shape.x,
									y: shape.y,
									width: shape.width,
									height: shape.height,
								});
							}
						}
						dragState = {
							mode: "multi-resize",
							handle: multiHandle,
							startPoint: { x: event.worldPoint.x, y: event.worldPoint.y },
							startGroupBounds: groupBounds,
							startShapeData,
						};
						return;
					}
				}
			}

			// 2. Existing move/selection logic
			const hitId = findShapeAtPoint(toolCtx, event.worldPoint);

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
				// Click on empty — start marquee selection
				if (!event.shiftKey) {
					toolCtx.store.clearSelection();
				}
				dragState = {
					mode: "marquee",
					startWorldPoint: { x: event.worldPoint.x, y: event.worldPoint.y },
					startScreenPoint: { x: event.screenPoint.x, y: event.screenPoint.y },
					shiftKey: event.shiftKey,
				};
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
				if (handleHit) {
					setOverrideCursor(getCursorForHandle(handleHit.handle));
					return;
				}
				// Check multi-selection handles
				const hoverSelection = toolCtx.store.getSelection();
				if (hoverSelection.size > 1) {
					const groupBounds = getMultiSelectionBounds(
						toolCtx.store,
						toolCtx.shapes,
						hoverSelection,
					);
					if (groupBounds) {
						const multiHandle = findMultiHandleAtScreenPoint(
							event.screenPoint,
							groupBounds,
							viewport,
						);
						if (multiHandle) {
							setOverrideCursor(getCursorForHandle(multiHandle));
							return;
						}
					}
				}
				setOverrideCursor("");
				return;
			}

			if (dragState.mode === "marquee") {
				const x = Math.min(dragState.startScreenPoint.x, event.screenPoint.x);
				const y = Math.min(dragState.startScreenPoint.y, event.screenPoint.y);
				const width = Math.abs(event.screenPoint.x - dragState.startScreenPoint.x);
				const height = Math.abs(event.screenPoint.y - dragState.startScreenPoint.y);
				const screenRect: MarqueeRect = { x, y, width, height };

				// Alt key toggles between intersect and contain mode
				const mode: MarqueeMode = event.altKey ? "contain" : "intersect";
				setMarqueeMode(mode);

				// Compute world-space marquee for hit testing
				const wx = Math.min(dragState.startWorldPoint.x, event.worldPoint.x);
				const wy = Math.min(dragState.startWorldPoint.y, event.worldPoint.y);
				const ww = Math.abs(event.worldPoint.x - dragState.startWorldPoint.x);
				const wh = Math.abs(event.worldPoint.y - dragState.startWorldPoint.y);
				const hitIds = findShapesInRect(toolCtx, { x: wx, y: wy, width: ww, height: wh }, mode);

				setMarquee(screenRect, hitIds);
				return;
			}

			if (dragState.mode === "resize") {
				const def = toolCtx.shapes.get(dragState.startData.type);
				if (!def) return;

				const delta: Point = {
					x: event.worldPoint.x - dragState.startPoint.x,
					y: event.worldPoint.y - dragState.startPoint.y,
				};

				// Flip detection: use unclamped (raw) bounds so minSize doesn't
				// prevent the pointer from crossing the anchor edge.
				const rawBounds = computeRawBounds(dragState.startData, dragState.handle, delta);
				const flip = applyFlip(dragState.handle, rawBounds, event.worldPoint);
				if (flip.flipped) {
					const currentShape = toolCtx.store.getShape(dragState.shapeId);
					if (currentShape) {
						const anchor = getAnchorEdges(dragState.handle, rawBounds);
						// Reset to zero-size shape at anchor position.
						// This ensures the flipped handle's anchor is at the
						// pointer's crossing point, preventing immediate re-flip.
						const flippedData = { ...currentShape };
						if (flip.flippedX && anchor.x !== undefined) {
							flippedData.x = anchor.x;
							flippedData.width = 0;
						}
						if (flip.flippedY && anchor.y !== undefined) {
							flippedData.y = anchor.y;
							flippedData.height = 0;
						}
						dragState = {
							...dragState,
							handle: flip.handle,
							startData: flippedData,
							startPoint: { x: event.worldPoint.x, y: event.worldPoint.y },
						};
						// Update store — def.resize will expand from zero on next frame
						toolCtx.store.updateShape(dragState.shapeId, {
							x: flippedData.x,
							y: flippedData.y,
						});
						setOverrideCursor(getCursorForHandle(flip.handle));
					}
					// Skip resize this frame — next frame will use the new
					// startData/startPoint with the flipped handle.
					return;
				}

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

			if (dragState.mode === "multi-resize") {
				const delta: Point = {
					x: event.worldPoint.x - dragState.startPoint.x,
					y: event.worldPoint.y - dragState.startPoint.y,
				};
				const multiUpdates = computeMultiResizeUpdates(
					dragState.handle,
					dragState.startGroupBounds,
					delta,
					dragState.startShapeData,
				);
				for (const [id, upd] of multiUpdates) {
					toolCtx.store.updateShape(id, upd);
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

			if (dragState.mode === "marquee") {
				setMarquee(null);
				// Calculate marquee rect in world coordinates
				const wx1 = _event.worldPoint.x;
				const wy1 = _event.worldPoint.y;
				const sx = dragState.startWorldPoint.x;
				const sy = dragState.startWorldPoint.y;
				const mx = Math.min(sx, wx1);
				const my = Math.min(sy, wy1);
				const mw = Math.abs(wx1 - sx);
				const mh = Math.abs(wy1 - sy);

				// Skip tiny marquees (accidental clicks)
				if (mw < 2 && mh < 2) {
					dragState = null;
					return;
				}

				const mode: MarqueeMode = _event.altKey ? "contain" : "intersect";
				const marqueeBox: BoundingBox = { x: mx, y: my, width: mw, height: mh };
				const hitIds = findShapesInRect(toolCtx, marqueeBox, mode);

				if (dragState.shiftKey) {
					for (const id of hitIds) {
						toolCtx.store.addToSelection(id);
					}
				} else {
					toolCtx.store.setSelection(hitIds);
				}

				dragState = null;
				return;
			}

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

			if (dragState.mode === "multi-resize") {
				setOverrideCursor("");
				const batchUpdates: Array<{
					id: string;
					from: Partial<ShapeData>;
					to: Partial<ShapeData>;
				}> = [];
				for (const [id, startData] of dragState.startShapeData) {
					const currentShape = toolCtx.store.getShape(id);
					if (!currentShape) continue;
					const from: Partial<ShapeData> = {};
					const to: Partial<ShapeData> = {};
					for (const key of ["x", "y", "width", "height"] as const) {
						if (currentShape[key] !== startData[key]) {
							from[key] = startData[key];
							to[key] = currentShape[key];
						}
					}
					if (Object.keys(to).length > 0) {
						batchUpdates.push({ id, from, to });
					}
				}
				if (batchUpdates.length > 0) {
					// Reset all shapes to start state, then execute batch command
					for (const { id, from } of batchUpdates) {
						toolCtx.store.updateShape(id, from);
					}
					toolCtx.commands.execute(createBatchUpdateShapesCommand(toolCtx.store, batchUpdates));
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
			setMarquee(null);
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
			setMarquee(null);
			clearMarqueeListeners();
			styleEl.remove();
			ctx.layers.unregister("selection-overlay");
		};
	},
};
