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
export function createWebSpeechTranscriber(opts: { lang?: string } = {}): Transcriber {
	const Ctor = getSpeechRecognitionCtor();
	let recognition: AnySpeechRecognition = null;
	let stopping = false;

	return {
		available: Ctor != null,
		start(handlers) {
			if (!Ctor) {
				handlers.onError("Web Speech API not supported");
				handlers.onEnd();
				return;
			}
			stopping = false;
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
					if (res.isFinal) handlers.onFinal(text.trim());
					else interim += text;
				}
				if (interim) handlers.onInterim(interim.trim());
			};
			// biome-ignore lint/suspicious/noExplicitAny: Web Speech API event
			recognition.onerror = (event: any) => {
				// "no-speech"/"aborted" are benign stop signals, not user-facing errors.
				if (event.error !== "no-speech" && event.error !== "aborted") {
					handlers.onError(String(event.error));
				}
			};
			recognition.onend = () => {
				// Chrome ends recognition after a pause; keep listening until the user
				// explicitly stops (auto-restart), then surface the single onEnd.
				if (!stopping && recognition) {
					try {
						recognition.start();
						return;
					} catch {
						// fallthrough to end
					}
				}
				handlers.onEnd();
			};
			recognition.start();
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
