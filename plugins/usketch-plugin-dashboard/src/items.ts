// Which shapes the dashboard treats as grid items. Items are the board's
// TOP-LEVEL shapes (parentId == null) — a group or frame is itself one item; its
// children ride along natively and are never packed individually. Excluded:
//   - the `dashboard-config` substrate singleton (config, not content),
//   - locked or hidden shapes (the user pinned them out of the flow),
//   - degenerate substrates with no area (other data-only shapes).
import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import { getTopLevelShapes, isEffectivelyHidden, isEffectivelyLocked } from "@edv4h/usketch-store";
import { isDashboardConfig } from "./dashboard-config-shape.js";

/** True if `shape` participates in the dashboard grid flow. */
export function isDashboardItem(store: BoardStore, shape: ShapeData): boolean {
	if (isDashboardConfig(shape)) return false;
	if (shape.width <= 0 || shape.height <= 0) return false; // substrate / zero-area
	if (isEffectivelyLocked(store, shape)) return false;
	if (isEffectivelyHidden(store, shape)) return false;
	return true;
}

/** The board's current grid items, unordered (callers derive order from geometry). */
export function dashboardItems(store: BoardStore): ShapeData[] {
	return getTopLevelShapes(store).filter((s) => isDashboardItem(store, s));
}
