import type { ServerEventBus } from "./plugin.js";

export function createServerEventBus(): ServerEventBus {
	const listeners = new Map<string, Set<(data: unknown) => void>>();

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
			const handlers = listeners.get(event);
			if (handlers) {
				for (const handler of handlers) {
					try {
						handler(data);
					} catch (error) {
						console.error("Error in server event handler for event", event, error);
					}
				}
			}
		},
	};
}
