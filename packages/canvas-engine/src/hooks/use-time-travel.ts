import type { EventBus, ShapeData } from "@edv4h/usketch-shared";
import { useEffect, useState } from "react";

/**
 * Subscribe to "time-travel:enter" and "time-travel:exit" events.
 * Returns the overridden shapes map while in time-travel mode, or null otherwise.
 */
export function useTimeTravelShapes(events: EventBus): ReadonlyMap<string, ShapeData> | null {
	const [shapes, setShapes] = useState<ReadonlyMap<string, ShapeData> | null>(null);

	useEffect(() => {
		const unsubEnter = events.on<{ shapes: Map<string, ShapeData> }>(
			"time-travel:enter",
			(data) => {
				setShapes(data.shapes);
			},
		);
		const unsubExit = events.on("time-travel:exit", () => {
			setShapes(null);
		});
		return () => {
			unsubEnter();
			unsubExit();
		};
	}, [events]);

	return shapes;
}
