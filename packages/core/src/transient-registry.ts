import type { TransientObject, TransientRegistry, TransientRenderer } from "@usketch/shared";

export function createTransientRegistry(): TransientRegistry {
	const types = new Map<string, TransientRenderer>();
	const objects = new Map<string, TransientObject>();
	const timers = new Map<string, ReturnType<typeof setTimeout>>();

	function scheduleExpiry(obj: TransientObject) {
		if (obj.ttl != null) {
			const elapsed = Date.now() - obj.createdAt;
			const remaining = Math.max(0, obj.ttl - elapsed);
			const timer = setTimeout(() => {
				objects.delete(obj.id);
				timers.delete(obj.id);
			}, remaining);
			timers.set(obj.id, timer);
		}
	}

	return {
		registerType(type: string, renderer: TransientRenderer): void {
			types.set(type, renderer);
		},

		emit(obj: TransientObject): void {
			const existing = timers.get(obj.id);
			if (existing) clearTimeout(existing);
			objects.set(obj.id, obj);
			scheduleExpiry(obj);
		},

		dismiss(id: string): void {
			objects.delete(id);
			const timer = timers.get(id);
			if (timer) {
				clearTimeout(timer);
				timers.delete(id);
			}
		},

		getAll(): ReadonlyMap<string, TransientObject> {
			return objects;
		},
	};
}
