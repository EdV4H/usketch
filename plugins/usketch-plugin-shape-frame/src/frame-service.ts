// Frame operations as plain functions that take the BoardStore (per
// docs/plugin-system-design.md); the HUD only calls them.
import type { BoardStore, Command } from "@edv4h/usketch-shared";
import { createBatchUpdateShapesCommand } from "@edv4h/usketch-store";
import type { FrameShapeData } from "./types.js";

type ShapeUpdate = { id: string; from: Partial<FrameShapeData>; to: Partial<FrameShapeData> };

/** The frame shapes among `ids` (unknown ids and other shape types are skipped). */
export function getFrameShapes(store: BoardStore, ids: Iterable<string>): FrameShapeData[] {
	const out: FrameShapeData[] = [];
	for (const id of ids) {
		const shape = store.getShape(id);
		if (shape?.type === "frame") out.push(shape as FrameShapeData);
	}
	return out;
}

/** Whether deleting this frame also deletes the items inside it (default `true`). */
export function shouldDeleteFrameContents(frame: FrameShapeData): boolean {
	return frame.deleteContents !== false;
}

/**
 * Set whether deleting the frames among `ids` also deletes their contents.
 * The default (`true`) is stored as `undefined`. Returns `null` when nothing changes.
 */
export function setFrameDeleteContents(
	store: BoardStore,
	ids: Iterable<string>,
	deleteContents: boolean,
): Command | null {
	const updates: ShapeUpdate[] = [];
	for (const frame of getFrameShapes(store, ids)) {
		if (shouldDeleteFrameContents(frame) === deleteContents) continue;
		updates.push({
			id: frame.id,
			from: { deleteContents: frame.deleteContents },
			to: { deleteContents: deleteContents ? undefined : false },
		});
	}
	return updates.length > 0 ? createBatchUpdateShapesCommand(store, updates) : null;
}
