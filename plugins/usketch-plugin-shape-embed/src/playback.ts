import type { PlaybackState } from "./types.js";

/** Drift threshold (s): re-seek the local player only past this to avoid churn. */
export const DRIFT_THRESHOLD_S = 0.7;

/**
 * Project the expected playhead position (s) for a synced playback state at a
 * given server-clock time. While playing, the head advances from `time` by the
 * elapsed wall time since `at`; while paused it's frozen at `time`.
 */
export function projectTime(state: PlaybackState, serverNowMs: number): number {
	if (!state.playing) return Math.max(0, state.time);
	const elapsed = (serverNowMs - state.at) / 1000;
	return Math.max(0, state.time + elapsed);
}

/**
 * Whether the local player (at `localTime`, `localPlaying`) needs correcting to
 * match the synced state — a play/pause mismatch, or a position drift past the
 * threshold.
 */
export function needsCorrection(
	state: PlaybackState,
	serverNowMs: number,
	local: { playing: boolean; time: number },
): boolean {
	if (state.playing !== local.playing) return true;
	return Math.abs(projectTime(state, serverNowMs) - local.time) > DRIFT_THRESHOLD_S;
}

/** Build a fresh playback state from a local player action. */
export function playbackFrom(
	local: { playing: boolean; time: number },
	serverNowMs: number,
	userId: string,
): PlaybackState {
	return {
		playing: local.playing,
		time: Math.max(0, local.time),
		at: serverNowMs,
		updatedBy: userId,
	};
}
