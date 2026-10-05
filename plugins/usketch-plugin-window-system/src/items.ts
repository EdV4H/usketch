// Which shapes the window system treats as WINDOWS. Windows are the board's
// TOP-LEVEL shapes (parentId == null) — a group or frame is itself one window; its
// children ride along natively and are never tiled individually. Excluded:
//   - the `window-system-config` substrate singleton (config, not a window),
//   - locked or hidden shapes (the user pinned them out of the layout),
//   - degenerate substrates with no area (other data-only shapes).
import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import { getTopLevelShapes, isEffectivelyHidden, isEffectivelyLocked } from "@edv4h/usketch-store";
import { isWindowConfig } from "./window-config-shape.js";

/** True if `shape` is a tileable window: top-level, not the config substrate, has
 *  area, not locked/hidden. */
export function isWindow(store: BoardStore, shape: ShapeData): boolean {
	if (typeof shape.parentId === "string") return false; // nested → rides along
	if (isWindowConfig(shape)) return false;
	if (shape.width <= 0 || shape.height <= 0) return false; // substrate / zero-area
	if (isEffectivelyLocked(store, shape)) return false;
	if (isEffectivelyHidden(store, shape)) return false;
	return true;
}

/** The board's current windows (top-level, tileable), unordered. */
export function windows(store: BoardStore): ShapeData[] {
	return getTopLevelShapes(store).filter((s) => isWindow(store, s));
}

/** Just the ids of {@link windows}, for reconciling the tile tree. */
export function windowIds(store: BoardStore): string[] {
	return windows(store).map((s) => s.id);
}
