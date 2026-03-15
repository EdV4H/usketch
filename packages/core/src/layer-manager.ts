import type { Layer, LayerManager, ResolvedLayer } from "@edv4h/usketch-shared";

function resolveLayer(layer: Layer): ResolvedLayer {
	return {
		id: layer.id,
		order: layer.order ?? 0,
		render: layer.render ?? (() => null),
		interactable: layer.interactable,
		renderTarget: layer.renderTarget,
	};
}

export function createLayerManager(): LayerManager {
	const layers = new Map<string, ResolvedLayer>();
	let sorted: readonly ResolvedLayer[] = [];

	function rebuildSorted() {
		sorted = [...layers.values()].sort((a, b) => a.order - b.order);
	}

	return {
		register(layer: Layer): void {
			layers.set(layer.id, resolveLayer(layer));
			rebuildSorted();
		},

		unregister(layerId: string): void {
			layers.delete(layerId);
			rebuildSorted();
		},

		getLayers(): readonly ResolvedLayer[] {
			return sorted;
		},
	};
}
