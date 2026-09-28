// Animated enter/exit of the 3D view. The stored camera/look stay the TARGET; only a
// single `progress` (linear 0…1) and its eased `amount` are animated, and the runtime
// scales the rendered tilt and the sky/fog opacity by `amount`. One store update per
// frame (not one per camera/look setter), so each frame rewrites the tilt once.
//
// - enter: `active` turns on immediately, progress 0 → 1.
// - exit:  progress 1 → 0, and `active` turns off only when it reaches 0 (so the
//          capture layer keeps blocking edits until the board is flat again).
// - toggling mid-transition reverses from the CURRENT progress (no jump).
// - `prefers-reduced-motion` (or duration 0) jumps straight to the end state.
import type { Mode7Store } from "./mode7-store.js";

export type Mode7Easing =
	| "linear"
	| "ease-in"
	| "ease-out"
	| "ease-in-out"
	| ((t: number) => number);

export interface Mode7TransitionOptions {
	/** Duration of a full enter/exit in ms. `0` (default) = switch instantly unless a
	 *  call passes `{ animate: true }` (which then uses {@link DEFAULT_TRANSITION_MS}). */
	durationMs?: number;
	/** Default `"ease-in-out"`. */
	easing?: Mode7Easing;
}

/** Duration used by an explicit `{ animate: true }` when no `durationMs` is configured. */
export const DEFAULT_TRANSITION_MS = 900;

export interface Mode7SwitchOptions {
	/** Animate this switch (default: animate iff a `transition.durationMs > 0` is set). */
	animate?: boolean;
}

/** Injectable timing (tests drive frames by hand). */
export interface Mode7Clock {
	now(): number;
	requestFrame(cb: (now: number) => void): number;
	cancelFrame(id: number): void;
	prefersReducedMotion(): boolean;
}

export interface Mode7Transition {
	enable(opts?: Mode7SwitchOptions): void;
	disable(opts?: Mode7SwitchOptions): void;
	toggle(opts?: Mode7SwitchOptions): void;
	isTransitioning(): boolean;
	/** Stop any running animation, leaving the current rendered state. */
	dispose(): void;
}

const EASINGS: Record<Exclude<Mode7Easing, (t: number) => number>, (t: number) => number> = {
	linear: (t) => t,
	"ease-in": (t) => t * t * t,
	"ease-out": (t) => 1 - (1 - t) ** 3,
	"ease-in-out": (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
};

export function resolveEasing(e: Mode7Easing | undefined): (t: number) => number {
	if (typeof e === "function") return e;
	return EASINGS[e ?? "ease-in-out"] ?? EASINGS["ease-in-out"];
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function browserClock(): Mode7Clock {
	return {
		now: () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
		requestFrame: (cb) =>
			typeof requestAnimationFrame === "function"
				? requestAnimationFrame(cb)
				: (setTimeout(() => cb(Date.now()), 16) as unknown as number),
		cancelFrame: (id) => {
			if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
			else clearTimeout(id);
		},
		prefersReducedMotion: () =>
			typeof window !== "undefined" &&
			typeof window.matchMedia === "function" &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches,
	};
}

export function createMode7Transition(
	store: Mode7Store,
	options: Mode7TransitionOptions = {},
	clock: Mode7Clock = browserClock(),
): Mode7Transition {
	const configured = Math.max(0, options.durationMs ?? 0);
	const ease = resolveEasing(options.easing);
	let frame: number | null = null;
	let direction: 1 | -1 = 1;
	let last = 0;

	const stop = (): void => {
		if (frame !== null) clock.cancelFrame(frame);
		frame = null;
	};

	/** Where a switch would end up: the running direction, else the settled state. */
	const target = (): boolean => (frame !== null ? direction === 1 : store.getState().active);

	const settle = (on: boolean): void => {
		stop();
		store.setActive(on);
	};

	const step = (now: number, durationMs: number): void => {
		frame = null;
		const dt = Math.max(0, now - last);
		last = now;
		const p = clamp01(store.getState().progress + (direction * dt) / durationMs);
		const done = direction === 1 ? p >= 1 : p <= 0;
		if (done) {
			store.setPresentation({
				active: direction === 1,
				progress: direction === 1 ? 1 : 0,
				amount: direction === 1 ? 1 : 0,
				transitioning: false,
			});
			return;
		}
		store.setPresentation({ active: true, progress: p, amount: ease(p), transitioning: true });
		frame = clock.requestFrame((t) => step(t, durationMs));
	};

	const run = (on: boolean, opts: Mode7SwitchOptions | undefined): void => {
		const animate = opts?.animate ?? configured > 0;
		const durationMs = configured > 0 ? configured : DEFAULT_TRANSITION_MS;
		if (!animate || clock.prefersReducedMotion()) {
			settle(on);
			return;
		}
		const s = store.getState();
		// Already settled at the requested end → nothing to animate.
		if (frame === null && s.active === on && s.progress === (on ? 1 : 0)) return;
		direction = on ? 1 : -1;
		if (frame !== null) return; // reversing mid-flight: keep the running loop, new direction
		last = clock.now();
		// Mark the transition started (and `active` on for an enter) in the same update.
		store.setPresentation({
			active: true,
			progress: s.progress,
			amount: ease(s.progress),
			transitioning: true,
		});
		frame = clock.requestFrame((t) => step(t, durationMs));
	};

	return {
		enable: (opts) => run(true, opts),
		disable: (opts) => run(false, opts),
		toggle: (opts) => run(!target(), opts),
		isTransitioning: () => store.getState().transitioning,
		dispose: stop,
	};
}
