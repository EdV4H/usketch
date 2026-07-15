import type { ActionRegistry, PluginAction } from "@edv4h/usketch-shared";

/**
 * Registry of declarative, invokable plugin operations ({@link PluginAction}).
 * Mirrors the tool registry's enumerable shape and adds `subscribe` so a generic
 * control surface (the Debug/Control HUD) can re-render when plugins register or
 * unregister actions. Insertion order is preserved for stable sorting.
 */
export function createActionRegistry(): ActionRegistry {
	const actions = new Map<string, PluginAction>();
	const order: string[] = [];
	const listeners = new Set<() => void>();

	function notify() {
		for (const fn of listeners) fn();
	}

	function unregister(id: string): void {
		if (!actions.delete(id)) return;
		const i = order.indexOf(id);
		if (i >= 0) order.splice(i, 1);
		notify();
	}

	return {
		register(action: PluginAction) {
			if (!actions.has(action.id)) order.push(action.id);
			actions.set(action.id, action);
			notify();
			return () => unregister(action.id);
		},
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
			return indexed.map(({ id }) => ({ id, action: actions.get(id) as PluginAction }));
		},
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}
