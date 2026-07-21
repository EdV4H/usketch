/**
 * Minimal YouTube IFrame player controller over `postMessage` (no YT SDK). The
 * embed URL must carry `enablejsapi=1`. We (re)send the `listening` handshake so
 * the player pushes `infoDelivery` events (playerState + currentTime) back to
 * us, and expose play/pause/seek plus a user-action callback for the watch-party
 * sync layer. Messages are pinned to the iframe's origin in both directions.
 */

export interface EmbedPlayer {
	play(): void;
	pause(): void;
	seek(seconds: number): void;
	/** Latest known {playing, time}; null until the player reports. */
	getState(): { playing: boolean; time: number } | null;
	/** Fires when the *user* (not a programmatic apply) plays/pauses/seeks. */
	onUserAction(cb: () => void): void;
	destroy(): void;
}

// YT.PlayerState
const PLAYING = 1;
const PAUSED = 2;
// A currentTime report this far off the projected position = a seek (not normal
// playback progression / a paused hold).
const SEEK_JUMP_S = 1.0;

export function createYouTubePlayer(iframe: HTMLIFrameElement): EmbedPlayer {
	let playing = false;
	let time = 0;
	let timeAt = 0; // wall-clock ms when `time` was last observed (0 = never)
	let reported = false;
	let userCb: (() => void) | null = null;
	// Suppress the user-action callback for state changes we caused ourselves.
	let suppressUntil = 0;
	const now = () => Date.now();

	// Pin postMessage to the iframe's origin (e.g. https://www.youtube-nocookie.com)
	// rather than "*", so control messages can't leak to — and spoofed messages
	// can't arrive from — a frame navigated to a different origin.
	let targetOrigin = "*";
	try {
		if (iframe.src) targetOrigin = new URL(iframe.src).origin;
	} catch {
		// keep "*"
	}

	const post = (func: string, args: unknown[] = []) => {
		iframe.contentWindow?.postMessage(
			JSON.stringify({ event: "command", func, args }),
			targetOrigin,
		);
	};

	// Ask the player to start emitting events to us.
	const startListening = () => {
		iframe.contentWindow?.postMessage(
			JSON.stringify({ event: "listening", id: iframe.id }),
			targetOrigin,
		);
	};

	const onMessage = (e: MessageEvent) => {
		if (!iframe.contentWindow || e.source !== iframe.contentWindow) return;
		// Also validate the origin (when known) so a cross-origin frame reusing the
		// same window can't spoof YouTube protocol messages.
		if (targetOrigin !== "*" && e.origin !== targetOrigin) return;
		let data: unknown;
		try {
			data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
		} catch {
			return;
		}
		const msg = data as { event?: string; info?: unknown };
		const info = (msg.info ?? {}) as { playerState?: number; currentTime?: number };
		const t = now();
		if (typeof info.currentTime === "number") {
			// Seek detection: a currentTime that jumped away from where normal
			// playback (or a paused hold) would have taken us = a user seek. This
			// catches seeks that don't flip playerState (e.g. scrubbing while playing).
			// Skipped for our own programmatic seeks (suppress window) and the 1st report.
			if (timeAt !== 0 && t > suppressUntil) {
				const projected = playing ? time + (t - timeAt) / 1000 : time;
				if (Math.abs(info.currentTime - projected) > SEEK_JUMP_S) userCb?.();
			}
			time = info.currentTime;
			timeAt = t;
		}
		if (typeof info.playerState === "number") {
			reported = true;
			// Only stable PLAYING/PAUSED update `playing` and emit — transient states
			// (BUFFERING/CUED/ENDED) would flip `playing` and look like a spurious
			// user play/pause when it settles back.
			if (info.playerState === PLAYING || info.playerState === PAUSED) {
				const next = info.playerState === PLAYING;
				const wasPlaying = playing;
				playing = next;
				if (wasPlaying !== next && t > suppressUntil) userCb?.();
			}
		}
	};
	window.addEventListener("message", onMessage);

	// Kick off listening + poll time (YT pushes onStateChange but time needs polling).
	const onLoad = () => startListening();
	iframe.addEventListener("load", onLoad);
	startListening();
	const poll = setInterval(() => {
		startListening();
	}, 1000);

	return {
		play() {
			suppressUntil = now() + 400;
			post("playVideo");
		},
		pause() {
			suppressUntil = now() + 400;
			post("pauseVideo");
		},
		seek(seconds: number) {
			suppressUntil = now() + 400;
			post("seekTo", [Math.max(0, seconds), true]);
		},
		getState: () => (reported ? { playing, time } : null),
		onUserAction(cb) {
			userCb = cb;
		},
		destroy() {
			clearInterval(poll);
			window.removeEventListener("message", onMessage);
			iframe.removeEventListener("load", onLoad);
			userCb = null;
		},
	};
}
