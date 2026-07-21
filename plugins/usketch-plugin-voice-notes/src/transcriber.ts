/**
 * Pluggable speech-to-text. v1 ships a browser Web Speech API implementation;
 * swap in another (e.g. a server Whisper transcriber) via the plugin's
 * `createTranscriber` option without touching the orchestration.
 */
export interface TranscriberHandlers {
	/** Live (non-final) partial text for the current utterance. */
	onInterim(text: string): void;
	/** A finalized utterance segment (appended to the running transcript). */
	onFinal(text: string): void;
	onError(message: string): void;
	/** Recognition stopped (by `stop()`, end of speech, or error). */
	onEnd(): void;
}

export interface Transcriber {
	/** Whether this transcriber can run in the current environment. */
	readonly available: boolean;
	start(handlers: TranscriberHandlers): void;
	/** Finalize and stop; triggers `onEnd`. */
	stop(): void;
}

// The Web Speech API isn't in the standard TS DOM lib across all targets.
// biome-ignore lint/suspicious/noExplicitAny: Web Speech API is not fully typed
type AnySpeechRecognition = any;

function getSpeechRecognitionCtor(): AnySpeechRecognition | null {
	if (typeof globalThis === "undefined") return null;
	const g = globalThis as Record<string, unknown>;
	return (
		(g.SpeechRecognition as AnySpeechRecognition) ??
		(g.webkitSpeechRecognition as AnySpeechRecognition) ??
		null
	);
}

/**
 * Browser Web Speech API transcriber. Uses `continuous` + `interimResults` so a
 * whole talk is accumulated (final segments concatenated by the caller), unlike
 * the single-utterance `usketch-plugin-ai-voice`.
 */
// Errors we must NOT auto-restart on — restarting just makes the browser cut us
// off again in a tight loop (the flickering-mic symptom). Surface and stop.
const FATAL_ERRORS = new Set(["not-allowed", "service-not-allowed", "audio-capture", "network"]);
// If the engine ends this many times in quick succession without producing any
// speech, something is wrong (blocked network, no audio) — give up instead of
// busy-restarting.
const MAX_RAPID_RESTARTS = 3;
const RAPID_WINDOW_MS = 1500;

export function createWebSpeechTranscriber(opts: { lang?: string } = {}): Transcriber {
	const Ctor = getSpeechRecognitionCtor();
	let recognition: AnySpeechRecognition = null;
	let stopping = false;
	let fatal = false;
	let rapidRestarts = 0;
	let lastStartAt = 0;

	return {
		available: Ctor != null,
		start(handlers) {
			if (!Ctor) {
				handlers.onError("Web Speech API not supported");
				handlers.onEnd();
				return;
			}
			stopping = false;
			fatal = false;
			rapidRestarts = 0;

			const launch = () => {
				recognition = new Ctor();
				recognition.lang = opts.lang ?? "ja-JP";
				recognition.continuous = true;
				recognition.interimResults = true;
				recognition.maxAlternatives = 1;

				// biome-ignore lint/suspicious/noExplicitAny: Web Speech API event
				recognition.onresult = (event: any) => {
					let interim = "";
					for (let i = event.resultIndex; i < event.results.length; i++) {
						const res = event.results[i];
						const text = res[0]?.transcript ?? "";
						if (res.isFinal) {
							rapidRestarts = 0; // real speech → the engine is healthy
							handlers.onFinal(text.trim());
						} else {
							interim += text;
						}
					}
					if (interim) handlers.onInterim(interim.trim());
				};
				// biome-ignore lint/suspicious/noExplicitAny: Web Speech API event
				recognition.onerror = (event: any) => {
					const err = String(event.error);
					if (FATAL_ERRORS.has(err)) fatal = true; // stop the restart loop
					// "no-speech"/"aborted" are benign stop signals, not user errors.
					if (err !== "no-speech" && err !== "aborted") handlers.onError(err);
				};
				recognition.onend = () => {
					// Don't fight the browser: bail on explicit stop, fatal errors, or a
					// rapid end-without-speech loop. Otherwise resume (Chrome ends the
					// session on pauses even with continuous=true).
					const elapsed = Date.now() - lastStartAt;
					rapidRestarts = elapsed < RAPID_WINDOW_MS ? rapidRestarts + 1 : 0;
					if (stopping || fatal || rapidRestarts >= MAX_RAPID_RESTARTS) {
						recognition = null;
						handlers.onEnd();
						return;
					}
					try {
						lastStartAt = Date.now();
						recognition.start();
					} catch {
						recognition = null;
						handlers.onEnd();
					}
				};

				lastStartAt = Date.now();
				recognition.start();
			};

			launch();
		},
		stop() {
			stopping = true;
			if (recognition) {
				recognition.stop();
				recognition = null;
			}
		},
	};
}
