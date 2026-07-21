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

export function createYouTubePlayer(iframe: HTMLIFrameElement): EmbedPlayer {
	let playing = false;
	let time = 0;
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
		if (typeof info.currentTime === "number") time = info.currentTime;
		if (typeof info.playerState === "number") {
			const wasPlaying = playing;
			playing = info.playerState === PLAYING;
			reported = true;
			// A state flip we didn't initiate = a user action → notify sync layer.
			if (info.playerState === PLAYING || info.playerState === PAUSED) {
				if (wasPlaying !== playing && now() > suppressUntil) userCb?.();
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
