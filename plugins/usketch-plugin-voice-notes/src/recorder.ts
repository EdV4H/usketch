import type { Transcriber } from "./transcriber.js";

export interface RecorderHandlers {
	/** Live partial text (Web Speech only; Whisper has none). */
	onInterim?(text: string): void;
	onError(msg: string): void;
	/** Recording ended normally with the accumulated transcript (may be ""). */
	onDone(transcript: string): void;
}

/**
 * Single shared microphone owner for the whole plugin. All voice entry points
 * (Control-HUD toggle, the voice-frame shape, the voice-pin) go through one
 * Recorder so only ONE recording can run at a time — `start()` returns false if
 * something else already holds the mic. `busyId` names the current owner so a
 * shape/pin renderer can tell "am I the one recording".
 */
export interface Recorder {
	readonly available: boolean;
	readonly busyId: string | null;
	/** Begin recording for `id`. Returns false if the mic is already in use. */
	start(id: string, handlers: RecorderHandlers): boolean;
	/** Stop the recording owned by `id` (no-op otherwise). */
	stop(id: string): void;
	teardown(): void;
}

export function createRecorder(makeTranscriber: () => Transcriber): Recorder {
	const transcriber = makeTranscriber();
	let busyId: string | null = null;
	let segments: string[] = [];
	let active = false;

	return {
		get available() {
			return transcriber.available;
		},
		get busyId() {
			return busyId;
		},
		start(id, h) {
			if (busyId) return false; // one mic at a time
			busyId = id;
			segments = [];
			active = true;
			transcriber.start({
				onInterim: (t) => h.onInterim?.(t),
				onFinal: (t) => {
					if (t) segments.push(t);
				},
				onError: (msg) => {
					active = false;
					busyId = null;
					h.onError(msg);
				},
				onEnd: () => {
					// Only the healthy path delivers a transcript; an error already
					// cleared `active` and reported itself.
					if (active) {
						active = false;
						busyId = null;
						h.onDone(segments.join("\n").trim());
					}
				},
			});
			return true;
		},
		stop(id) {
			if (busyId === id) transcriber.stop();
		},
		teardown() {
			if (busyId) transcriber.stop();
			busyId = null;
			active = false;
		},
	};
}
