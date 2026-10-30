// React side of `planChunks`: remembers the chunks drawn last render and re-renders on
// the next frame while chunks about to come into view are still being built ahead.
import { useEffect, useRef, useState } from "react";
import { type ChunkRange, planChunks } from "./chunk-plan.js";

export interface ChunkRanges {
	need: ChunkRange;
	soon: ChunkRange;
	keep: ChunkRange;
}

/** The chunk keys to draw this render (see `planChunks`); none while `ranges` is null. */
export function useChunkPlan(ranges: ChunkRanges | null, budget: number): readonly string[] {
	const drawn = useRef<readonly string[]>([]);
	const [, force] = useState(0);
	let pending = false;
	if (ranges) {
		const plan = planChunks(drawn.current, ranges.need, ranges.soon, ranges.keep, budget);
		drawn.current = plan.chunks;
		pending = plan.pending;
	} else {
		drawn.current = [];
	}
	useEffect(() => {
		if (!pending) return;
		const id = requestAnimationFrame(() => force((n) => n + 1));
		return () => cancelAnimationFrame(id);
	});
	return drawn.current;
}
