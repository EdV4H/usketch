import type { BoardStore } from "@edv4h/usketch-shared";
import { useCallback, useSyncExternalStore } from "react";

export function useStoreSubscribe<T>(store: BoardStore, selector: (store: BoardStore) => T): T {
	const subscribe = useCallback(
		(onStoreChange: () => void) => store.subscribe(onStoreChange),
		[store],
	);
	const getSnapshot = useCallback(() => selector(store), [store, selector]);
	return useSyncExternalStore(subscribe, getSnapshot);
}
