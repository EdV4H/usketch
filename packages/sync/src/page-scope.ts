import type { Awareness } from "y-protocols/awareness";
import type { WsProviderHandle } from "./ws-provider.js";

/** awareness のローカル状態で、今いるページを置くフィールド。 */
export const PAGE_AWARENESS_FIELD = "page";
/** ブロードキャストに付ける送り主のページ。 */
export const PAGE_BROADCAST_FIELD = "__page";

type AwarenessChanges = { added: number[]; updated: number[]; removed: number[] };
type AwarenessHandler = (changes: AwarenessChanges, origin: unknown) => void;

/** 同じページだけが見える awareness。`dispose()` で元の awareness から外れる。 */
export type PageScopedAwareness = Awareness & { dispose(): void };

/**
 * 同じページにいる人だけが見える awareness を作る。元の awareness を prototype にした
 * 薄い包みで、`getStates()` と `change` / `update` イベントを今のページに絞る。
 * 自分の状態は常に見える。ローカル状態を丸ごと差し替えても `page` は残す。
 */
export function createPageScopedAwareness(
	awareness: Awareness,
	pageId: string,
): PageScopedAwareness {
	const inScope = (clientId: number, state: Record<string, unknown> | undefined): boolean =>
		clientId === awareness.clientID || state?.[PAGE_AWARENESS_FIELD] === pageId;

	const visibleIds = (): Set<number> => {
		const ids = new Set<number>();
		for (const [clientId, state] of awareness.getStates()) {
			if (inScope(clientId, state)) ids.add(clientId);
		}
		return ids;
	};

	// イベント名ごとに元の awareness へ 1 つだけ listener を付け、ページに絞った差分を配る。
	const channels = new Map<
		string,
		{ handlers: Set<AwarenessHandler>; raw: AwarenessHandler; prev: Set<number> }
	>();

	function channel(name: string) {
		const ch = channels.get(name);
		if (ch) return ch;
		const handlers = new Set<AwarenessHandler>();
		const created = {
			handlers,
			prev: visibleIds(),
			raw: ({ added, updated, removed }: AwarenessChanges, origin: unknown) => {
				const next = visibleIds();
				const out: AwarenessChanges = { added: [], updated: [], removed: [] };
				for (const id of new Set([...added, ...updated, ...removed])) {
					const was = created.prev.has(id);
					const is = next.has(id);
					if (!was && is) out.added.push(id);
					else if (was && is) out.updated.push(id);
					else if (was && !is) out.removed.push(id);
				}
				created.prev = next;
				if (out.added.length + out.updated.length + out.removed.length === 0) return;
				for (const handler of [...handlers]) handler(out, origin);
			},
		};
		channels.set(name, created);
		return created;
	}

	const scoped = Object.create(awareness) as PageScopedAwareness;
	Object.defineProperties(scoped, {
		getStates: {
			value: () => {
				const states = new Map<number, Record<string, unknown>>();
				for (const [clientId, state] of awareness.getStates()) {
					if (inScope(clientId, state)) states.set(clientId, state);
				}
				return states;
			},
		},
		setLocalState: {
			value: (state: Record<string, unknown> | null) => {
				awareness.setLocalState(
					state && !(PAGE_AWARENESS_FIELD in state)
						? { ...state, [PAGE_AWARENESS_FIELD]: pageId }
						: state,
				);
			},
		},
		on: {
			value: (name: string, handler: AwarenessHandler) => {
				if (name !== "change" && name !== "update") {
					awareness.on(name as "change", handler);
					return;
				}
				const ch = channel(name);
				if (ch.handlers.size === 0) {
					ch.prev = visibleIds();
					awareness.on(name, ch.raw);
				}
				ch.handlers.add(handler);
			},
		},
		off: {
			value: (name: string, handler: AwarenessHandler) => {
				if (name !== "change" && name !== "update") {
					awareness.off(name as "change", handler);
					return;
				}
				const ch = channels.get(name);
				if (!ch?.handlers.delete(handler)) return;
				if (ch.handlers.size === 0) awareness.off(name, ch.raw);
			},
		},
		// 元の awareness はボード単位の持ち物なので、包みからは壊さない。
		destroy: { value: () => scoped.dispose() },
		dispose: {
			value: () => {
				for (const [name, ch] of channels) {
					if (ch.handlers.size > 0) awareness.off(name as "change", ch.raw);
					ch.handlers.clear();
				}
				channels.clear();
			},
		},
	});
	return scoped;
}

/** 同じページだけに絞った provider。`dispose()` で元の provider から外れる（元は壊さない）。 */
export type PageScopedProvider = WsProviderHandle & { dispose(): void };

/**
 * プラグインに渡す「今のページ用」の provider を作る。
 *
 * - 自分の awareness に `page` を書き、`awareness` は同じページの人だけを見せる
 * - `broadcast` に送り主のページを付け、`onBroadcast` は同じページ（とページを付けない
 *   古いクライアント）からのものだけを届ける
 * - それ以外（ページ doc の購読、セッション、接続状態など）は元の provider のまま
 *
 * ページを切り替えるときは古い包みを `dispose()` して、新しいページで作り直す。
 */
export function createPageScopedProvider(
	provider: WsProviderHandle,
	pageId: string,
): PageScopedProvider {
	provider.awareness.setLocalStateField(PAGE_AWARENESS_FIELD, pageId);
	const awareness = createPageScopedAwareness(provider.awareness, pageId);
	const offs = new Set<() => void>();

	const scoped = Object.create(provider) as PageScopedProvider;
	Object.defineProperties(scoped, {
		awareness: { value: awareness },
		broadcast: {
			value: (msg: Record<string, unknown>) =>
				provider.broadcast({ ...msg, [PAGE_BROADCAST_FIELD]: pageId }),
		},
		onBroadcast: {
			value: (handler: (msg: Record<string, unknown>) => void) => {
				const off = provider.onBroadcast((msg) => {
					const from = msg[PAGE_BROADCAST_FIELD];
					if (from === undefined || from === pageId) handler(msg);
				});
				offs.add(off);
				return () => {
					offs.delete(off);
					off();
				};
			},
		},
		destroy: { value: () => scoped.dispose() },
		dispose: {
			value: () => {
				awareness.dispose();
				for (const off of offs) off();
				offs.clear();
			},
		},
	});
	return scoped;
}
