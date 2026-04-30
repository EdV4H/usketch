import type { ShapeData } from "@edv4h/usketch-shared";
import type { ConnectableShapeData } from "./types.js";

export interface CascadeDeleteStore {
	getShapes(): ReadonlyMap<string, ShapeData>;
	deleteShape(id: string): void;
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
		for (const [id, shape] of shapes) {
			if (!isConnectorType(shape.type)) continue;
			const connectorData = shape as ConnectableShapeData;
			if (connectorData.sourceId === payload.id || connectorData.targetId === payload.id) {
				toDelete.push(id);
			}
		}
		for (const id of toDelete) {
			store.deleteShape(id);
		}
	});
}
