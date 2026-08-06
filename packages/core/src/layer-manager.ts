import type { Layer, LayerManager } from "@edv4h/usketch-shared";

/**
 * Default per-collision bump for `avoidCollision` layers. `2 ** -10` (=1/1024)
 * is exactly representable in binary floating point, so integer-base + k*step
 * sums stay exact. It also keeps the layer below the next integer order for up
 * to 1023 collisions at the same base — far more than any realistic layer set.
 */
const DEFAULT_COLLISION_STEP = 2 ** -10;

export function createLayerManager(): LayerManager {
	const layers = new Map<string, Layer>();
	// id → resolved effective order used for sorting. For plain layers this is
	// just `layer.order`; for `avoidCollision` layers it may be bumped up.
	const effectiveOrders = new Map<string, number>();
	let sorted: readonly Layer[] = [];

	/**
	 * Resolve the effective order for `layer`. Plain layers keep their `order`.
	 * `avoidCollision` layers start at `order` and step up until they land on a
	 * slot not occupied by any *other* layer's effective order.
	 */
	function resolveOrder(layer: Layer): number {
		if (!layer.avoidCollision) return layer.order;

		const used = new Set<number>();
		for (const [id, eff] of effectiveOrders) {
			if (id !== layer.id) used.add(eff);
		}

		// Guard the caller's step: 0 / negative / non-finite would make the bump
		// loop below never terminate. Fall back to the default in those cases.
		const requested = layer.collisionStep ?? DEFAULT_COLLISION_STEP;
		const step = Number.isFinite(requested) && requested > 0 ? requested : DEFAULT_COLLISION_STEP;
		let eff = layer.order;
		while (used.has(eff)) eff += step;
		return eff;
	}

	function rebuildSorted() {
		sorted = [...layers.values()].sort(
			(a, b) => (effectiveOrders.get(a.id) ?? a.order) - (effectiveOrders.get(b.id) ?? b.order),
		);
	}

	return {
		register(layer: Layer): void {
			// Drop any prior effective order first so a re-register doesn't collide
			// with its own previous slot.
			effectiveOrders.delete(layer.id);
			layers.set(layer.id, layer);
			effectiveOrders.set(layer.id, resolveOrder(layer));
			rebuildSorted();
		},

		unregister(layerId: string): void {
			// Only removes this layer; other layers keep their resolved orders so
			// nothing visually reshuffles. The freed slot is reusable by later
			// registrations.
			layers.delete(layerId);
			effectiveOrders.delete(layerId);
			rebuildSorted();
		},

		getLayers(): readonly Layer[] {
			return sorted;
		},
	};
}
