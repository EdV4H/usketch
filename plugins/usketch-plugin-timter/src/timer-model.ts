/**
 * Timer domain model — pure, framework-free, time-source agnostic (every
 * function takes an explicit `serverNow` so the same logic runs against the
 * shared server clock). The core timing state ({@link TimerCore}) is deliberately
 * envelope-free so it can be embedded both in the collaborative `timters` map
 * (as {@link TimerEntry}) and in a canvas timer shape.
 *
 * New timer types are added by registering one {@link TimerKind} via
 * {@link registerTimerKind} (hosts can add e.g. a `pomodoro` kind); the
 * transitions ({@link start} / {@link pause} / {@link reset}) stay type-agnostic
 * and dispatch through the kind registry. `"countdown"` and `"stopwatch"` are
 * built in.
 */

/**
 * A timer kind's id. The two built-ins are named for autocomplete; the
 * `(string & {})` arm keeps any host-registered kind assignable while still
 * suggesting the built-ins. Register new ids with {@link registerTimerKind}.
 */
export type TimerType = "countdown" | "stopwatch" | (string & {});

/** The minimal timing state shared by every timer representation. */
export interface TimerCore {
	type: TimerType;
	running: boolean;
	/** Server-epoch ms: countdown → endsAt while running; stopwatch → startedAt while running. Null when paused. */
	anchorAt: number | null;
	/** Paused snapshot: countdown → remaining ms; stopwatch → elapsed ms. */
	accumMs: number;
	/** Configured length (countdown); 0 for stopwatch. */
	durationMs: number;
}

/**
 * The behavior of one timer kind. Register a custom kind (e.g. `pomodoro`) with
 * {@link registerTimerKind}; the model's transitions and the shape renderer then
 * treat it like a built-in. All methods are pure — timing flows through the
 * explicit `serverNow`, never `Date.now()`.
 */
export interface TimerKind {
	/** Optional glyph used by the built-in shape renderer / Controls dock. */
	icon?: string;
	displayMs(c: TimerCore, serverNow: number): number;
	isDone(c: TimerCore, serverNow: number): boolean;
	onStart(c: TimerCore, serverNow: number): Pick<TimerCore, "anchorAt" | "accumMs">;
	onPause(c: TimerCore, serverNow: number): Pick<TimerCore, "anchorAt" | "accumMs">;
	initial(durationMs: number): Pick<TimerCore, "anchorAt" | "accumMs" | "durationMs">;
}

/**
 * The kind registry. Built-ins are seeded here; hosts extend it via
 * {@link registerTimerKind}. Read via {@link getTimerKind} / {@link timerTypes}
 * (this record is the live registry — treat it as read-only and mutate only
 * through `registerTimerKind`).
 */
export const TIMER_KINDS: Record<string, TimerKind> = {
	countdown: {
		icon: "⏳",
		displayMs: (c, now) => (c.running ? Math.max(0, (c.anchorAt ?? now) - now) : c.accumMs),
		isDone: (c, now) => (c.running ? (c.anchorAt ?? now) - now <= 0 : c.accumMs <= 0),
		onStart: (c, now) => ({ anchorAt: now + c.accumMs, accumMs: c.accumMs }),
		onPause: (c, now) => ({ anchorAt: null, accumMs: Math.max(0, (c.anchorAt ?? now) - now) }),
		initial: (d) => ({ anchorAt: null, accumMs: d, durationMs: d }),
	},
	stopwatch: {
		icon: "⏱",
		displayMs: (c, now) => (c.running ? now - (c.anchorAt ?? now) + c.accumMs : c.accumMs),
		isDone: () => false,
		onStart: (c, now) => ({ anchorAt: now, accumMs: c.accumMs }),
		onPause: (c, now) => ({ anchorAt: null, accumMs: now - (c.anchorAt ?? now) + c.accumMs }),
		initial: () => ({ anchorAt: null, accumMs: 0, durationMs: 0 }),
	},
};

/**
 * Register (or replace) a timer kind so custom types behave like the built-ins.
 * Call once at startup, before any timer of that type is created. Example:
 *
 * ```ts
 * registerTimerKind("pomodoro", {
 *   // 25-min work block — behaves like a countdown
 *   ...TIMER_KINDS.countdown,
 *   icon: "🍅",
 *   initial: () => ({ anchorAt: null, accumMs: 25 * 60_000, durationMs: 25 * 60_000 }),
 * });
 * ```
 */
export function registerTimerKind(type: string, kind: TimerKind): void {
	TIMER_KINDS[type] = kind;
}

/**
 * The registered kind for `type`. **Throws** if the kind was never registered —
 * the strict getter, for callers that control the type and want to fail loudly
 * on a typo. Rendering / display of *synced* shape data (whose `timerType` is
 * untrusted — stale documents, remote updates for a kind this client never
 * registered) must use {@link resolveTimerKind} instead so a bad value can't
 * crash the render tree.
 */
export function getTimerKind(type: TimerType): TimerKind {
	const kind = TIMER_KINDS[type];
	if (!kind)
		throw new Error(`[timter] unknown timer type "${type}" (register it with registerTimerKind)`);
	return kind;
}

/**
 * A safe, inert kind used for unregistered types: the displayed time stays frozen
 * at the stored `accumMs` and it is never "done" (start/pause still flip the
 * `running` flag but leave `anchorAt`/`accumMs` untouched, so the reading doesn't
 * move). Keeps a malformed or unknown `timerType` from throwing mid-render.
 */
const FALLBACK_KIND: TimerKind = {
	icon: "⏱",
	displayMs: (c) => c.accumMs,
	isDone: () => false,
	onStart: (c) => ({ anchorAt: c.anchorAt, accumMs: c.accumMs }),
	onPause: (c) => ({ anchorAt: c.anchorAt, accumMs: c.accumMs }),
	initial: (d) => ({ anchorAt: null, accumMs: d, durationMs: d }),
};

/**
 * Like {@link getTimerKind} but **never throws** — returns {@link FALLBACK_KIND}
 * for an unregistered type. Use everywhere a timer's kind is resolved from
 * synced/untrusted shape data (render, LOD, Controls rebuild, transitions) so an
 * unknown kind degrades to an inert display instead of crashing the canvas.
 */
export function resolveTimerKind(type: TimerType): TimerKind {
	return TIMER_KINDS[type] ?? FALLBACK_KIND;
}

/** All registered timer-type ids, in registration order. */
export function timerTypes(): TimerType[] {
	return Object.keys(TIMER_KINDS);
}

/** Fresh, stopped core for a type + configured duration. */
export function initialCore(type: TimerType, durationMs: number): TimerCore {
	return { type, running: false, ...resolveTimerKind(type).initial(durationMs) };
}

export function displayMs(c: TimerCore, serverNow: number): number {
	return resolveTimerKind(c.type).displayMs(c, serverNow);
}

export function isDone(c: TimerCore, serverNow: number): boolean {
	return resolveTimerKind(c.type).isDone(c, serverNow);
}

/** Start or resume. Returns the same core (no-op) if already running. */
export function start(c: TimerCore, serverNow: number): TimerCore {
	if (c.running) return c;
	return { ...c, ...resolveTimerKind(c.type).onStart(c, serverNow), running: true };
}

/** Pause, snapshotting remaining/elapsed. No-op if already paused. */
export function pause(c: TimerCore, serverNow: number): TimerCore {
	if (!c.running) return c;
	return { ...c, ...resolveTimerKind(c.type).onPause(c, serverNow), running: false };
}

/** Return to the stopped, initial state for the configured duration. */
export function reset(c: TimerCore): TimerCore {
	return initialCore(c.type, c.durationMs);
}

/** Format ms as `M:SS` (or `H:MM:SS` past an hour). Negative clamps to 0. */
export function formatDuration(ms: number): string {
	const total = Math.max(0, Math.round(ms / 1000));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const ss = String(s).padStart(2, "0");
	if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${ss}`;
	return `${m}:${ss}`;
}
