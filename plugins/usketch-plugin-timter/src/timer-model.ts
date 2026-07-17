/**
 * Timer domain model — pure, framework-free, and time-source agnostic (every
 * function takes an explicit `serverNow` so the same logic runs against the
 * shared server clock). New timer types are added by extending {@link TimerType}
 * and adding one entry to {@link TIMER_KINDS}; the transitions below stay
 * type-agnostic.
 */

export type TimerType = "countdown" | "stopwatch";

export interface TimerEntry {
	id: string;
	type: TimerType;
	label?: string;
	running: boolean;
	/** Server-epoch ms: countdown → endsAt while running; stopwatch → startedAt while running. Null when paused. */
	anchorAt: number | null;
	/** Paused snapshot: countdown → remaining ms; stopwatch → elapsed ms. */
	accumMs: number;
	/** Configured length (countdown); 0 for stopwatch. */
	durationMs: number;
	createdBy: string;
	updatedBy: string;
	/** Server-epoch ms of the last mutation. */
	updatedAt: number;
}

interface TimerKind {
	/** ms to display (countdown: remaining clamped ≥0; stopwatch: elapsed). */
	displayMs(entry: TimerEntry, serverNow: number): number;
	/** Whether the timer has completed (countdown hit 0). */
	isDone(entry: TimerEntry, serverNow: number): boolean;
	/** anchorAt/accumMs when (re)starting. */
	onStart(entry: TimerEntry, serverNow: number): Pick<TimerEntry, "anchorAt" | "accumMs">;
	/** anchorAt/accumMs when pausing. */
	onPause(entry: TimerEntry, serverNow: number): Pick<TimerEntry, "anchorAt" | "accumMs">;
	/** Fresh (stopped) anchorAt/accumMs/durationMs for a given configured duration. */
	initial(durationMs: number): Pick<TimerEntry, "anchorAt" | "accumMs" | "durationMs">;
}

export const TIMER_KINDS: Record<TimerType, TimerKind> = {
	countdown: {
		displayMs: (e, now) => (e.running ? Math.max(0, (e.anchorAt ?? now) - now) : e.accumMs),
		isDone: (e, now) => (e.running ? (e.anchorAt ?? now) - now <= 0 : e.accumMs <= 0),
		onStart: (e, now) => ({ anchorAt: now + e.accumMs, accumMs: e.accumMs }),
		onPause: (e, now) => ({ anchorAt: null, accumMs: Math.max(0, (e.anchorAt ?? now) - now) }),
		initial: (d) => ({ anchorAt: null, accumMs: d, durationMs: d }),
	},
	stopwatch: {
		displayMs: (e, now) => (e.running ? now - (e.anchorAt ?? now) + e.accumMs : e.accumMs),
		isDone: () => false,
		onStart: (e, now) => ({ anchorAt: now, accumMs: e.accumMs }),
		onPause: (e, now) => ({ anchorAt: null, accumMs: now - (e.anchorAt ?? now) + e.accumMs }),
		initial: () => ({ anchorAt: null, accumMs: 0, durationMs: 0 }),
	},
};

export function displayMs(entry: TimerEntry, serverNow: number): number {
	return TIMER_KINDS[entry.type].displayMs(entry, serverNow);
}

export function isDone(entry: TimerEntry, serverNow: number): boolean {
	return TIMER_KINDS[entry.type].isDone(entry, serverNow);
}

export interface CreateTimerInput {
	id: string;
	type: TimerType;
	durationMs?: number;
	label?: string;
	userId: string;
	serverNow: number;
}

export function createTimer(input: CreateTimerInput): TimerEntry {
	const { id, type, durationMs = 0, label, userId, serverNow } = input;
	return {
		id,
		type,
		label,
		running: false,
		...TIMER_KINDS[type].initial(durationMs),
		createdBy: userId,
		updatedBy: userId,
		updatedAt: serverNow,
	};
}

/** Start or resume. No-op (returns the same entry) if already running. */
export function start(entry: TimerEntry, serverNow: number, userId: string): TimerEntry {
	if (entry.running) return entry;
	return {
		...entry,
		...TIMER_KINDS[entry.type].onStart(entry, serverNow),
		running: true,
		updatedBy: userId,
		updatedAt: serverNow,
	};
}

/** Pause, snapshotting remaining/elapsed. No-op if already paused. */
export function pause(entry: TimerEntry, serverNow: number, userId: string): TimerEntry {
	if (!entry.running) return entry;
	return {
		...entry,
		...TIMER_KINDS[entry.type].onPause(entry, serverNow),
		running: false,
		updatedBy: userId,
		updatedAt: serverNow,
	};
}

/** Return to the stopped, initial state for the timer's configured duration. */
export function reset(entry: TimerEntry, serverNow: number, userId: string): TimerEntry {
	return {
		...entry,
		...TIMER_KINDS[entry.type].initial(entry.durationMs),
		running: false,
		updatedBy: userId,
		updatedAt: serverNow,
	};
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
