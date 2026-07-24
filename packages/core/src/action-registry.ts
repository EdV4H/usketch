import type { ActionRegistry, PluginAction } from "@edv4h/usketch-shared";

/**
 * Concrete registry type: the public {@link ActionRegistry} plus an internal
 * `registerFor` used by the app to stamp the owning plugin id (see `createApp`'s
 * per-plugin scoped context). Not part of the shared interface.
 */
export interface InternalActionRegistry extends ActionRegistry {
	registerFor(pluginId: string | undefined, action: PluginAction): () => void;
}

/**
 * Registry of declarative, invokable plugin operations ({@link PluginAction}).
 * Mirrors the tool registry's enumerable shape and adds `subscribe` so a generic
 * control surface (the Debug/Control HUD) can re-render when plugins register or
 * unregister actions. Insertion order is preserved for stable sorting.
 */
export function createActionRegistry(): InternalActionRegistry {
	const actions = new Map<string, PluginAction>();
	const pluginOf = new Map<string, string | undefined>();
	const order: string[] = [];
	const listeners = new Set<() => void>();

	function notify() {
		for (const fn of listeners) fn();
	}

	function unregister(id: string): void {
		if (!actions.delete(id)) return;
		pluginOf.delete(id);
		const i = order.indexOf(id);
		if (i >= 0) order.splice(i, 1);
		notify();
	}

	function registerFor(pluginId: string | undefined, action: PluginAction) {
		if (!actions.has(action.id)) order.push(action.id);
		actions.set(action.id, action);
		pluginOf.set(action.id, pluginId);
		notify();
		// Guard: only remove if THIS registration is still current, so a stale
		// unsubscribe can't clobber a re-registration under the same id.
		return () => {
			if (actions.get(action.id) === action) unregister(action.id);
		};
	}

	return {
		registerFor,
		register: (action) => registerFor(undefined, action),
		unregister,
		get: (id) => actions.get(id),
		// 内部 Map をそのまま返すと、ReadonlyMap 型でも実行時に型アサーションで
		// 直接 mutate され register/unregister（と notify）を迂回されうる。防御的にコピーを返す。
		getAll: () => new Map(actions),
		getOrdered() {
			// Sort by group (undefined last), then action.order, then registration order.
			const indexed = order.map((id, i) => ({ id, i }));
			indexed.sort((a, b) => {
				const aa = actions.get(a.id);
				const bb = actions.get(b.id);
				if (!aa || !bb) return 0;
				const ga = aa.group ?? "￿";
				const gb = bb.group ?? "￿";
				if (ga !== gb) return ga < gb ? -1 : 1;
				const oa = aa.order ?? 0;
				const ob = bb.order ?? 0;
				if (oa !== ob) return oa - ob;
				return a.i - b.i;
			});
			return indexed.map(({ id }) => ({
				id,
				pluginId: pluginOf.get(id),
				action: actions.get(id) as PluginAction,
			}));
		},
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}
