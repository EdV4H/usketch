import type { Transcriber, TranscriberHandlers } from "./transcriber.js";

export interface WhisperTranscriberOptions {
	/** API origin (e.g. http://localhost:8787). */
	apiUrl: string;
	boardId?: string;
	extraHeaders?: Record<string, string>;
	/** ISO language hint for Whisper (e.g. "ja"). Optional. */
	lang?: string;
}

/** First MediaRecorder mime type the browser actually supports, or "". */
function pickMimeType(): string {
	if (typeof MediaRecorder === "undefined") return "";
	for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]) {
		if (MediaRecorder.isTypeSupported(t)) return t;
	}
	return "";
}

/**
 * Server-side transcription via OpenAI Whisper (`POST /api/ai/transcribe`).
 * Captures the mic with `getUserMedia` + `MediaRecorder`, holding the stream for
 * the whole session (so the mic indicator stays steady, no restart flicker), and
 * on `stop()` uploads the recording once. Whisper is not streaming, so there is
 * no live interim text — the final transcript arrives after stopping. Works in
 * any browser with MediaRecorder, independent of Google's speech servers.
 */
export function createWhisperTranscriber(opts: WhisperTranscriberOptions): Transcriber {
	const canRecord =
		typeof navigator !== "undefined" &&
		!!navigator.mediaDevices?.getUserMedia &&
		typeof MediaRecorder !== "undefined";

	let recorder: MediaRecorder | null = null;
	let stream: MediaStream | null = null;
	let chunks: Blob[] = [];
	let handlers: TranscriberHandlers | null = null;

	const cleanup = () => {
		for (const track of stream?.getTracks() ?? []) track.stop();
		stream = null;
		recorder = null;
		chunks = [];
	};

	const upload = async (blob: Blob) => {
		const h = handlers;
		if (!blob.size || !h) {
			h?.onEnd();
			return;
		}
		try {
			const base = opts.apiUrl.replace(/\/+$/, "");
			const url = new URL(`${base}/api/ai/transcribe`);
			if (opts.boardId) url.searchParams.set("boardId", opts.boardId);
			if (opts.lang) url.searchParams.set("lang", opts.lang);
			const res = await fetch(url.toString(), {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": blob.type || "audio/webm", ...(opts.extraHeaders ?? {}) },
				body: blob,
			});
			if (!res.ok) {
				h.onError(`transcribe failed (${res.status})`);
			} else {
				const data = (await res.json()) as { text?: string };
				const text = (data.text ?? "").trim();
				if (text) h.onFinal(text);
			}
		} catch (e) {
			h.onError(e instanceof Error ? e.message : "transcribe error");
		} finally {
			h.onEnd();
		}
	};

	return {
		available: canRecord,
		start(h) {
			handlers = h;
			if (!canRecord) {
				h.onError("MediaRecorder not supported");
				h.onEnd();
				return;
			}
			const mimeType = pickMimeType();
			navigator.mediaDevices
				.getUserMedia({ audio: true })
				.then((s) => {
					stream = s;
					chunks = [];
					recorder = new MediaRecorder(s, mimeType ? { mimeType } : undefined);
					recorder.ondataavailable = (e) => {
						if (e.data.size > 0) chunks.push(e.data);
					};
					recorder.onstop = () => {
						const type = recorder?.mimeType || mimeType || "audio/webm";
						const blob = new Blob(chunks, { type });
						cleanup();
						void upload(blob);
					};
					recorder.start();
				})
				.catch((e) => {
					// Permission denied / no device → surface like the Web Speech path.
					const name = e instanceof Error ? e.name : "";
					h.onError(name === "NotAllowedError" ? "not-allowed" : "audio-capture");
					cleanup();
					h.onEnd();
				});
		},
		stop() {
			// Triggers recorder.onstop → upload → onFinal/onEnd.
			if (recorder && recorder.state !== "inactive") recorder.stop();
			else {
				cleanup();
				handlers?.onEnd();
			}
		},
	};
}
