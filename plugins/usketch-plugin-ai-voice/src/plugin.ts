import type { AiRequestEvent } from "@edv4h/usketch-plugin-ai-agent";
import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import type { VoiceOptions, VoiceStatusEvent } from "./types.js";
import { createVoiceIndicator } from "./voice-indicator.js";

export function createAiVoicePlugin(options: VoiceOptions): UsketchPlugin {
	let cleanup: (() => void) | undefined;

	return {
		id: "usketch-plugin-ai-voice",
		name: "AI Voice",

		setup(ctx: PluginContext) {
			// biome-ignore lint/suspicious/noExplicitAny: Web Speech API is not in all TS DOM libs
			const SpeechRecognitionCtor: any =
				(globalThis as any).SpeechRecognition || (globalThis as any).webkitSpeechRecognition;

			if (!SpeechRecognitionCtor) {
				// Browser doesn't support Speech API - plugin is a no-op
				cleanup = () => {};
				return;
			}

			// biome-ignore lint/suspicious/noExplicitAny: Web Speech API types may not be available
			let recognition: any = null;
			let isListening = false;
			let hasResult = false;

			const indicator = createVoiceIndicator(ctx.events);

			function emitStatus(status: VoiceStatusEvent): void {
				ctx.events.emit("voice:status", status);
			}

			function startListening(): void {
				if (isListening) {
					stopListening();
					return;
				}

				hasResult = false;
				recognition = new SpeechRecognitionCtor();
				recognition.lang = options.lang ?? "ja-JP";
				recognition.interimResults = false;
				recognition.continuous = false;
				recognition.maxAlternatives = 1;

				// biome-ignore lint/suspicious/noExplicitAny: Web Speech API types
				recognition.onresult = (event: any) => {
					const transcript = event.results[0]?.[0]?.transcript;
					if (transcript) {
						hasResult = true;
						emitStatus({ status: "processing", transcript });
						ctx.events.emit<AiRequestEvent>("ai:request", {
							prompt: transcript,
							boardId: options.boardId,
						});
						emitStatus({ status: "done", transcript });
					}
				};

				// biome-ignore lint/suspicious/noExplicitAny: Web Speech API types
				recognition.onerror = (event: any) => {
					emitStatus({ status: "error", message: event.error });
					isListening = false;
				};

				recognition.onend = () => {
					isListening = false;
					if (!hasResult) {
						emitStatus({ status: "done" });
					}
				};

				recognition.start();
				isListening = true;
				emitStatus({ status: "listening" });
			}

			function stopListening(): void {
				if (recognition) {
					recognition.abort();
					recognition = null;
				}
				isListening = false;
				emitStatus({ status: "done" });
			}

			// Listen for toggle event from toolbar
			const unsubToggle = ctx.events.on("voice:toggle", () => {
				startListening();
			});

			cleanup = () => {
				stopListening();
				unsubToggle();
				indicator.destroy();
			};
		},

		teardown() {
			cleanup?.();
		},
	};
}
