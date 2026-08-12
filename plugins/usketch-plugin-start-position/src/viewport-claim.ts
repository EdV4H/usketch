// A tiny, loosely-coupled protocol so multiple plugins can move the camera on
// load without fighting. A plugin that will control the load-time camera emits a
// `viewport:claimed` with a priority; others watching defer to any higher claim.
// The only shared surface is the event name + payload shape — no imports between
// plugins, so a third camera plugin can join by picking a priority.
//
// Priorities (higher wins): an explicit deep link the user opened is the most
// specific intent, so deep-link claims 100; a board's default start is a weaker
// preference, so start-position claims 10.
import type { EventBus } from "@edv4h/usketch-shared";

export const VIEWPORT_CLAIMED = "viewport:claimed";

export interface ViewportClaim {
	/** Who is taking the camera (e.g. "deep-link", "start-position"). */
	source: string;
	/** Higher wins. */
	priority: number;
}

export const DEEP_LINK_PRIORITY = 100;
export const START_POSITION_PRIORITY = 10;

/** Announce that `source` is taking the load-time camera at `priority`. */
export function claimViewport(events: EventBus, source: string, priority: number): void {
	events.emit(VIEWPORT_CLAIMED, { source, priority } satisfies ViewportClaim);
}

export interface ClaimGuard {
	/** True if another source claimed a priority >= yours ⇒ you should defer. */
	shouldYield(): boolean;
	dispose(): void;
}

/**
 * Watch for competing viewport claims. Track the highest priority claimed by any
 * OTHER source; call {@link ClaimGuard.shouldYield} right before your own camera
 * move. Your own claims (matching `mySource`) are ignored so emitting one doesn't
 * make you yield to yourself.
 */
export function watchViewportClaims(
	events: EventBus,
	mySource: string,
	myPriority: number,
): ClaimGuard {
	let maxOther = Number.NEGATIVE_INFINITY;
	const off = events.on<ViewportClaim>(VIEWPORT_CLAIMED, (c) => {
		if (c && c.source !== mySource && typeof c.priority === "number") {
			maxOther = Math.max(maxOther, c.priority);
		}
	});
	return {
		shouldYield: () => maxOther >= myPriority,
		dispose: off,
	};
}
