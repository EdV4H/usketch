// The yaw turns the viewport, not the tilted layers. Turning the board by the yaw about
// the tilt's pivot (the horizon point) before tilting draws the same picture as spinning
// the tilted plane by it, and then the viewport is the one place that says which way the
// board faces: pointer math, shaders and layers that aren't tilted all agree with it.
//
// Mode 7 turns the viewport by `yaw × amount` (so it turns in with the transition) and
// remembers how far it has turned it, so that the view turns back by exactly that much
// when it goes flat, whatever else turned the viewport meanwhile.
import {
	type Point,
	shortestAngleDelta,
	type Viewport,
	viewportRotation,
	wrapDeg,
} from "@edv4h/usketch-shared";

/** How far the viewport should be turned for `yaw` at transition `amount`, degrees. */
export function yawTurn(yaw: number, amount: number): number {
	const a = Math.min(1, Math.max(0, Number.isFinite(amount) ? amount : 0));
	return wrapDeg((Number.isFinite(yaw) ? yaw : 0) * a);
}

/** The point the tilt pivots about, in stage px: the middle of the horizon line. */
export function yawPivot(stage: { width: number; height: number }, horizon: number): Point {
	return { x: stage.width / 2, y: stage.height * horizon };
}

/** The viewport calls the turner needs (a `BoardStore` has them). */
export interface YawViewport {
	getViewport(): Viewport;
	rotateTo(deg: number, center: Point): void;
}

export interface YawTurner {
	/**
	 * Turn the viewport to `yawTurn(yaw, amount)` (from where it was last turned), about
	 * `pivot()` (read only when it has to turn; `null` = no stage yet, try again later).
	 */
	sync(yaw: number, amount: number, pivot: () => Point | null): void;
	/** How far the viewport is turned now, degrees. */
	applied(): number;
	/** Turn the viewport back by what was applied. */
	restore(pivot: () => Point | null): void;
}

export function createYawTurner(viewport: YawViewport): YawTurner {
	let applied = 0;
	const turnBy = (delta: number, pivot: Point): void => {
		const from = viewportRotation(viewport.getViewport());
		viewport.rotateTo(from + delta, pivot);
	};
	return {
		sync(yaw, amount, pivot) {
			const want = yawTurn(yaw, amount);
			const delta = shortestAngleDelta(applied, want);
			if (Math.abs(delta) < 1e-9) return;
			const at = pivot();
			if (!at) return;
			applied = want;
			turnBy(delta, at);
		},
		applied: () => applied,
		restore(pivot) {
			if (Math.abs(applied) < 1e-9) return;
			const at = pivot();
			if (!at) return;
			const delta = -applied;
			applied = 0;
			turnBy(delta, at);
		},
	};
}
