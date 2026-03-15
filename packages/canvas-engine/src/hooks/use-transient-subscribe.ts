import type { TransientObject, TransientRegistry } from "@edv4h/usketch-shared";
import { useCallback, useEffect, useState } from "react";

export function useTransientSubscribe(
	registry: TransientRegistry,
): ReadonlyMap<string, TransientObject> {
	const [objects, setObjects] = useState(() => registry.getAll());

	const update = useCallback(() => {
		// Create a new Map reference so React detects the change
		setObjects(new Map(registry.getAll()));
	}, [registry]);

	useEffect(() => {
		update();
		return registry.subscribe(update);
	}, [registry, update]);

	return objects;
}
