import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import type { LiquidObstacle } from "./liquid-field.js";

/**
 * Which shapes push the liquid aside:
 * - `"marked"` — only shapes flagged with {@link DISPLACER_META_KEY} (the default:
 *   you pick the "specific objects" via {@link setLiquidDisplacer} / the HUD action).
 * - `"all"` — every visible shape.
 */
export type DisplacerMode = "marked" | "all";

/** `shape.meta[DISPLACER_META_KEY] === true` marks a shape as a liquid displacer. */
export const DISPLACER_META_KEY = "liquidDisplacer";

export function isLiquidDisplacer(shape: ShapeData): boolean {
	return shape.meta?.[DISPLACER_META_KEY] === true;
}

/** Flag (or unflag) shapes as liquid displacers. Synced like any shape meta. */
export function setLiquidDisplacer(store: BoardStore, ids: Iterable<string>, on: boolean): void {
	for (const id of ids) {
		const shape = store.getShape(id);
		if (!shape || isLiquidDisplacer(shape) === on) continue;
		const meta: Record<string, unknown> = { ...shape.meta };
		if (on) meta[DISPLACER_META_KEY] = true;
		else delete meta[DISPLACER_META_KEY];
		store.updateShape(id, { meta });
	}
}

/**
 * Toggle the displacer flag on `ids` as a group: if any of them is not yet a
 * displacer, all become displacers; otherwise all are cleared.
 * Returns the applied state.
 */
export function toggleLiquidDisplacer(store: BoardStore, ids: Iterable<string>): boolean {
	const list = [...ids];
	const shapes = list.map((id) => store.getShape(id)).filter((s) => s !== undefined);
	const on = shapes.some((s) => !isLiquidDisplacer(s));
	setLiquidDisplacer(store, list, on);
	return on;
}

/** Extra world-unit clearance around each displacer, so the parted liquid shows past its edge. */
export const DISPLACER_PADDING = 4;

/**
 * The obstacles the liquid should part around: displacers (per `mode`) that are
 * visible and overlap `bounds` (world). Ellipses part as ellipses, everything
 * else as its (rotated) bounding box.
 */
export function collectObstacles(
	shapes: Iterable<ShapeData>,
	mode: DisplacerMode,
	bounds: { x: number; y: number; width: number; height: number },
	padding = DISPLACER_PADDING,
): LiquidObstacle[] {
	const out: LiquidObstacle[] = [];
	for (const s of shapes) {
		if (s.hidden) continue;
		if (mode === "marked" && !isLiquidDisplacer(s)) continue;
		const w = Math.abs(s.width);
		const h = Math.abs(s.height);
		if (!Number.isFinite(w) || !Number.isFinite(h)) continue;
		const cx = s.x + s.width / 2;
		const cy = s.y + s.height / 2;
		const hw = w / 2 + padding;
		const hh = h / 2 + padding;
		// Cheap overlap test with the rotation-agnostic circumscribed square.
		const reach = Math.hypot(hw, hh);
		if (
			cx + reach < bounds.x ||
			cx - reach > bounds.x + bounds.width ||
			cy + reach < bounds.y ||
			cy - reach > bounds.y + bounds.height
		) {
			continue;
		}
		const deg = typeof s.rotation === "number" && Number.isFinite(s.rotation) ? s.rotation : 0;
		out.push({
			cx,
			cy,
			hw,
			hh,
			rotation: (deg * Math.PI) / 180,
			kind: s.type === "ellipse" ? "ellipse" : "rect",
		});
	}
	return out;
}
