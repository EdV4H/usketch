import type { TransientObject, TransientRegistry } from "@edv4h/usketch-shared";
import { useCallback, useSyncExternalStore } from "react";

export function useTransientSubscribe(
	registry: TransientRegistry,
): ReadonlyMap<string, TransientObject> {
	const subscribe = useCallback(
		(onStoreChange: () => void) => registry.subscribe(onStoreChange),
		[registry],
	);
	const getSnapshot = useCallback(() => registry.getAll(), [registry]);
	return useSyncExternalStore(subscribe, getSnapshot);
}
