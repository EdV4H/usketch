import type { EventBus } from "@edv4h/usketch-shared";

export function createEventBus(): EventBus {
	const listeners = new Map<string, Set<(data: unknown) => void>>();
	// Ref-counted so independent callers can nest pause/resume without one
	// accidentally re-enabling delivery for the other.
	let pauseDepth = 0;

	return {
		on<T = unknown>(event: string, handler: (data: T) => void): () => void {
			if (!listeners.has(event)) {
				listeners.set(event, new Set());
			}
			// biome-ignore lint/style/noNonNullAssertion: guaranteed by has() check above
			const handlers = listeners.get(event)!;
			handlers.add(handler as (data: unknown) => void);
			return () => {
				handlers.delete(handler as (data: unknown) => void);
			};
		},

		emit<T = unknown>(event: string, data: T): void {
			if (pauseDepth > 0) return;
			const handlers = listeners.get(event);
			if (handlers) {
				for (const handler of handlers) {
					handler(data);
				}
			}
		},

		pause(): void {
			pauseDepth++;
		},

		resume(): void {
			if (pauseDepth === 0) {
				console.warn("[EventBus] resume() called without a matching pause(); ignoring.");
				return;
			}
			pauseDepth--;
		},

		isPaused(): boolean {
			return pauseDepth > 0;
		},
	};
}
