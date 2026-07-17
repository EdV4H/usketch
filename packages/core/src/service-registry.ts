import type { ServiceRegistry } from "@edv4h/usketch-shared";

/**
 * Generic string-keyed service slot (see {@link ServiceRegistry}). The kernel
 * owns no services itself — it just holds the map so a providing plugin and its
 * consumers can rendezvous by key, independent of plugin load order.
 */
export function createServiceRegistry(): ServiceRegistry {
	const services = new Map<string, unknown>();
	return {
		provide(key, service) {
			services.set(key, service);
			// Only remove if still the same instance (a later re-provide wins).
			return () => {
				if (services.get(key) === service) services.delete(key);
			};
		},
		get<T>(key: string): T | undefined {
			return services.get(key) as T | undefined;
		},
		has(key) {
			return services.has(key);
		},
	};
}
