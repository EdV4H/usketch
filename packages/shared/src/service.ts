import type { ServiceRegistry } from "./types/plugin.js";

/**
 * A typed handle to a plugin-provided service (the `ctx.services` IoC seam). Pairs
 * a string `key` with typed `provide`/`get` so a provider and its consumers can't
 * drift on the key or the type, and so the SAME accessor works for both a plugin's
 * `ctx.services` and the host's `app.services` — they are the same registry object.
 *
 * This is the sanctioned way for a plugin to expose a **host-facing operation API**
 * without going through the Control HUD: author the operations as plain functions,
 * bundle them into an API object, `provide` it under a `ServiceHandle` in `setup`,
 * and let hosts reach it via `handle.get(app.services)`. The plugin being absent is
 * a first-class case — `get` returns `undefined`. See docs/plugin-system-design.md.
 */
export interface ServiceHandle<T> {
	/** The registry key. Namespace it (e.g. the plugin id) to avoid collisions. */
	readonly key: string;
	/** Provide the service — call once in the plugin's `setup`. Returns an unprovide fn. */
	provide(services: ServiceRegistry, api: T): () => void;
	/** The provided service, or `undefined` when the providing plugin is absent. */
	get(services: ServiceRegistry): T | undefined;
	/** Whether the service is currently provided. */
	has(services: ServiceRegistry): boolean;
}

/**
 * Define a typed {@link ServiceHandle}. `key` should be namespaced — the plugin id
 * is the natural choice (e.g. `"usketch-plugin-map"`).
 */
export function defineService<T>(key: string): ServiceHandle<T> {
	return {
		key,
		provide: (services, api) => services.provide<T>(key, api),
		get: (services) => services.get<T>(key),
		has: (services) => services.has(key),
	};
}
