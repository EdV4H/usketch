// Which world chunks a terrain layer draws. Each chunk is built and memoized on its
// own, so walking across a chunk edge adds the chunks that come into view instead of
// rebuilding the whole drawn area; chunks about to come into view are built ahead, a
// few per frame, so the edge is usually ready before it is reached. Pure.

/** An inclusive range of chunk indices. */
export interface ChunkRange {
	cx0: number;
	cx1: number;
	cy0: number;
	cy1: number;
}

export function chunkKey(cx: number, cy: number): string {
	return `${cx},${cy}`;
}

export function parseChunkKey(key: string): [number, number] {
	const i = key.indexOf(",");
	return [Number(key.slice(0, i)), Number(key.slice(i + 1))];
}

/**
 * The chunks (side `size`, world units) that `rect` grown by `grow` on every side
 * overlaps. Edges are exclusive, so a rect ending on a chunk edge doesn't reach the
 * next chunk. Null when the rect is unknown.
 */
export function chunkRange(
	rect: DOMRectReadOnly | null | undefined,
	size: number,
	grow = 0,
): ChunkRange | null {
	if (!rect) return null;
	return {
		cx0: Math.floor((rect.left - grow) / size),
		cx1: Math.ceil((rect.right + grow) / size) - 1,
		cy0: Math.floor((rect.top - grow) / size),
		cy1: Math.ceil((rect.bottom + grow) / size) - 1,
	};
}

export function inChunkRange(r: ChunkRange, cx: number, cy: number): boolean {
	return cx >= r.cx0 && cx <= r.cx1 && cy >= r.cy0 && cy <= r.cy1;
}

export interface ChunkPlan {
	/** Chunk keys to draw, in draw order. */
	chunks: readonly string[];
	/** Chunks in `soon` were left out for budget: plan again on the next frame. */
	pending: boolean;
}

/**
 * The next chunks to draw, from the ones drawn last time (`prev`):
 *   - every chunk in `need` (on screen) is drawn right away;
 *   - chunks in `soon` (about to come on screen) are added at most `budget` per call;
 *   - drawn chunks outside `keep` are dropped (inside it they stay, so walking back and
 *     forth over an edge doesn't rebuild them).
 * Kept chunks keep their order and new ones go at the end, so no existing chunk moves
 * in the DOM. `prev` itself comes back when nothing changes.
 */
export function planChunks(
	prev: readonly string[],
	need: ChunkRange,
	soon: ChunkRange,
	keep: ChunkRange,
	budget: number,
): ChunkPlan {
	const kept = prev.filter((key) => {
		const [cx, cy] = parseChunkKey(key);
		return inChunkRange(keep, cx, cy) || inChunkRange(need, cx, cy);
	});
	const have = new Set(kept);
	const added: string[] = [];
	for (let cy = need.cy0; cy <= need.cy1; cy++) {
		for (let cx = need.cx0; cx <= need.cx1; cx++) {
			const key = chunkKey(cx, cy);
			if (!have.has(key)) {
				have.add(key);
				added.push(key);
			}
		}
	}
	let left = budget;
	let pending = false;
	for (let cy = soon.cy0; cy <= soon.cy1; cy++) {
		for (let cx = soon.cx0; cx <= soon.cx1; cx++) {
			const key = chunkKey(cx, cy);
			if (have.has(key)) continue;
			if (left <= 0) {
				pending = true;
				continue;
			}
			left--;
			have.add(key);
			added.push(key);
		}
	}
	if (added.length === 0 && kept.length === prev.length) return { chunks: prev, pending };
	return { chunks: [...kept, ...added], pending };
}
