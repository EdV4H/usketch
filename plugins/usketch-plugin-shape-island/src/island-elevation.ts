// Island elevation (高さ): the pure operations behind the HUD and the island service.
// An island's `islandElevation` is its ground height in world units (0 / absent =
// flat on the board). The metaball layer turns it into a raised block (real 3D under
// Mode 7, a shadow + thickness edge in the flat view), the island's member shapes are
// lifted onto its top in 3D, and the board's ground-height service reports it so a
// character can't climb a cliff taller than its step.
import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import { createBatchUpdateShapesCommand } from "@edv4h/usketch-store";
import type { IslandShapeData } from "./types.js";

/** Highest elevation the operations accept (world units). */
export const MAX_ISLAND_ELEVATION = 400;

type CommandSink = { execute: (cmd: { execute: () => void; undo: () => void }) => void };

/** Clamp to `[0, MAX_ISLAND_ELEVATION]`; non-finite → 0. */
export function clampElevation(value: number): number {
	if (!Number.isFinite(value) || value <= 0) return 0;
	return Math.min(MAX_ISLAND_ELEVATION, Math.round(value));
}

/** An island's elevation (0 for flat islands and for non-island shapes). */
export function getIslandElevation(shape: ShapeData | undefined): number {
	if (shape?.type !== "island") return 0;
	return clampElevation((shape as IslandShapeData).islandElevation ?? 0);
}

/**
 * Set the elevation of the given islands (non-island ids are ignored) as ONE undoable
 * command. `0` clears the field. Returns the ids that actually changed.
 */
export function setIslandElevation(
	store: BoardStore,
	commands: CommandSink,
	ids: Iterable<string>,
	elevation: number,
): string[] {
	const next = clampElevation(elevation);
	const updates: Array<{ id: string; from: Partial<ShapeData>; to: Partial<ShapeData> }> = [];
	for (const id of ids) {
		const shape = store.getShape(id);
		if (shape?.type !== "island") continue;
		if (getIslandElevation(shape) === next) continue;
		const current = (shape as IslandShapeData).islandElevation;
		updates.push({
			id,
			from: { islandElevation: current } as Partial<ShapeData>,
			to: { islandElevation: next === 0 ? undefined : next } as Partial<ShapeData>,
		});
	}
	if (updates.length > 0) commands.execute(createBatchUpdateShapesCommand(store, updates));
	return updates.map((u) => u.id);
}

/** Selected island ids (in selection order). */
export function selectedIslandIds(store: BoardStore): string[] {
	const ids: string[] = [];
	for (const id of store.getSelection()) {
		if (store.getShape(id)?.type === "island") ids.push(id);
	}
	return ids;
}

/**
 * Ground height at a world point: the highest elevation among the islands whose box
 * contains it (islands are axis-aligned rounded rects; the corner rounding is ignored).
 * 0 off every island.
 */
export function islandElevationAt(store: BoardStore, x: number, y: number): number {
	let best = 0;
	for (const [, shape] of store.getShapes()) {
		if (shape.type !== "island") continue;
		if (x < shape.x || x > shape.x + shape.width || y < shape.y || y > shape.y + shape.height) {
			continue;
		}
		best = Math.max(best, getIslandElevation(shape));
	}
	return best;
}

/**
 * The elevation each shape should be lifted by in 3D: shapes that belong to an
 * elevated island (its descendants via `parentId`, through frames/groups) stand on its
 * top. Islands themselves and island-groups are not listed. Only non-zero entries.
 */
export function liftedShapeElevations(store: BoardStore): Map<string, number> {
	const shapes = store.getShapes();
	const memo = new Map<string, number>();
	const resolve = (id: string, depth: number): number => {
		const cached = memo.get(id);
		if (cached !== undefined) return cached;
		const shape = shapes.get(id);
		const parentId = shape?.parentId as string | undefined;
		let h = 0;
		if (parentId && depth < 32) {
			const parent = shapes.get(parentId);
			h = parent?.type === "island" ? getIslandElevation(parent) : resolve(parentId, depth + 1);
		}
		memo.set(id, h);
		return h;
	};
	const out = new Map<string, number>();
	for (const [id, shape] of shapes) {
		if (shape.type === "island") continue;
		const h = resolve(id, 0);
		if (h > 0) out.set(id, h);
	}
	return out;
}
