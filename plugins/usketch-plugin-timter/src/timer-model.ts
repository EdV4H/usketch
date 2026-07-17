/**
 * Timer domain model — pure, framework-free, time-source agnostic (every
 * function takes an explicit `serverNow` so the same logic runs against the
 * shared server clock). The core timing state ({@link TimerCore}) is deliberately
 * envelope-free so it can be embedded both in the collaborative `timters` map
 * (as {@link TimerEntry}) and in a canvas timer shape. New timer types are added
 * by extending {@link TimerType} + one {@link TIMER_KINDS} entry; the transitions
 * stay type-agnostic.
 */

export type TimerType = "countdown" | "stopwatch";

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

interface TimerKind {
	displayMs(c: TimerCore, serverNow: number): number;
	isDone(c: TimerCore, serverNow: number): boolean;
	onStart(c: TimerCore, serverNow: number): Pick<TimerCore, "anchorAt" | "accumMs">;
	onPause(c: TimerCore, serverNow: number): Pick<TimerCore, "anchorAt" | "accumMs">;
	initial(durationMs: number): Pick<TimerCore, "anchorAt" | "accumMs" | "durationMs">;
}

export const TIMER_KINDS: Record<TimerType, TimerKind> = {
	countdown: {
		displayMs: (c, now) => (c.running ? Math.max(0, (c.anchorAt ?? now) - now) : c.accumMs),
		isDone: (c, now) => (c.running ? (c.anchorAt ?? now) - now <= 0 : c.accumMs <= 0),
		onStart: (c, now) => ({ anchorAt: now + c.accumMs, accumMs: c.accumMs }),
		onPause: (c, now) => ({ anchorAt: null, accumMs: Math.max(0, (c.anchorAt ?? now) - now) }),
		initial: (d) => ({ anchorAt: null, accumMs: d, durationMs: d }),
	},
	stopwatch: {
		displayMs: (c, now) => (c.running ? now - (c.anchorAt ?? now) + c.accumMs : c.accumMs),
		isDone: () => false,
		onStart: (c, now) => ({ anchorAt: now, accumMs: c.accumMs }),
		onPause: (c, now) => ({ anchorAt: null, accumMs: now - (c.anchorAt ?? now) + c.accumMs }),
		initial: () => ({ anchorAt: null, accumMs: 0, durationMs: 0 }),
	},
};

/** Fresh, stopped core for a type + configured duration. */
export function initialCore(type: TimerType, durationMs: number): TimerCore {
	return { type, running: false, ...TIMER_KINDS[type].initial(durationMs) };
}

export function displayMs(c: TimerCore, serverNow: number): number {
	return TIMER_KINDS[c.type].displayMs(c, serverNow);
}

export function isDone(c: TimerCore, serverNow: number): boolean {
	return TIMER_KINDS[c.type].isDone(c, serverNow);
}

/** Start or resume. Returns the same core (no-op) if already running. */
export function start(c: TimerCore, serverNow: number): TimerCore {
	if (c.running) return c;
	return { ...c, ...TIMER_KINDS[c.type].onStart(c, serverNow), running: true };
}

/** Pause, snapshotting remaining/elapsed. No-op if already paused. */
export function pause(c: TimerCore, serverNow: number): TimerCore {
	if (!c.running) return c;
	return { ...c, ...TIMER_KINDS[c.type].onPause(c, serverNow), running: false };
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
