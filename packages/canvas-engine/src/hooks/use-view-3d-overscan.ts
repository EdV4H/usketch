import { type BoardStore, view3dCellOf, view3dOverscanPx } from "@edv4h/usketch-shared";
import { useCallback, useMemo, useSyncExternalStore } from "react";

const NOOP = (): void => {};

/**
 * How far past the stage box backgrounds should draw while the board is shown in 3D
 * (`view3dOverscanPx`), as one number: the 3D view's camera height changes every frame
 * while a character climbs, but this only re-renders when the overscan itself changes.
 * `0` on a store without a 3D view.
 */
export function useView3dOverscan(store: BoardStore, zoom: number, stageHeight: number): number {
	const cell = useMemo(() => view3dCellOf(store), [store]);
	const subscribe = useCallback(
		(listener: () => void) => (cell ? cell.subscribe(listener) : NOOP),
		[cell],
	);
	const read = (): number => (cell ? view3dOverscanPx(cell.get(), zoom, stageHeight) : 0);
	return useSyncExternalStore(subscribe, read, read);
}
