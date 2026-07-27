// Map-generation UI state (algorithm / seed / params / drag-preview), shared
// between the palette and the map tool. Module-scoped, app-local (not synced).
import { useSyncExternalStore } from "react";
import type { CellBox } from "./autotile.js";
import { defaultParams, GENERATORS } from "./generators/index.js";
import { createReactiveStore } from "./reactive-store.js";

/** A drag-preview rectangle in WORLD coordinates (null when not dragging). */
export interface WorldRect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface GenState {
	algorithmId: string;
	seed: number;
	params: Record<string, number>;
	/** Live drag rectangle for the range-select preview. */
	pendingRect: WorldRect | null;
	/** Last box generated into, for the "再生成" (regenerate) button. */
	lastBox: CellBox | null;
}

export const genStateStore = createReactiveStore<GenState>({
	algorithmId: GENERATORS[0].id,
	seed: 12345,
	params: defaultParams(GENERATORS[0]),
	pendingRect: null,
	lastBox: null,
});

export function useGenState(): GenState {
	return useSyncExternalStore(genStateStore.subscribe, genStateStore.get, genStateStore.get);
}
