export interface MarqueeRect {
	x: number; // world-space
	y: number;
	width: number;
	height: number;
}

export type MarqueeMode = "intersect" | "contain";

interface MarqueeState {
	rect: MarqueeRect | null;
	hitIds: readonly string[];
	mode: MarqueeMode;
}

let current: MarqueeState = { rect: null, hitIds: [], mode: "intersect" };
const listeners: Set<() => void> = new Set();

function notify() {
	for (const fn of listeners) fn();
}

export function setMarquee(rect: MarqueeRect | null, hitIds?: readonly string[]): void {
	current = { ...current, rect, hitIds: hitIds ?? [] };
	notify();
}

export function setMarqueeMode(mode: MarqueeMode): void {
	if (current.mode === mode) return;
	current = { ...current, mode };
	notify();
}

export function getMarqueeMode(): MarqueeMode {
	return current.mode;
}

export function subscribeMarquee(cb: () => void): () => void {
	listeners.add(cb);
	return () => listeners.delete(cb);
}

export function getMarqueeRect(): MarqueeRect | null {
	return current.rect;
}

export function getMarqueeHitIds(): readonly string[] {
	return current.hitIds;
}

export function clearMarqueeListeners(): void {
	listeners.clear();
}
