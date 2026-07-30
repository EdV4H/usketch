import type { BoundingBox, CanvasPointerEvent, Point, ToolContext } from "@edv4h/usketch-shared";
import { hasSelectableChildren, isAttachable } from "@edv4h/usketch-shared";
import {
	getTopLevelAncestor,
	isEffectivelyHidden,
	isEffectivelyLocked,
} from "@edv4h/usketch-store";
import type { ToolSession } from "./types.js";

export type MarqueeMode = "intersect" | "contain";

export interface MarqueeUpdate {
	rect: BoundingBox;
	mode: MarqueeMode;
	hitIds: ReadonlySet<string>;
}

export interface MarqueeCommit {
	/** Final hit IDs the marquee resolved to, or `null` if the rect was too small to count. */
	selection: ReadonlySet<string>;
	rect: BoundingBox;
	mode: MarqueeMode;
}

export interface MarqueeSessionOptions {
	ctx: ToolContext;
	startWorldPoint: Point;
	/**
	 * Minimum dimension (in world units) below which the commit returns
	 * `null` — accidental clicks that drag a few pixels shouldn't clear
	 * selection. Default 2 (matches tool-select).
	 */
	minDragDistance?: number;
	/**
	 * Restrict hits to children of this group ID. Mirrors tool-select's
	 * "group editing mode" — outside that mode, pass `null`.
	 */
	editingGroupId?: string | null;
}

/**
 * Marquee selection session — extracted from `plugin-tool-select`'s
 * `mode: "marquee"`. On each pointermove the rect grows from
 * `startWorldPoint` to the current pointer; the alt key flips between
 * "intersect" (any overlap counts) and "contain" (rect must fully
 * enclose the shape) hit modes.
 *
 * `commit()` returns the final selection. The session does NOT call
 * `ctx.store.setSelection()` — the caller decides whether to replace
 * the selection (single click) or extend it (shift+marquee).
 */
export function startMarqueeSession(
	opts: MarqueeSessionOptions,
): ToolSession<MarqueeUpdate, MarqueeCommit> {
	const { ctx, startWorldPoint, minDragDistance = 2, editingGroupId = null } = opts;

	let lastUpdate: MarqueeUpdate = {
		rect: { x: startWorldPoint.x, y: startWorldPoint.y, width: 0, height: 0 },
		mode: "intersect",
		hitIds: new Set(),
	};
	let cancelled = false;

	function buildRect(event: CanvasPointerEvent): BoundingBox {
		const x = Math.min(startWorldPoint.x, event.worldPoint.x);
		const y = Math.min(startWorldPoint.y, event.worldPoint.y);
		const width = Math.abs(event.worldPoint.x - startWorldPoint.x);
		const height = Math.abs(event.worldPoint.y - startWorldPoint.y);
		return { x, y, width, height };
	}

	return {
		update(event: CanvasPointerEvent): MarqueeUpdate {
			if (cancelled) return lastUpdate;
			const rect = buildRect(event);
			const mode: MarqueeMode = event.altKey ? "contain" : "intersect";
			const hitIds = findShapesInRect(ctx, rect, mode, editingGroupId);
			lastUpdate = { rect, mode, hitIds };
			return lastUpdate;
		},

		commit(): MarqueeCommit | null {
			if (cancelled) return null;
			const { rect, mode, hitIds } = lastUpdate;
			if (rect.width < minDragDistance && rect.height < minDragDistance) {
				return null;
			}
			return { selection: hitIds, rect, mode };
		},

		cancel(): void {
			cancelled = true;
		},
	};
}

/**
 * Pure shape-in-rect hit test using the same precedence as
 * tool-select's marquee (frame children stay selectable, group children
 * resolve to their top-level ancestor). Exposed so custom tools can
 * implement their own marquee variants without copying the predicate.
 */
export function findShapesInRect(
	ctx: ToolContext,
	rect: BoundingBox,
	mode: MarqueeMode,
	editingGroupId: string | null = null,
): Set<string> {
	const test = mode === "contain" ? boxContains : boxesIntersect;
	const shapes = ctx.store.getShapes();
	const ids = new Set<string>();

	for (const [id, data] of shapes) {
		// Hidden or locked shapes (or those under a hidden/locked ancestor) never
		// enter a marquee selection.
		if (isEffectivelyHidden(ctx.store, data) || isEffectivelyLocked(ctx.store, data)) continue;
		const def = ctx.shapes.get(data.type);
		const bounds = def
			? def.getBounds(data)
			: { x: data.x, y: data.y, width: data.width, height: data.height };
		if (!test(rect, bounds)) continue;

		if (editingGroupId) {
			if (data.parentId === editingGroupId) ids.add(id);
			continue;
		}

		if (typeof data.parentId === "string") {
			const parent = ctx.store.getShape(data.parentId);
			if (parent && hasSelectableChildren(ctx.shapes.get(parent.type), parent)) {
				ids.add(id);
			} else if (isAttachable(def, data)) {
				// Attachable children (stickers/kimochi) stay independently
				// selectable rather than resolving to the parent (see hover.ts).
				ids.add(id);
			} else {
				const ancestor = getTopLevelAncestor(ctx.store, id);
				if (ancestor) ids.add(ancestor.id);
			}
			continue;
		}

		ids.add(id);
	}
	return ids;
}

export function boxesIntersect(a: BoundingBox, b: BoundingBox): boolean {
	return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Returns true if `a` fully contains `b`. */
export function boxContains(a: BoundingBox, b: BoundingBox): boolean {
	return (
		a.x <= b.x && a.y <= b.y && a.x + a.width >= b.x + b.width && a.y + a.height >= b.y + b.height
	);
}
