import type {
	BoardStore,
	CanvasPointerEvent,
	Point,
	ResizeHandle,
	ShapeData,
	ShapeRegistry,
	ToolContext,
	Viewport,
} from "@edv4h/usketch-shared";
import { safeRotation } from "@edv4h/usketch-shared";
import { getTopLevelAncestor } from "@edv4h/usketch-store";
import {
	findHandleAtScreenPoint,
	findMultiHandleAtScreenPoint,
	findRotationHandleAtScreenPoint,
	getCursorForHandle,
	getMultiSelectionBounds,
	getRotatedCursorForHandle,
} from "./internal/resize-handles.js";

export interface HoverResult {
	/**
	 * The cursor the tool should display. The empty string means "no override
	 * — fall back to the tool's default cursor". Callers typically pipe this
	 * through a CSS `!important` style injection so handle hover overrides
	 * the tool cursor.
	 */
	cursor: string;
	/** ID of the shape directly under the world cursor, or `null`. */
	hoveredShapeId: string | null;
	/** Resize handle hit (single-selection or multi-selection). */
	handleHit?: { shapeId: string | null; handle: ResizeHandle };
	/** Rotation handle hit — `shapeId` is the shape whose rotation handle the cursor is over. */
	rotationHit?: { shapeId: string };
}

/**
 * Pure hover hit-test. Walks (in priority order) rotation handle → resize
 * handle (single) → resize handle (multi-selection) → shape body, returning
 * the appropriate cursor + hit info for the tool to render.
 *
 * Extracted from `plugin-tool-select`'s `onPointerMove` hover branch so
 * other tools can reuse the same handle-hit precedence without re-deriving
 * it. The function does not mutate any global state — the caller is
 * expected to push the cursor through whatever style mechanism it uses
 * (e.g. tool-select's `<style>` tag injection) and update its own
 * "hovered shape" subscription.
 */
export function trackHover(
	ctx: ToolContext,
	event: CanvasPointerEvent,
	options: TrackHoverOptions = {},
): HoverResult {
	const viewport = ctx.store.getViewport();

	// 1. Rotation handle (outside bbox, no conflict with resize)
	const rotationHit = findRotationHandleAtScreenPoint(
		event.screenPoint,
		ctx.shapes,
		ctx.store,
		viewport,
	);
	if (rotationHit) {
		return {
			cursor: "grab",
			hoveredShapeId: null,
			rotationHit: { shapeId: rotationHit },
		};
	}

	// 2. Resize handle (single-selection)
	const handleHit = findHandleAtScreenPoint(event.screenPoint, ctx.shapes, ctx.store, viewport);
	if (handleHit) {
		const hoverShape = ctx.store.getShape(handleHit.shapeId);
		const rotation = safeRotation(hoverShape?.rotation);
		return {
			cursor: rotation
				? getRotatedCursorForHandle(handleHit.handle, rotation)
				: getCursorForHandle(handleHit.handle),
			hoveredShapeId: null,
			handleHit: { shapeId: handleHit.shapeId, handle: handleHit.handle },
		};
	}

	// 3. Multi-selection handle
	const selection = ctx.store.getSelection();
	if (selection.size > 1) {
		const groupBounds = getMultiSelectionBounds(ctx.store, ctx.shapes, selection);
		if (groupBounds) {
			const multiHandle = findMultiHandleAtScreenPoint(event.screenPoint, groupBounds, viewport);
			if (multiHandle) {
				return {
					cursor: getCursorForHandle(multiHandle),
					hoveredShapeId: null,
					handleHit: { shapeId: null, handle: multiHandle },
				};
			}
		}
	}

	// 4. Plain shape hover
	const hoveredShapeId = findShapeAtPoint(ctx, event.worldPoint, options);
	return { cursor: "", hoveredShapeId };
}

export interface TrackHoverOptions {
	/**
	 * If set, only shapes whose `parentId` matches will be considered hits
	 * (used by tool-select when "inside" a group/frame editing session).
	 * Other shapes are ignored even if they pass hit-test.
	 */
	editingGroupId?: string | null;
	/**
	 * Shape ids to skip during the hit-test walk. Useful for drag-and-drop
	 * "drop onto the shape underneath the dragged one" — pass the dragged
	 * shape's id so the walk returns the next shape below it instead of the
	 * dragged shape itself.
	 */
	excludeIds?: ReadonlySet<string> | readonly string[];
	/**
	 * Predicate to skip shapes during the walk (return `false` to skip).
	 * Applied in addition to `excludeIds`. The first non-skipped shape that
	 * passes hit-test (per the normal precedence rules) wins.
	 */
	filter?: (shape: ShapeData) => boolean;
}

/**
 * Top-most shape under a world point, with the same precedence rules
 * tool-select uses: non-container shapes win over containers, group
 * children resolve to the top-level group ancestor, frame/island children
 * stay selectable directly.
 *
 * Exposed (rather than inlined inside `trackHover`) because tools other
 * than select sometimes need just "what shape is under this point?" —
 * for example, a custom hyperlink tool that opens a popup on shape hover.
 */
export function findShapeAtPoint(
	ctx: ToolContext,
	point: Point,
	options: TrackHoverOptions = {},
): string | null {
	const editingGroupId = options.editingGroupId ?? null;
	const excludeSet =
		options.excludeIds instanceof Set
			? options.excludeIds
			: options.excludeIds
				? new Set(options.excludeIds)
				: null;
	const filter = options.filter;
	const shapes = ctx.store.getShapes();
	const CONTAINER_TYPES = new Set(["island", "frame"]);
	const entries = [...shapes.entries()].reverse();

	let containerHit: string | null = null;
	for (const [id, data] of entries) {
		// Skip excluded / filtered-out shapes before hit-testing.
		if (excludeSet?.has(id)) continue;
		if (filter && !filter(data)) continue;
		const def = ctx.shapes.get(data.type);
		if (!def?.hitTest(data, point)) continue;

		if (editingGroupId) {
			if (data.parentId === editingGroupId) return id;
			continue;
		}

		if (typeof data.parentId === "string") {
			const parent = ctx.store.getShape(data.parentId);
			if (parent?.type === "frame" || parent?.type === "island") {
				return id;
			}
			const ancestor = getTopLevelAncestor(ctx.store, id);
			if (ancestor) return ancestor.id;
			continue;
		}

		if (CONTAINER_TYPES.has(data.type)) {
			if (!containerHit) containerHit = id;
			continue;
		}

		return id;
	}
	return containerHit;
}

// Internal re-export so consumers don't need to dig into `internal/`.
export type { BoardStore, ShapeRegistry, Viewport };
