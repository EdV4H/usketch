import type { Layer, LayerManager } from "@usketch/shared";

export function createLayerManager(): LayerManager {
	const layers = new Map<string, Layer>();
	let sorted: readonly Layer[] = [];

	function rebuildSorted() {
		sorted = [...layers.values()].sort((a, b) => a.order - b.order);
	}

	return {
		register(layer: Layer): void {
			layers.set(layer.id, layer);
			rebuildSorted();
		},

		unregister(layerId: string): void {
			layers.delete(layerId);
			rebuildSorted();
		},

		getLayers(): readonly Layer[] {
			return sorted;
		},
	};
}
