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
	deltaToLocal,
	normalizeAngle,
	safeRotation,
	snapAngle,
	unrotatePoint,
} from "@edv4h/usketch-shared";
import {
	createBatchUpdateShapesCommand,
	createDeleteWithChildrenCommand,
	createMoveShapesCommand,
	createUpdateShapeCommand,
	getChildShapes,
	getTopLevelAncestor,
} from "@edv4h/usketch-store";
import { clearMovingSelectionListeners, setMovingSelection } from "./drag-state.js";
import { clearDropTargetListeners, setDropTargetId } from "./drop-target-state.js";
import {
	clearEditingGroupListeners,
	getEditingGroupId,
	setEditingGroupId,
} from "./group-edit-state.js";
import { clearHoveredShapeListeners, setHoveredShapeId } from "./hover-state.js";
import type { MarqueeMode, MarqueeRect } from "./marquee-state.js";
import { clearMarqueeListeners, setMarquee, setMarqueeMode } from "./marquee-state.js";
import {
	applyFlip,
	computeMultiResizeUpdates,
	computeRawBounds,
	computeRelativeProps,
	findHandleAtScreenPoint,
	findMultiHandleAtScreenPoint,
	findRotationHandleAtScreenPoint,
	fixAnchorDrift,
	getAnchorEdges,
	getCursorForHandle,
	getMultiSelectionBounds,
	getRotatedCursorForHandle,
	type MultiResizeShapeEntry,
} from "./resize-utils.js";
import { SelectionOverlay } from "./selection-overlay.js";

// ── Hit test helpers ──

function findShapeAtPoint(ctx: ToolContext, point: Point): string | null {
	const shapes = ctx.store.getShapes();
	const editingGroupId = getEditingGroupId();
	// Iterate in reverse insertion order (top-most shape first)
	// but prioritize non-container shapes over containers (island/frame)
	const CONTAINER_TYPES = new Set(["island", "frame"]);
	const entries = [...shapes.entries()].reverse();

	// First pass: find non-container shapes
	let containerHit: string | null = null;
	for (const [id, data] of entries) {
		const def = ctx.shapes.get(data.type);
		if (!def?.hitTest(data, point)) continue;

		// If inside a group editing session, only hit children of that group
		if (editingGroupId) {
			if (data.parentId === editingGroupId) return id;
			continue;
		}

		// If this shape has a parent, check the parent type:
		// - Frame/Island children are directly selectable (containers)
		// - Group children resolve to the top-level group ancestor
		if (typeof data.parentId === "string") {
			const parent = ctx.store.getShape(data.parentId);
			if (parent?.type === "frame" || parent?.type === "island") {
				return id;
			}
			const ancestor = getTopLevelAncestor(ctx.store, id);
			if (ancestor) return ancestor.id;
			continue;
		}

		// Defer containers — prefer their children first
		if (CONTAINER_TYPES.has(data.type)) {
			if (!containerHit) containerHit = id;
			continue;
		}

		return id;
	}
	// No non-container shape found, return the container itself
	return containerHit;
}

function findShapesInRect(ctx: ToolContext, rect: BoundingBox, mode: MarqueeMode): string[] {
	const test = mode === "contain" ? boxContains : boxesIntersect;
	const shapes = ctx.store.getShapes();
	const editingGroupId = getEditingGroupId();
	const ids = new Set<string>();
	for (const [id, data] of shapes) {
		const def = ctx.shapes.get(data.type);
		const bounds = def
			? def.getBounds(data)
			: { x: data.x, y: data.y, width: data.width, height: data.height };
		if (!test(rect, bounds)) continue;

		// If in group edit mode, only select children of that group
		if (editingGroupId) {
			if (data.parentId === editingGroupId) ids.add(id);
			continue;
		}

		// Frame children are directly selectable; group children resolve to ancestor
		if (typeof data.parentId === "string") {
			const parent = ctx.store.getShape(data.parentId);
			if (parent?.type === "frame") {
				ids.add(id);
			} else {
				const ancestor = getTopLevelAncestor(ctx.store, id);
				if (ancestor) ids.add(ancestor.id);
			}
			continue;
		}

		ids.add(id);
	}
	return [...ids];
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
		ctx.commands.execute(createDeleteWithChildrenCommand(ctx.store, id));
	}
	ctx.store.clearSelection();
}

// ── Drag state types ──

type DragState =
	| { mode: "move"; startPoint: Point; startShapeSnapshots: Map<string, ShapeData> }
	| {
			mode: "resize";
			shapeId: string;
			handle: ResizeHandle;
			startPoint: Point;
			startData: ShapeData;
	  }
	| {
			mode: "rotate";
			shapeId: string;
			startAngle: number;
			startRotation: number;
			center: Point;
			/** Snapshots of child shapes for container rotation */
			childSnapshots: Map<string, ShapeData>;
	  }
	| {
			mode: "multi-resize";
			handle: ResizeHandle;
			startPoint: Point;
			startGroupBounds: BoundingBox;
			startShapeData: Map<string, MultiResizeShapeEntry>;
			originalShapeData: Map<string, MultiResizeShapeEntry>;
			originalFullShapes: Map<string, ShapeData>;
			/** Base data for applyBounds — updated on flip to avoid stale geometry */
			applyBoundsBase: Map<string, ShapeData>;
	  }
	| {
			mode: "marquee";
			startWorldPoint: Point;
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

			// 0. Check rotation handle hit first (outside bounding box, no conflict with resize)
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
					// Collect child snapshots for container rotation
					const childSnapshots = new Map<string, ShapeData>();
					if (shape.type === "frame" || shape.type === "group" || shape.type === "island") {
						const children = getChildShapes(toolCtx.store, rotationHit);
						for (const child of children) {
							childSnapshots.set(child.id, { ...child });
						}
					}
					setOverrideCursor("grabbing");
					dragState = {
						mode: "rotate",
						shapeId: rotationHit,
						startAngle,
						startRotation: safeRotation(shape.rotation),
						center: { x: cx, y: cy },
						childSnapshots,
					};
					return;
				}
			}

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
					const shapeRotation = safeRotation(shape.rotation);
					setOverrideCursor(
						shapeRotation
							? getRotatedCursorForHandle(handleHit.handle, shapeRotation)
							: getCursorForHandle(handleHit.handle),
					);
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
						const startShapeData = new Map<string, MultiResizeShapeEntry>();
						const originalFullShapes = new Map<string, ShapeData>();
						for (const id of selection) {
							const shape = toolCtx.store.getShape(id);
							if (shape) {
								originalFullShapes.set(id, { ...shape });
								const def = toolCtx.shapes.get(shape.type);
								const minSize = def?.minSize ?? { width: 1, height: 1 };
								const rel = computeRelativeProps(
									{ x: shape.x, y: shape.y, width: shape.width, height: shape.height },
									groupBounds,
								);
								startShapeData.set(id, {
									x: shape.x,
									y: shape.y,
									width: shape.width,
									height: shape.height,
									minWidth: minSize.width,
									minHeight: minSize.height,
									...rel,
								});
							}
						}
						dragState = {
							mode: "multi-resize",
							handle: multiHandle,
							startPoint: { x: event.worldPoint.x, y: event.worldPoint.y },
							startGroupBounds: groupBounds,
							startShapeData,
							originalShapeData: new Map(startShapeData),
							originalFullShapes,
							applyBoundsBase: new Map(originalFullShapes),
						};
						return;
					}
				}
			}

			// 2. Double-click detection for group enter/exit
			const now = Date.now();
			const rawHitId = findShapeAtPoint(toolCtx, event.worldPoint);

			if (rawHitId && now - lastClickTime < 400 && lastClickId === rawHitId) {
				const shape = toolCtx.store.getShape(rawHitId);
				if (shape?.type === "group" || shape?.type === "frame") {
					// Enter group editing mode
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

				// Start drag-move for all selected shapes (including children of groups/frames)
				const currentSelection = toolCtx.store.getSelection();
				const startShapeSnapshots = new Map<string, ShapeData>();
				for (const id of currentSelection) {
					const shape = toolCtx.store.getShape(id);
					if (shape) {
						startShapeSnapshots.set(id, { ...shape });
						// Include all descendants of groups/frames/islands so they move together
						if (shape.type === "group" || shape.type === "frame" || shape.type === "island") {
							const queue = [id];
							while (queue.length > 0) {
								const parentId = queue.pop()!;
								const children = getChildShapes(toolCtx.store, parentId);
								for (const child of children) {
									if (!startShapeSnapshots.has(child.id)) {
										startShapeSnapshots.set(child.id, { ...child });
										// Recurse into nested containers
										if (
											child.type === "group" ||
											child.type === "frame" ||
											child.type === "island"
										) {
											queue.push(child.id);
										}
									}
								}
							}
						}
					}
				}
				setMovingSelection(true);
				dragState = {
					mode: "move",
					startPoint: { x: event.worldPoint.x, y: event.worldPoint.y },
					startShapeSnapshots,
				};
			} else {
				// Click on empty — start marquee selection
				if (!event.shiftKey) {
					toolCtx.store.clearSelection();
				}
				dragState = {
					mode: "marquee",
					startWorldPoint: { x: event.worldPoint.x, y: event.worldPoint.y },
					shiftKey: event.shiftKey,
				};
			}
		}

		function onPointerMove(toolCtx: ToolContext, event: CanvasPointerEvent) {
			if (!dragState) {
				// Hover: check for rotation handle first
				const viewport = toolCtx.store.getViewport();
				const rotHover = findRotationHandleAtScreenPoint(
					event.screenPoint,
					toolCtx.shapes,
					toolCtx.store,
					viewport,
				);
				if (rotHover) {
					setOverrideCursor("grab");
					return;
				}
				// Hover: check for resize handle and update cursor
				const handleHit = findHandleAtScreenPoint(
					event.screenPoint,
					toolCtx.shapes,
					toolCtx.store,
					viewport,
				);
				if (handleHit) {
					const hoverShape = toolCtx.store.getShape(handleHit.shapeId);
					const hoverRotation = safeRotation(hoverShape?.rotation);
					setOverrideCursor(
						hoverRotation
							? getRotatedCursorForHandle(handleHit.handle, hoverRotation)
							: getCursorForHandle(handleHit.handle),
					);
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
				// Hover indicator: detect shape under cursor
				const hoverHitId = findShapeAtPoint(toolCtx, event.worldPoint);
				setHoveredShapeId(hoverHitId);
				return;
			}

			if (dragState.mode === "rotate") {
				const currentAngle =
					Math.atan2(
						event.worldPoint.y - dragState.center.y,
						event.worldPoint.x - dragState.center.x,
					) *
					(180 / Math.PI);
				// Wrap angle diff to [-180, 180] to avoid ±360° jumps at atan2 boundary
				let angleDiff = currentAngle - dragState.startAngle;
				angleDiff = ((angleDiff + 540) % 360) - 180;
				let newRotation = dragState.startRotation + angleDiff;
				if (event.shiftKey) {
					newRotation = snapAngle(newRotation, 15);
				}
				newRotation = normalizeAngle(newRotation);
				toolCtx.store.updateShape(dragState.shapeId, { rotation: newRotation });

				// Rotate child shapes around the container center
				const deltaRad = ((newRotation - dragState.startRotation) * Math.PI) / 180;
				const { center } = dragState;
				for (const [childId, snap] of dragState.childSnapshots) {
					const childCx = snap.x + snap.width / 2;
					const childCy = snap.y + snap.height / 2;
					const rx = childCx - center.x;
					const ry = childCy - center.y;
					const cos = Math.cos(deltaRad);
					const sin = Math.sin(deltaRad);
					const newCx = center.x + rx * cos - ry * sin;
					const newCy = center.y + rx * sin + ry * cos;
					const childRotation = normalizeAngle(
						safeRotation(snap.rotation) + newRotation - dragState.startRotation,
					);
					toolCtx.store.updateShape(childId, {
						x: newCx - snap.width / 2,
						y: newCy - snap.height / 2,
						rotation: childRotation,
					});
				}
				return;
			}

			if (dragState.mode === "marquee") {
				// Alt key toggles between intersect and contain mode
				const mode: MarqueeMode = event.altKey ? "contain" : "intersect";
				setMarqueeMode(mode);

				// Compute world-space marquee (used for both hit testing and rendering)
				const wx = Math.min(dragState.startWorldPoint.x, event.worldPoint.x);
				const wy = Math.min(dragState.startWorldPoint.y, event.worldPoint.y);
				const ww = Math.abs(event.worldPoint.x - dragState.startWorldPoint.x);
				const wh = Math.abs(event.worldPoint.y - dragState.startWorldPoint.y);
				const worldRect: MarqueeRect = { x: wx, y: wy, width: ww, height: wh };
				const hitIds = findShapesInRect(toolCtx, worldRect, mode);

				setMarquee(worldRect, hitIds);
				return;
			}

			if (dragState.mode === "resize") {
				const def = toolCtx.shapes.get(dragState.startData.type);
				if (!def) return;

				const rotation = safeRotation(dragState.startData.rotation);
				const worldDelta: Point = {
					x: event.worldPoint.x - dragState.startPoint.x,
					y: event.worldPoint.y - dragState.startPoint.y,
				};
				// Transform delta to local (un-rotated) space for rotated shapes
				const delta = rotation ? deltaToLocal(worldDelta, rotation) : worldDelta;

				// Flip detection: use unclamped (raw) bounds so minSize doesn't
				// prevent the pointer from crossing the anchor edge.
				const rawBounds = computeRawBounds(dragState.startData, dragState.handle, delta);
				// Un-rotate the world point for flip detection in local space
				let worldPointForFlip = event.worldPoint;
				if (rotation) {
					// Use rawBounds center (not startData) since resize changes x/y/width/height
					const center = {
						x: rawBounds.x + rawBounds.width / 2,
						y: rawBounds.y + rawBounds.height / 2,
					};
					worldPointForFlip = unrotatePoint(event.worldPoint, center, (rotation * Math.PI) / 180);
				}
				const flip = applyFlip(dragState.handle, rawBounds, worldPointForFlip);
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
						setOverrideCursor(
							rotation
								? getRotatedCursorForHandle(flip.handle, rotation)
								: getCursorForHandle(flip.handle),
						);
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
				const resizedRecord = resized as unknown as Record<string, unknown>;
				const startRecord = dragState.startData as unknown as Record<string, unknown>;
				const updatesRecord = updates as Record<string, unknown>;
				for (const key of Object.keys(resized)) {
					if (key === "id" || key === "type" || key === "style") continue;
					const resizedValue = resizedRecord[key];
					const startValue = startRecord[key];
					if (resizedValue !== startValue) {
						updatesRecord[key] = resizedValue;
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

				// Flip detection on the group bounding box
				const rawGroupBounds = computeRawBounds(
					dragState.startGroupBounds,
					dragState.handle,
					delta,
				);
				const flip = applyFlip(dragState.handle, rawGroupBounds, event.worldPoint);
				if (flip.flipped) {
					const anchor = getAnchorEdges(dragState.handle, rawGroupBounds);
					// Reset group bounds to zero-size at anchor position (same approach as single resize)
					const flippedGroupBounds = { ...dragState.startGroupBounds };
					if (flip.flippedX && anchor.x !== undefined) {
						flippedGroupBounds.x = anchor.x;
						flippedGroupBounds.width = 0;
					}
					if (flip.flippedY && anchor.y !== undefined) {
						flippedGroupBounds.y = anchor.y;
						flippedGroupBounds.height = 0;
					}
					// Mirror relative ratios and reset only the flipped axis
					const flippedShapeData = new Map<string, MultiResizeShapeEntry>();
					for (const [id, data] of dragState.startShapeData) {
						const newRel = { ...data };
						if (flip.flippedX) {
							newRel.relX = 1 - data.relX - data.relWidth;
							newRel.x = flippedGroupBounds.x;
							newRel.width = 0;
						}
						if (flip.flippedY) {
							newRel.relY = 1 - data.relY - data.relHeight;
							newRel.y = flippedGroupBounds.y;
							newRel.height = 0;
						}
						flippedShapeData.set(id, newRel);
					}
					// Temporarily disable snap during flip-reset to prevent
					// snap from altering the zero-size anchor positioning
					toolCtx.events.emit("snap:configure", { enabled: false });
					for (const [id, data] of flippedShapeData) {
						const update: Partial<ShapeData> = {};
						if (flip.flippedX) {
							update.x = data.x;
							update.width = 0;
						}
						if (flip.flippedY) {
							update.y = data.y;
							update.height = 0;
						}
						toolCtx.store.updateShape(id, update);
					}
					toolCtx.events.emit("snap:configure", { enabled: true });
					// Snapshot current shapes as new base for applyBounds
					const flippedApplyBoundsBase = new Map<string, ShapeData>();
					for (const id of flippedShapeData.keys()) {
						const current = toolCtx.store.getShape(id);
						if (current) flippedApplyBoundsBase.set(id, { ...current });
					}
					dragState = {
						...dragState,
						handle: flip.handle,
						startPoint: { x: event.worldPoint.x, y: event.worldPoint.y },
						startGroupBounds: flippedGroupBounds,
						startShapeData: flippedShapeData,
						applyBoundsBase: flippedApplyBoundsBase,
						// originalShapeData/originalFullShapes preserved for undo
					};
					setOverrideCursor(getCursorForHandle(flip.handle));
					return;
				}

				const multiUpdates = computeMultiResizeUpdates(
					dragState.handle,
					dragState.startGroupBounds,
					delta,
					dragState.startShapeData,
				);
				for (const [id, upd] of multiUpdates) {
					const baseShape = dragState.applyBoundsBase.get(id);
					const def = baseShape ? toolCtx.shapes.get(baseShape.type) : undefined;
					if (def?.applyBounds && baseShape) {
						// Pass {x,y,width,height} first so snap plugin can adjust
						toolCtx.store.updateShape(id, upd);
						// Read back snapped bounds and derive geometry
						const snapped = toolCtx.store.getShape(id);
						if (snapped) {
							const snappedBounds = {
								x: snapped.x,
								y: snapped.y,
								width: snapped.width,
								height: snapped.height,
							};
							const geom = def.applyBounds(baseShape, snappedBounds);
							const { x: _x, y: _y, width: _w, height: _h, ...rest } = geom;
							if (Object.keys(rest).length > 0) {
								toolCtx.store.updateShape(id, rest);
							}
						}
					} else {
						toolCtx.store.updateShape(id, upd);
					}
				}
				return;
			}

			// mode === "move"
			const dx = event.worldPoint.x - dragState.startPoint.x;
			const dy = event.worldPoint.y - dragState.startPoint.y;

			const movingIds = new Set(dragState.startShapeSnapshots.keys());
			const currentSelection = toolCtx.store.getSelection();

			// Phase 1: Update selected (top-level) shapes first so snap adjusts them.
			// Track the snap delta so children can follow the same offset.
			let snapDx = 0;
			let snapDy = 0;
			for (const [id, snapshot] of dragState.startShapeSnapshots) {
				if (!currentSelection.has(id)) continue;
				toolCtx.store.updateShape(id, {
					x: snapshot.x + dx,
					y: snapshot.y + dy,
				});
				const snapped = toolCtx.store.getShape(id);
				if (snapped) {
					snapDx = snapped.x - (snapshot.x + dx);
					snapDy = snapped.y - (snapshot.y + dy);
				}
				const def = toolCtx.shapes.get(snapshot.type);
				if (def?.move) {
					if (snapped) {
						const snappedDx = snapped.x - snapshot.x;
						const snappedDy = snapped.y - snapshot.y;
						const geom = def.move(snapshot, snappedDx, snappedDy);
						const { x: _x, y: _y, ...rest } = geom;
						if (Object.keys(rest).length > 0) {
							toolCtx.store.updateShape(id, rest);
						}
					}
				}
			}

			// Phase 2: Update child shapes with the same snap delta as their parent.
			for (const [id, snapshot] of dragState.startShapeSnapshots) {
				if (currentSelection.has(id)) continue;
				toolCtx.store.updateShape(id, {
					x: snapshot.x + dx + snapDx,
					y: snapshot.y + dy + snapDy,
				});
				const def = toolCtx.shapes.get(snapshot.type);
				if (def?.move) {
					const snapped = toolCtx.store.getShape(id);
					if (snapped) {
						const snappedDx = snapped.x - snapshot.x;
						const snappedDy = snapped.y - snapshot.y;
						const geom = def.move(snapshot, snappedDx, snappedDy);
						const { x: _x, y: _y, ...rest } = geom;
						if (Object.keys(rest).length > 0) {
							toolCtx.store.updateShape(id, rest);
						}
					}
				}
			}

			// Drop target: find frame/group under the cursor (excluding dragged shapes)
			const allShapes = toolCtx.store.getShapes();
			let dropTarget: string | null = null;
			const entries = [...allShapes.entries()].reverse();
			for (const [id, shape] of entries) {
				if (movingIds.has(id)) continue;
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

			if (dragState.mode === "rotate") {
				setOverrideCursor("");
				const currentShape = toolCtx.store.getShape(dragState.shapeId);
				if (currentShape) {
					const parentFrom = { rotation: dragState.startRotation };
					const parentTo = { rotation: safeRotation(currentShape.rotation) };
					const hasMoved = parentFrom.rotation !== parentTo.rotation;

					if (hasMoved) {
						// Build before/after snapshots for parent + children
						const beforeSnapshots = new Map<string, Partial<ShapeData>>();
						const afterSnapshots = new Map<string, Partial<ShapeData>>();

						const shapeId = dragState.shapeId;
						beforeSnapshots.set(shapeId, { rotation: parentFrom.rotation });
						afterSnapshots.set(shapeId, { rotation: parentTo.rotation });

						for (const [childId, snap] of dragState.childSnapshots) {
							const current = toolCtx.store.getShape(childId);
							if (current) {
								beforeSnapshots.set(childId, {
									x: snap.x,
									y: snap.y,
									rotation: safeRotation(snap.rotation),
								});
								afterSnapshots.set(childId, {
									x: current.x,
									y: current.y,
									rotation: safeRotation(current.rotation),
								});
							}
						}

						queueMicrotask(() => {
							// Revert to before state
							for (const [id, props] of beforeSnapshots) {
								toolCtx.store.updateShape(id, props);
							}
							// Execute undoable command
							toolCtx.commands.execute({
								execute: () => {
									for (const [id, props] of afterSnapshots) {
										toolCtx.store.updateShape(id, props);
									}
								},
								undo: () => {
									for (const [id, props] of beforeSnapshots) {
										toolCtx.store.updateShape(id, props);
									}
								},
							});
						});
					}
				}
				dragState = null;
				return;
			}

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
					const currentRecord = currentShape as unknown as Record<string, unknown>;
					const startRecord = dragState.startData as unknown as Record<string, unknown>;
					const fromRecord = from as Record<string, unknown>;
					const toRecord = to as Record<string, unknown>;
					for (const key of Object.keys(currentShape)) {
						if (key === "id" || key === "type" || key === "style") continue;
						const currentValue = currentRecord[key];
						const startValue = startRecord[key];
						if (currentValue !== startValue) {
							fromRecord[key] = startValue;
							toRecord[key] = currentValue;
						}
					}

					if (Object.keys(to).length > 0) {
						// Defer reset+execute to after canvas:pointerup disables snap
						const shapeId = dragState.shapeId;
						queueMicrotask(() => {
							toolCtx.store.updateShape(shapeId, from);
							toolCtx.commands.execute(createUpdateShapeCommand(toolCtx.store, shapeId, from, to));
						});
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
				for (const [id, origFullShape] of dragState.originalFullShapes) {
					const currentShape = toolCtx.store.getShape(id);
					if (!currentShape) continue;
					const from: Partial<ShapeData> = {};
					const to: Partial<ShapeData> = {};
					const currentRecord = currentShape as unknown as Record<string, unknown>;
					const origRecord = origFullShape as unknown as Record<string, unknown>;
					const fromRecord = from as Record<string, unknown>;
					const toRecord = to as Record<string, unknown>;
					for (const key of Object.keys(currentShape)) {
						if (key === "id" || key === "type" || key === "style") continue;
						const currentValue = currentRecord[key];
						const origValue = origRecord[key];
						if (currentValue !== origValue) {
							fromRecord[key] = origValue;
							toRecord[key] = currentValue;
						}
					}
					if (Object.keys(to).length > 0) {
						batchUpdates.push({ id, from, to });
					}
				}
				if (batchUpdates.length > 0) {
					// Defer reset+execute to after canvas:pointerup disables snap
					const storeRef = toolCtx.store;
					queueMicrotask(() => {
						for (const { id, from } of batchUpdates) {
							storeRef.updateShape(id, from);
						}
						toolCtx.commands.execute(createBatchUpdateShapesCommand(storeRef, batchUpdates));
					});
				}
				dragState = null;
				return;
			}

			// mode === "move"
			setMovingSelection(false);
			// Build before/after snapshots for undoable command
			const beforeSnapshots = dragState.startShapeSnapshots;
			const afterSnapshots = new Map<string, ShapeData>();
			let hasMoved = false;
			for (const [id, before] of beforeSnapshots) {
				const current = toolCtx.store.getShape(id);
				if (current) {
					afterSnapshots.set(id, { ...current });
					if (Math.abs(current.x - before.x) > 0.5 || Math.abs(current.y - before.y) > 0.5) {
						hasMoved = true;
					}
				}
			}

			if (hasMoved) {
				// Collect the user-selected shapes (not their implicitly-moved children)
				const userSelectedIds = [...toolCtx.store.getSelection()];

				// Defer reset+execute to after canvas:pointerup disables snap,
				// then notify plugins for auto-parenting
				queueMicrotask(() => {
					for (const [id, before] of beforeSnapshots) {
						toolCtx.store.updateShape(id, before);
					}
					toolCtx.commands.execute(
						createMoveShapesCommand(toolCtx.store, beforeSnapshots, afterSnapshots),
					);
					// Notify after the move command is committed so reparent won't be undone
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
			ctx.layers.unregister("selection-overlay");
		};
	},
};
