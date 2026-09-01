// Which shapes the dashboard treats as grid items. Items are the board's
// TOP-LEVEL shapes (parentId == null) — a group or frame is itself one item; its
// children ride along natively and are never packed individually. Excluded:
//   - the `dashboard-config` substrate singleton (config, not content),
//   - locked or hidden shapes (the user pinned them out of the flow),
//   - degenerate substrates with no area (other data-only shapes),
//   - shapes OUTSIDE the grid's column band — dragging a shape past the columns
//     (or above the origin) frees it from the grid; dragging it back re-manages it.
import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import { getTopLevelShapes, isEffectivelyHidden, isEffectivelyLocked } from "@edv4h/usketch-store";
import { getDashboardConfig, gridSpecFromConfig } from "./config-ops.js";
import { isDashboardConfig } from "./dashboard-config-shape.js";
import { cellOfPoint, type GridSpec } from "./grid.js";

/** True if `shape` passes the base (position-agnostic) grid-item checks: top-level,
 *  not the config substrate, has area, not locked/hidden. */
export function isDashboardItem(store: BoardStore, shape: ShapeData): boolean {
	if (typeof shape.parentId === "string") return false; // nested → not a grid item
	if (isDashboardConfig(shape)) return false;
	if (shape.width <= 0 || shape.height <= 0) return false; // substrate / zero-area
	if (isEffectivelyLocked(store, shape)) return false;
	if (isEffectivelyHidden(store, shape)) return false;
	return true;
}

/** Whether a shape sits within the grid's column band (and at/below the origin
 *  row). A shape whose top-left cell falls left of the first column, right of the
 *  last, or above row 0 is OUT of range → left free (not managed). The grid grows
 *  downward without bound, so any row ≥ 0 is in range. */
export function isWithinGrid(shape: ShapeData, spec: GridSpec): boolean {
	const cols = Math.max(1, Math.floor(spec.columns));
	const cell = cellOfPoint(shape.x, shape.y, spec);
	return cell.col >= 0 && cell.col < cols && cell.row >= 0;
}

/** True if `shape` is a MANAGED grid item on this board: base checks + in range. */
export function isGridItem(store: BoardStore, shape: ShapeData): boolean {
	if (!isDashboardItem(store, shape)) return false;
	const config = getDashboardConfig(store);
	return config ? isWithinGrid(shape, gridSpecFromConfig(config)) : true;
}

/** The board's current managed grid items (base checks + within the grid range),
 *  unordered — callers derive order from geometry. Used by the live drag/reflow so
 *  out-of-range shapes are left free. */
export function dashboardItems(store: BoardStore): ShapeData[] {
	const config = getDashboardConfig(store);
	const spec = config ? gridSpecFromConfig(config) : null;
	return getTopLevelShapes(store).filter(
		(s) => isDashboardItem(store, s) && (spec === null || isWithinGrid(s, spec)),
	);
}

/** Every top-level dashboard item, IGNORING the grid range — used by `enable` and
 *  the "整列" action, which deliberately gather all shapes into the grid (bringing
 *  out-of-range ones back in). */
export function allDashboardItems(store: BoardStore): ShapeData[] {
	return getTopLevelShapes(store).filter((s) => isDashboardItem(store, s));
}
