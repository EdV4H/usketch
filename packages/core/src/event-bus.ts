import type { EventBus } from "@edv4h/usketch-shared";

export function createEventBus(): EventBus {
	const listeners = new Map<string, Set<(data: unknown) => void>>();
	let paused = false;

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
			if (paused) return;
			const handlers = listeners.get(event);
			if (handlers) {
				for (const handler of handlers) {
					handler(data);
				}
			}
		},

		pause(): void {
			paused = true;
		},

		resume(): void {
			paused = false;
		},

		isPaused(): boolean {
			return paused;
		},
	};
}
