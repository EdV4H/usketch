// Helper for the "spawn & scatter" flow: build brand-new scatter items by CLONING
// the seed shape (its type / size / style / intrinsic fields). A quick way to fling
// out N fresh copies of the selected shape, exercising the `new`-item path.
import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import type { ScatterItem } from "./types.js";

/** `count` new-shape specs cloning the seed (minus id/position/parent). Empty when
 *  the seed is missing or `count <= 0`. */
export function cloneSeedItems(store: BoardStore, seedId: string, count: number): ScatterItem[] {
	const seed = store.getShape(seedId);
	const n = Math.max(0, Math.floor(count));
	if (!seed || n === 0) return [];
	// Drop the seed's identity/position/parent AND store-managed fields (createdAt /
	// updatedAt / zIndex) so each spawned shape gets fresh values from the store
	// instead of sharing the seed's timestamp + z-order key.
	const {
		id: _id,
		x: _x,
		y: _y,
		parentId: _p,
		createdAt: _c,
		updatedAt: _u,
		zIndex: _z,
		...rest
	} = seed as ShapeData & {
		parentId?: string;
		createdAt?: unknown;
		updatedAt?: unknown;
		zIndex?: unknown;
	};
	const items: ScatterItem[] = [];
	for (let i = 0; i < n; i++) {
		items.push({
			kind: "new",
			spec: {
				...(rest as Record<string, unknown>),
				type: seed.type,
				width: seed.width,
				height: seed.height,
			},
		});
	}
	return items;
}
