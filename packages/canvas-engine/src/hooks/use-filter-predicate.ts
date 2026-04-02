import type { EventBus, ShapeData } from "@edv4h/usketch-shared";
import { useEffect, useState } from "react";

type ShapeFilterPredicate = (shape: ShapeData) => boolean;

/**
 * Subscribe to "filter:changed" events and return the current filter predicate.
 * Returns null when no filter is active.
 */
export function useFilterPredicate(events: EventBus): ShapeFilterPredicate | null {
	const [predicate, setPredicate] = useState<ShapeFilterPredicate | null>(null);

	useEffect(() => {
		return events.on<{ predicate: ShapeFilterPredicate | null }>("filter:changed", (data) => {
			setPredicate(() => data.predicate);
		});
	}, [events]);

	return predicate;
}
