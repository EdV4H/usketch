import type {
	CanvasPointerEvent,
	PluginContext,
	Point,
	ShapeData,
	ToolContext,
	UsketchPlugin,
} from "@edv4h/usketch-shared";
import {
	isContainerAutoAttach,
	safeRotation,
	shouldDeleteContainerChildren,
} from "@edv4h/usketch-shared";
import {
	createDeleteKeepChildrenCommand,
	createDeleteWithChildrenCommand,
	isEffectivelyHidden,
	isEffectivelyLocked,
} from "@edv4h/usketch-store";
import {
	findHandleAtScreenPoint,
	findMultiHandleAtScreenPoint,
	findMultiRotationHandleAtScreenPoint,
	findRotationHandleAtScreenPoint,
	findShapeAtPoint,
	getCursorForHandle,
	getMultiSelectionBounds,
	getRotatedCursorForHandle,
	startDragSession,
	startMarqueeSession,
	startMultiRotateSession,
	startResizeSession,
	startRotateSession,
	trackHover,
} from "@edv4h/usketch-tool-helpers";
import { clearMovingSelectionListeners, setMovingSelection } from "./drag-state.js";
import { findDropTarget } from "./drop-target.js";
import { clearDropTargetListeners, setDropTargetId } from "./drop-target-state.js";
import {
	addDragCopies,
	commitDragCopies,
	type DragCopies,
	removeDragCopies,
} from "./duplicate-drag.js";
import {
	clearEditingGroupListeners,
	getEditingGroupId,
	setEditingGroupId,
} from "./group-edit-state.js";
import { createHandleClickTracker } from "./handle-double-click.js";
import type { MarqueeRect } from "./marquee-state.js";
import { clearMarqueeListeners, setMarquee, setMarqueeMode } from "./marquee-state.js";
import { createOverlayColorStore, type OverlayColors } from "./overlay-colors.js";
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
		const shape = ctx.store.getShape(id);
		// Locked or hidden shapes (or those under such an ancestor) resist deletion —
		// both are excluded from canvas interaction.
		if (shape && (isEffectivelyLocked(ctx.store, shape) || isEffectivelyHidden(ctx.store, shape)))
			continue;
		// Containers may opt out of deleting their contents (e.g. a frame set to
		// keep its items), in which case the children are left in place.
		const keepChildren = shape && !shouldDeleteContainerChildren(ctx.shapes.get(shape.type), shape);
		ctx.commands.execute(
			keepChildren
				? createDeleteKeepChildrenCommand(ctx.store, id)
				: createDeleteWithChildrenCommand(ctx.store, id),
		);
	}
	// No explicit clearSelection: `store.deleteShape` already drops deleted ids from
	// the selection, so skipped (locked/hidden) shapes stay selected while a
	// full-delete still ends with an empty selection.
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
			toolCtx: ToolContext;
			startPoint: Point;
			/** Selection when the drag started (what a plain move moves). */
			selectedIds: string[];
			/** Shapes the plain move moves (selection + descendants). */
			originalMovingIds: ReadonlySet<string>;
			/** Option(Alt) is held: the drag moves these copies and the originals stay. */
			copies: DragCopies | null;
			/** Last pointer event, replayed when Option toggles mid-drag. */
			lastEvent: CanvasPointerEvent | null;
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

export interface SelectToolPluginOptions {
	/** 選択オーバーレイ（選択枠/ハンドル）の色。CSS 変数（例 `var(--colors-primary)`）も可。 */
	overlay?: Partial<OverlayColors>;
}

export function createSelectToolPlugin(options: SelectToolPluginOptions = {}): UsketchPlugin {
	return {
		id: "usketch-plugin-tool-select",
		name: "選択",

		setup(ctx: PluginContext) {
			// 選択オーバーレイ色は setup(インスタンス)スコープで保持する（#640）。
			// モジュール共有だと複数 App 同時生成時に teardown が他インスタンスの色を壊す。
			const overlayColors = createOverlayColorStore(options.overlay);

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
			const trackHandleClick = createHandleClickTracker();

			// ── Option(Alt)+drag duplicate ──
			// Like Figma: while Option is held the drag moves copies and the originals
			// stay where they are. The copies live in the store during the drag (so a
			// collaborator sees the copy move, not the original) without history; the
			// drop replaces them with one undoable add. Toggled by the Alt key itself
			// (not only pointermove) so pressing or releasing Option while the mouse is
			// still switches move ⇔ duplicate.

			const isAttachTarget = (shape: ShapeData) =>
				isContainerAutoAttach(ctx.shapes.get(shape.type), shape);

			// Snap must not nudge the shapes put back to their start positions when the
			// drag switches between the originals and the copies.
			function withoutSnap(fn: () => void) {
				let enabled = false;
				ctx.events.emit("snap:get-settings", (settings: { enabled: boolean }) => {
					enabled = settings.enabled;
				});
				if (enabled) ctx.events.emit("snap:configure", { enabled: false });
				try {
					fn();
				} finally {
					if (enabled) ctx.events.emit("snap:configure", { enabled: true });
				}
			}

			function setDuplicating(on: boolean) {
				if (dragState?.kind !== "move" || (dragState.copies !== null) === on) return;
				const state = dragState;
				const { store } = state.toolCtx;
				withoutSnap(() => {
					// Put whatever the current session moved back where it started.
					state.session.cancel();
					if (on) {
						state.copies = addDragCopies(
							store,
							state.selectedIds,
							state.originalMovingIds,
							isAttachTarget,
						);
						store.setSelection(state.copies.rootIds);
					} else {
						if (state.copies) removeDragCopies(store, state.copies);
						state.copies = null;
						store.setSelection(state.selectedIds);
					}
				});
				state.session = startDragSession({
					ctx: state.toolCtx,
					startPoint: state.startPoint,
					shapeIds: store.getSelection(),
				});
				state.movingIds = state.session.movingShapeIds;
				if (state.lastEvent) state.session.update(state.lastEvent);
			}

			let keyTracking = false;
			function onDuplicateKey(e: KeyboardEvent) {
				if (e.key !== "Alt") return;
				// Alt alone would focus the menu bar on Windows / Linux.
				e.preventDefault();
				setDuplicating(e.type === "keydown");
			}
			function onDuplicateBlur() {
				setDuplicating(false);
			}
			function startDuplicateKeyTracking() {
				keyTracking = true;
				// Capture phase: a focused text editor stops keydown from bubbling.
				window.addEventListener("keydown", onDuplicateKey, true);
				window.addEventListener("keyup", onDuplicateKey, true);
				window.addEventListener("blur", onDuplicateBlur);
			}
			function stopDuplicateKeyTracking() {
				if (!keyTracking) return;
				keyTracking = false;
				window.removeEventListener("keydown", onDuplicateKey, true);
				window.removeEventListener("keyup", onDuplicateKey, true);
				window.removeEventListener("blur", onDuplicateBlur);
			}

			/** Drop the copies of an unfinished duplicate drag (the originals never moved). */
			function discardCopies() {
				if (dragState?.kind !== "move" || !dragState.copies) return;
				const { store } = dragState.toolCtx;
				removeDragCopies(store, dragState.copies);
				dragState.copies = null;
				store.setSelection(dragState.selectedIds);
			}

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
					const shape = toolCtx.store.getShape(rotationHit.shapeId);
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
								shapeId: rotationHit.shapeId,
								center: { x: cx, y: cy },
								startAngle,
								startRotation: safeRotation(shape.rotation),
							}),
						};
						return;
					}
				}

				// 0b. Multi-selection rotation (outside a corner of the group bbox)
				const preSelection = toolCtx.store.getSelection();
				if (preSelection.size > 1) {
					const groupBounds = getMultiSelectionBounds(toolCtx.store, toolCtx.shapes, preSelection);
					if (
						groupBounds &&
						findMultiRotationHandleAtScreenPoint(event.screenPoint, groupBounds, viewport)
					) {
						const cx = groupBounds.x + groupBounds.width / 2;
						const cy = groupBounds.y + groupBounds.height / 2;
						const startAngle =
							Math.atan2(event.worldPoint.y - cy, event.worldPoint.x - cx) * (180 / Math.PI);
						setOverrideCursor("grabbing");
						dragState = {
							kind: "rotate",
							session: startMultiRotateSession({
								ctx: toolCtx,
								ids: preSelection,
								center: { x: cx, y: cy },
								startAngle,
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
						if (
							trackHandleClick(handleHit.shapeId, handleHit.handle, Date.now()) &&
							toolCtx.shapes
								.get(shape.type)
								?.onHandleDoubleClick?.(toolCtx, shape, handleHit.handle)
						) {
							return;
						}
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
						toolCtx,
						startPoint: { x: event.worldPoint.x, y: event.worldPoint.y },
						selectedIds: [...currentSelection],
						originalMovingIds: session.movingShapeIds,
						copies: null,
						lastEvent: null,
					};
					startDuplicateKeyTracking();
					setDuplicating(event.altKey);
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
					toolCtx.store.setHoveredShapeId(
						result.handleHit || result.rotationHit ? null : result.hoveredShapeId,
					);
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
				dragState.lastEvent = event;
				setDuplicating(event.altKey);
				dragState.session.update(event);

				// Drop target: the auto-attach container under the cursor (excluding dragged shapes).
				updateDropTarget(findDropTarget(toolCtx, event.worldPoint, dragState.movingIds));
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
				stopDuplicateKeyTracking();
				const { copies } = dragState;
				if (copies) {
					// Option held at drop: the originals never moved; the copies become one
					// undoable add where they were dropped. A click without moving adds none.
					const moved = copies.shapes.some((s) => {
						const now = toolCtx.store.getShape(s.id);
						return !!now && (now.x !== s.x || now.y !== s.y);
					});
					const add = moved ? commitDragCopies(toolCtx.store, copies, isAttachTarget) : null;
					if (!add) discardCopies();
					dragState = null;
					if (add) {
						queueMicrotask(() => {
							toolCtx.commands.execute(add);
							toolCtx.store.setSelection(copies.rootIds);
							toolCtx.events.emit("shapes:move-end", { shapeIds: copies.rootIds });
						});
					}
					return;
				}
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

			function onDeactivate(toolCtx: ToolContext) {
				discardCopies();
				stopDuplicateKeyTracking();
				dragState = null;
				enableTextSelection();
				setMovingSelection(false);
				setMarquee(null);
				setOverrideCursor("");
				setEditingGroupId(null);
				toolCtx.store.setHoveredShapeId(null);
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
					<SelectionOverlay
						store={ctx.store}
						shapes={ctx.shapes}
						viewport={renderCtx.viewport}
						colors={overlayColors}
					/>
				),
			});

			// Delete selected shapes
			ctx.shortcuts.register("Delete", () => deleteSelectedShapes(ctx));
			ctx.shortcuts.register("Backspace", () => deleteSelectedShapes(ctx));

			// 実行時に色を変更（snap:configure と対になる select:configure）。
			// `{ overlay: { strokeColor, handleFillColor } }` も平坦な形も受け付ける。
			const offConfigure = ctx.events.on<
				{ overlay?: Partial<OverlayColors> } & Partial<OverlayColors>
			>("select:configure", (patch) => overlayColors.set(patch.overlay ?? patch));

			// ── Teardown ──
			return () => {
				offConfigure();
				discardCopies();
				stopDuplicateKeyTracking();
				// overlayColors はインスタンス所有なので reset 不要（GC で破棄）。#640
				setOverrideCursor("");
				setMovingSelection(false);
				setMarquee(null);
				setEditingGroupId(null);
				ctx.store.setHoveredShapeId(null);
				updateDropTarget(null);
				clearMarqueeListeners();
				clearMovingSelectionListeners();
				clearEditingGroupListeners();
				clearDropTargetListeners();
				styleEl.remove();
				unregisterSelectionForeground();
			};
		},
	};
}
