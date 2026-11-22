import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import { getChildShapes } from "@edv4h/usketch-store";
import {
	isZone,
	storedZoneMeta,
	type TabletopZoneMeta,
	type ZoneAlign,
	type ZoneArrange,
	type ZoneFace,
} from "./zone.js";

// Store-bound operations on zones. Plain functions (the HUD actions and the
// service call these). Setting a zone's options is an edit of the zone, so it
// goes through the store directly like other meta edits; callers wanting undo
// wrap it in a command.

/** The zone `shapeId` is held by, or `undefined`. */
export function zoneOf(store: BoardStore, shapeId: string): ShapeData | undefined {
	const shape = store.getShape(shapeId);
	const parentId = shape?.parentId;
	if (typeof parentId !== "string") return undefined;
	const parent = store.getShape(parentId);
	return isZone(parent) ? parent : undefined;
}

/** What a zone holds (its direct children), in no particular order. */
export function zoneContents(store: BoardStore, zoneId: string): ShapeData[] {
	return isZone(store.getShape(zoneId)) ? getChildShapes(store, zoneId) : [];
}

/** How many shapes a zone holds. */
export function zoneCount(store: BoardStore, zoneId: string): number {
	return zoneContents(store, zoneId).length;
}

/** Patch a zone's meta. Returns false when `zoneId` is not a zone. */
export function updateZoneMeta(
	store: BoardStore,
	zoneId: string,
	patch: Partial<TabletopZoneMeta>,
): boolean {
	const zone = store.getShape(zoneId);
	if (!isZone(zone) || !zone) return false;
	// Keep `align` unset unless the zone or the patch sets it (it then follows `arrange`).
	const next = { ...(zone.meta ?? {}), ...storedZoneMeta(zone), ...patch };
	store.updateShape(zoneId, { meta: next as ShapeData["meta"] });
	return true;
}

export const setZoneLabel = (store: BoardStore, zoneId: string, label: string) =>
	updateZoneMeta(store, zoneId, { label });
export const setZoneArrange = (store: BoardStore, zoneId: string, arrange: ZoneArrange) =>
	updateZoneMeta(store, zoneId, { arrange });
export const setZoneAlign = (store: BoardStore, zoneId: string, align: ZoneAlign) =>
	updateZoneMeta(store, zoneId, { align });
export const setZoneFace = (store: BoardStore, zoneId: string, face: ZoneFace) =>
	updateZoneMeta(store, zoneId, { face });
export const setZoneAccepts = (store: BoardStore, zoneId: string, accepts: readonly string[]) =>
	updateZoneMeta(store, zoneId, { accepts: [...accepts] });
