import type {
	CanvasPointerEvent,
	PluginContext,
	ToolContext,
	UsketchPlugin,
} from "@edv4h/usketch-shared";
import { safeRotation } from "@edv4h/usketch-shared";
import { createDeleteWithChildrenCommand } from "@edv4h/usketch-store";
import {
	findHandleAtScreenPoint,
	findMultiHandleAtScreenPoint,
	findRotationHandleAtScreenPoint,
	findShapeAtPoint,
	getCursorForHandle,
	getMultiSelectionBounds,
	getRotatedCursorForHandle,
	startDragSession,
	startMarqueeSession,
	startResizeSession,
	startRotateSession,
	trackHover,
} from "@edv4h/usketch-tool-helpers";
import { clearMovingSelectionListeners, setMovingSelection } from "./drag-state.js";
import { clearDropTargetListeners, setDropTargetId } from "./drop-target-state.js";
import {
	clearEditingGroupListeners,
	getEditingGroupId,
	setEditingGroupId,
} from "./group-edit-state.js";
import { clearHoveredShapeListeners, setHoveredShapeId } from "./hover-state.js";
import type { MarqueeRect } from "./marquee-state.js";
import { clearMarqueeListeners, setMarquee, setMarqueeMode } from "./marquee-state.js";
import { SelectionOverlay } from "./selection-overlay.js";

// Hit-test helpers used to live here; they were extracted to
// `@edv4h/usketch-tool-helpers` (Issue #576) so other tools can reuse
// the same shape-vs-container precedence rules.

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
		ctx.commands.execute(createDeleteWithChildrenCommand(ctx.store, id));
	}
	ctx.store.clearSelection();
}

// ── Drag state types ──

/**
 * Active pointer session. The tool delegates the per-mode mechanics to
 * `@edv4h/usketch-tool-helpers` so this enum only tracks `kind` and any
 * tool-specific data (the rotate session needs the rotated shape's id for
 * cursor reset; marquee needs the shift modifier captured at pointerdown
 * because the helper's commit returns a `Set<string>` without context).
 */
type DragState =
	| {
			kind: "move";
			session: ReturnType<typeof startDragSession>;
			movingIds: ReadonlySet<string>;
	  }
	| {
			kind: "resize";
			session: ReturnType<typeof startResizeSession>;
			rotation: number;
	  }
	| {
			kind: "multi-resize";
			session: ReturnType<typeof startResizeSession>;
	  }
	| {
			kind: "rotate";
			session: ReturnType<typeof startRotateSession>;
	  }
	| {
			kind: "marquee";
			session: ReturnType<typeof startMarqueeSession>;
			shiftKey: boolean;
	  }
	| null;

// ── Plugin ──

export const selectToolPlugin: UsketchPlugin = {
	id: "usketch-plugin-tool-select",
	name: "選択",

	setup(ctx: PluginContext) {
		// Wrap setDropTargetId to also emit on EventBus for DomShapeLayer
		function updateDropTarget(id: string | null) {
			setDropTargetId(id);
			ctx.events.emit("drop-target:changed", { id });
		}

		// ── Local drag state (scoped to this setup closure) ──
		let dragState: DragState = null;
		let overrideCursor = "";
		let lastClickTime = 0;
		let lastClickId: string | null = null;

		// Inject a <style> tag to override canvas cursor via !important
		const styleEl = document.createElement("style");
		styleEl.dataset.selectTool = "";
		document.head.appendChild(styleEl);

		function setOverrideCursor(cursor: string) {
			if (cursor === overrideCursor) return;
			overrideCursor = cursor;
			styleEl.textContent = cursor ? `* { cursor: ${cursor} !important; }` : "";
		}

		// Prevent text selection during drag operations
		const preventSelect = (e: Event) => e.preventDefault();
		function disableTextSelection() {
			document.addEventListener("selectstart", preventSelect);
		}
		function enableTextSelection() {
			document.removeEventListener("selectstart", preventSelect);
		}

		// ── Tool handlers ──

		function onPointerDown(toolCtx: ToolContext, event: CanvasPointerEvent) {
			disableTextSelection();
			const viewport = toolCtx.store.getViewport();

			// 0. Rotation handle (outside bbox, no conflict with resize)
			const rotationHit = findRotationHandleAtScreenPoint(
				event.screenPoint,
				toolCtx.shapes,
				toolCtx.store,
				viewport,
			);
			if (rotationHit) {
				const shape = toolCtx.store.getShape(rotationHit);
				if (shape) {
					const cx = shape.x + shape.width / 2;
					const cy = shape.y + shape.height / 2;
					const startAngle =
						Math.atan2(event.worldPoint.y - cy, event.worldPoint.x - cx) * (180 / Math.PI);
					setOverrideCursor("grabbing");
					dragState = {
						kind: "rotate",
						session: startRotateSession({
							ctx: toolCtx,
							shapeId: rotationHit,
							center: { x: cx, y: cy },
							startAngle,
							startRotation: safeRotation(shape.rotation),
						}),
					};
					return;
				}
			}

			// 1. Single-shape resize handle
			const handleHit = findHandleAtScreenPoint(
				event.screenPoint,
				toolCtx.shapes,
				toolCtx.store,
				viewport,
			);
			if (handleHit) {
				const shape = toolCtx.store.getShape(handleHit.shapeId);
				if (shape) {
					const shapeRotation = safeRotation(shape.rotation);
					setOverrideCursor(
						shapeRotation
							? getRotatedCursorForHandle(handleHit.handle, shapeRotation)
							: getCursorForHandle(handleHit.handle),
					);
					dragState = {
						kind: "resize",
						rotation: shapeRotation,
						session: startResizeSession({
							kind: "single",
							ctx: toolCtx,
							shapeId: handleHit.shapeId,
							handle: handleHit.handle,
							startPoint: { x: event.worldPoint.x, y: event.worldPoint.y },
						}),
					};
					return;
				}
			}

			// 1b. Multi-selection resize handle
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
						dragState = {
							kind: "multi-resize",
							session: startResizeSession({
								kind: "multi",
								ctx: toolCtx,
								selection,
								handle: multiHandle,
								startPoint: { x: event.worldPoint.x, y: event.worldPoint.y },
								groupBounds,
							}),
						};
						return;
					}
				}
			}

			// 2. Double-click detection for group enter/exit
			const now = Date.now();
			const rawHitId = findShapeAtPoint(toolCtx, event.worldPoint, {
				editingGroupId: getEditingGroupId(),
			});

			if (rawHitId && now - lastClickTime < 400 && lastClickId === rawHitId) {
				const shape = toolCtx.store.getShape(rawHitId);
				if (shape?.type === "group" || shape?.type === "frame") {
					setEditingGroupId(rawHitId);
					toolCtx.store.clearSelection();
					lastClickTime = 0;
					lastClickId = null;
					return;
				}
			}
			lastClickTime = now;
			lastClickId = rawHitId;

			// If clicking outside the editing group, exit group edit mode
			const editingGroupId = getEditingGroupId();
			if (editingGroupId && rawHitId !== editingGroupId) {
				const hitShape = rawHitId ? toolCtx.store.getShape(rawHitId) : null;
				if (!hitShape || hitShape.parentId !== editingGroupId) {
					setEditingGroupId(null);
				}
			}

			const hitId = rawHitId;

			if (hitId) {
				if (event.shiftKey) {
					if (selection.has(hitId)) {
						toolCtx.store.removeFromSelection(hitId);
					} else {
						toolCtx.store.addToSelection(hitId);
					}
				} else if (!selection.has(hitId)) {
					toolCtx.store.setSelection([hitId]);
				}

				const currentSelection = toolCtx.store.getSelection();
				setMovingSelection(true);
				const session = startDragSession({
					ctx: toolCtx,
					startPoint: { x: event.worldPoint.x, y: event.worldPoint.y },
					shapeIds: currentSelection,
				});
				// Drop-target hit test must exclude every shape the session
				// touches — including descendants of dragged containers — or
				// the container's own children would falsely register as drop
				// targets.
				dragState = {
					kind: "move",
					session,
					movingIds: session.movingShapeIds,
				};
			} else {
				// Click on empty — start marquee selection
				if (!event.shiftKey) {
					toolCtx.store.clearSelection();
				}
				dragState = {
					kind: "marquee",
					shiftKey: event.shiftKey,
					session: startMarqueeSession({
						ctx: toolCtx,
						startWorldPoint: { x: event.worldPoint.x, y: event.worldPoint.y },
						editingGroupId: getEditingGroupId(),
					}),
				};
			}
		}

		function onPointerMove(toolCtx: ToolContext, event: CanvasPointerEvent) {
			if (!dragState) {
				// Hover precedence (rotation handle → resize handle → multi-handle
				// → shape body) is handled by the helper. The cursor is mirrored
				// onto our `<style>` injection so it overrides any per-shape cursor.
				const result = trackHover(toolCtx, event, {
					editingGroupId: getEditingGroupId(),
				});
				setOverrideCursor(result.cursor);
				setHoveredShapeId(result.handleHit || result.rotationHit ? null : result.hoveredShapeId);
				return;
			}

			if (dragState.kind === "rotate") {
				dragState.session.update(event);
				return;
			}

			if (dragState.kind === "marquee") {
				const u = dragState.session.update(event);
				setMarqueeMode(u.mode);
				setMarquee(u.rect as MarqueeRect, [...u.hitIds]);
				return;
			}

			if (dragState.kind === "resize" || dragState.kind === "multi-resize") {
				const u = dragState.session.update(event);
				if (u.flippedHandle) {
					setOverrideCursor(
						dragState.kind === "resize" && dragState.rotation
							? getRotatedCursorForHandle(u.flippedHandle, dragState.rotation)
							: getCursorForHandle(u.flippedHandle),
					);
				}
				return;
			}

			// kind === "move"
			dragState.session.update(event);

			// Drop target: find frame/group under the cursor (excluding dragged shapes).
			const allShapes = toolCtx.store.getShapes();
			let dropTarget: string | null = null;
			const entries = [...allShapes.entries()].reverse();
			for (const [id, shape] of entries) {
				if (dragState.movingIds.has(id)) continue;
				if (shape.type !== "frame" && shape.type !== "group") continue;
				const def = toolCtx.shapes.get(shape.type);
				const bounds = def
					? def.getBounds(shape)
					: { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
				if (
					event.worldPoint.x >= bounds.x &&
					event.worldPoint.x <= bounds.x + bounds.width &&
					event.worldPoint.y >= bounds.y &&
					event.worldPoint.y <= bounds.y + bounds.height
				) {
					dropTarget = id;
					break;
				}
			}
			updateDropTarget(dropTarget);
		}

		function onPointerUp(toolCtx: ToolContext, _event: CanvasPointerEvent) {
			enableTextSelection();
			updateDropTarget(null);
			if (!dragState) return;

			if (dragState.kind === "rotate") {
				setOverrideCursor("");
				const result = dragState.session.commit();
				if (result) {
					queueMicrotask(() => toolCtx.commands.execute(result.command));
				}
				dragState = null;
				return;
			}

			if (dragState.kind === "marquee") {
				setMarquee(null);
				const result = dragState.session.commit();
				if (result) {
					if (dragState.shiftKey) {
						for (const id of result.selection) toolCtx.store.addToSelection(id);
					} else {
						toolCtx.store.setSelection([...result.selection]);
					}
				}
				dragState = null;
				return;
			}

			if (dragState.kind === "resize" || dragState.kind === "multi-resize") {
				setOverrideCursor("");
				const result = dragState.session.commit();
				if (result) {
					queueMicrotask(() => toolCtx.commands.execute(result.command));
				}
				dragState = null;
				return;
			}

			// kind === "move"
			setMovingSelection(false);
			const userSelectedIds = [...toolCtx.store.getSelection()];
			const result = dragState.session.commit();
			if (result) {
				queueMicrotask(() => {
					toolCtx.commands.execute(result.command);
					// Notify after the move command is committed so reparent won't be undone.
					toolCtx.events.emit("shapes:move-end", { shapeIds: userSelectedIds });
				});
			}
			dragState = null;
		}

		function onDeactivate(_toolCtx: ToolContext) {
			dragState = null;
			enableTextSelection();
			setMovingSelection(false);
			setMarquee(null);
			setOverrideCursor("");
			setEditingGroupId(null);
			setHoveredShapeId(null);
			updateDropTarget(null);
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

		// ── Selection foreground (default) ──
		// Registered at priority 0 so any app option or third-party plugin
		// (recommended: 50) replaces it. See guides/selection-foreground.
		const unregisterSelectionForeground = ctx.ui.registerSelectionForeground({
			id: "tool-select-default",
			priority: 0,
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
			setMovingSelection(false);
			setMarquee(null);
			setEditingGroupId(null);
			setHoveredShapeId(null);
			updateDropTarget(null);
			clearMarqueeListeners();
			clearMovingSelectionListeners();
			clearEditingGroupListeners();
			clearHoveredShapeListeners();
			clearDropTargetListeners();
			styleEl.remove();
			unregisterSelectionForeground();
		};
	},
};
