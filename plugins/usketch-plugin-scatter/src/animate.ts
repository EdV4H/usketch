// Optional per-shape fly-out tween. No built-in shape animation exists in the
// engine, so this is a bespoke rAF loop writing x/y via updateShape. These are RAW
// writes (not commands) — the scatter command re-asserts the final state once at
// the end for a single undo step. Falls back to instant (resolve immediately) when
// there's no rAF or the user prefers reduced motion.
import type { BoardStore, Point } from "@edv4h/usketch-shared";

export interface TweenTarget {
	id: string;
	from: Point;
	to: Point;
}

/** ease-in-out-cubic — the same feel as the store's viewport animation. */
export function easeInOutCubic(t: number): number {
	return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function prefersReducedMotion(): boolean {
	return (
		typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches
	);
}

export function animatePositions(
	store: BoardStore,
	targets: TweenTarget[],
	opts: { durationMs: number; easing: (t: number) => number },
): Promise<void> {
	const raf = typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame : null;
	if (!raf || opts.durationMs <= 0 || targets.length === 0 || prefersReducedMotion()) {
		return Promise.resolve();
	}
	const now = () => (typeof performance !== "undefined" ? performance.now() : 0);
	const start = now();
	return new Promise<void>((resolve) => {
		const step = () => {
			const t = Math.min(1, (now() - start) / opts.durationMs);
			const e = opts.easing(t);
			for (const tg of targets) {
				store.updateShape(tg.id, {
					x: tg.from.x + (tg.to.x - tg.from.x) * e,
					y: tg.from.y + (tg.to.y - tg.from.y) * e,
				});
			}
			if (t < 1) raf(step);
			else resolve();
		};
		raf(step);
	});
}
