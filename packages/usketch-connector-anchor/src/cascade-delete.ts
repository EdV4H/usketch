import type { ShapeData } from "@edv4h/usketch-shared";
import type { ConnectableShapeData } from "./types.js";

export interface CascadeDeleteStore {
	getShapes(): ReadonlyMap<string, ShapeData>;
	deleteShape(id: string): void;
	updateShape(id: string, patch: Partial<ShapeData>): void;
	onMutation(
		listener: (event: { type: string; payload?: { id?: string } | unknown }) => void,
	): () => void;
}

export interface CascadeDeleteOptions {
	store: CascadeDeleteStore;
	/** Predicate to decide whether a given shape `type` is a connector handled by this listener. */
	isConnectorType: (type: string) => boolean;
}

/**
 * Wire up a subscriber that, when a shape is removed, cascades the deletion
 * to any connector whose `sourceId` or `targetId` referenced the removed shape.
 * A connector with only one connected end is detached instead: that end becomes
 * free at its current point.
 *
 * Returns a teardown function.
 */
export function createCascadeDelete(opts: CascadeDeleteOptions): () => void {
	const { store, isConnectorType } = opts;

	return store.onMutation((event) => {
		if (event.type !== "shape:removed") return;
		const payload = event.payload as { id?: string } | undefined;
		if (!payload?.id) return;

		const shapes = store.getShapes();
		const toDelete: string[] = [];
		const toDetach: { id: string; key: "sourceId" | "targetId" }[] = [];
		for (const [id, shape] of shapes) {
			if (!isConnectorType(shape.type)) continue;
			const { sourceId, targetId } = shape as ConnectableShapeData;
			if (sourceId !== payload.id && targetId !== payload.id) continue;
			if (sourceId && targetId) {
				toDelete.push(id);
			} else {
				toDetach.push({ id, key: sourceId === payload.id ? "sourceId" : "targetId" });
			}
		}
		for (const id of toDelete) {
			store.deleteShape(id);
		}
		for (const { id, key } of toDetach) {
			store.updateShape(id, { [key]: undefined } as Partial<ShapeData>);
		}
	});
}
