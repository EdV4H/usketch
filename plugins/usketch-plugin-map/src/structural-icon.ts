// Structural ("world layer") map-icons (#955): icons the generic Select tool can't
// touch (not selectable / movable / deletable) but the Map tool can still edit
// (place / erase / beacon). This is the "併用" of the issue's two options: the
// Select skip reuses the existing `locked` gate (every generic select path already
// honors `isEffectivelyLocked`), while the Map tool ignores the lock *only* for
// structural icons. So `structural` icons are stored as `locked:true` + a
// `meta.structural` marker, giving a clean 3-state model:
//
//   normal     (locked:false)                 → Select ✓  Map ✓
//   structural (locked:true, structural:true) → Select ✗  Map ✓
//   frozen     (locked:true, structural:false)→ Select ✗  Map ✗
//
// Operation logic lives here as plain functions over a BoardStore (per
// docs/plugin-system-design.md), so the map service can expose them without the HUD.
import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import { isEffectivelyHidden, isEffectivelyLocked } from "@edv4h/usketch-store";
import { isStructuralIcon, MAP_ICON_TYPE, type MapIconShapeData } from "./map-icon-shape.js";

/** Whether the map-icon `id` is currently structural (Select-protected, Map-editable). */
export function isIconStructural(store: BoardStore, id: string): boolean {
	const s = store.getShape(id);
	return s ? isStructuralIcon(s) : false;
}

/**
 * Mark a map-icon as structural (`true`) or normal (`false`).
 *
 * `true`  → sets `locked:true` + `meta.structural:true` so the Select tool skips it
 *           (via the `locked` gate) while the Map tool keeps editing it.
 * `false` → clears both, returning the icon to a normal selectable/movable state.
 *
 * No-op on a missing shape or a non-`map-icon`. Persisted + synced (it's shape data).
 */
export function setIconStructural(store: BoardStore, id: string, structural: boolean): void {
	const s = store.getShape(id);
	if (!s || s.type !== MAP_ICON_TYPE) return;
	// `updateShape` shallow-merges, so spread the existing meta to keep iconKey etc.
	const meta = (s as MapIconShapeData).meta;
	store.updateShape(id, {
		locked: structural ? true : undefined,
		meta: { ...meta, structural: structural ? true : undefined },
	});
}

/**
 * The predicate the Map tool uses to decide whether it may edit an icon: editable
 * unless it's effectively hidden, or effectively locked *and not* structural. Kept
 * here (rather than inline in the tool) so the "structural bypasses the lock" rule
 * is testable and shared. Mirrors normal canvas interaction rules otherwise.
 */
export function isMapIconEditable(store: BoardStore, shape: ShapeData): boolean {
	if (isEffectivelyHidden(store, shape)) return false;
	if (isEffectivelyLocked(store, shape) && !isStructuralIcon(shape)) return false;
	return true;
}
