// 図形の永久削除（`store.removeShapePermanently`）を Y.Doc で共有する。
//
// 記録は Y.Doc の別マップ（既定 `permanentlyRemovedShapes`）に id → true で持ち、クライアントからは
// 消さない。消すと、相手の古い更新や Yjs の Undo で図形が戻ってきたときに止められなくなるため。
import { applyExternal, type BoardStore } from "@edv4h/usketch-shared";
import type * as Y from "yjs";

/** 永久削除した id を記録する Y.Map のキー。 */
export const DEFAULT_PERMANENT_REMOVALS_MAP_KEY = "permanentlyRemovedShapes";

/**
 * {@link bindPermanentRemovals} が Y.Doc に書くトランザクションの origin。Yjs の UndoManager を
 * 使うホストは、これを `trackedOrigins` に入れなければ、記録や消し直しが Undo に積まれない。
 */
export const PERMANENT_REMOVAL_ORIGIN: symbol = Symbol("usketch:permanent-removal");

export interface BindPermanentRemovalsOptions {
	/** 図形の Y.Map のキー（既定 `"shapes"`）。 */
	shapesMapKey?: string;
	/** 記録の Y.Map のキー（既定 {@link DEFAULT_PERMANENT_REMOVALS_MAP_KEY}）。 */
	removalsMapKey?: string;
}

/**
 * store と Y.Doc の間で永久削除の記録をつなぐ。戻り値で外す。
 *
 * 1. 最初に記録マップを読み、store に記録する（後から入った人・再読込）
 * 2. store で永久削除されたら、1 つのトランザクションで記録マップに id を入れ `shapes` から消す
 * 3. 相手が記録した id を store から消す
 * 4. `shapes` に記録済みの id が戻ってきたら（相手の古い更新、相手の Yjs Undo）消し直す
 *
 * 3 と 4 は Y.Doc の observer より前（`beforeObserverCalls`）に行うので、同期プラグインの observer が
 * 同じトランザクションの `shapes` の変更を store に流す時点で、その id はもう記録済みになっている。
 * 同期プラグインを作る前（最初の読み込みより前）に呼ぶと、記録済みの図形が一度も store に入らない。
 *
 * 同期プラグインは `permanent: true` の `shape:removed` で自分では `shapes.delete` しないこと
 * （2 が {@link PERMANENT_REMOVAL_ORIGIN} で消す）。
 *
 * `removeShapePermanently` を持たない古い store では何もしない。
 */
export function bindPermanentRemovals(
	store: BoardStore,
	doc: Y.Doc,
	opts: BindPermanentRemovalsOptions = {},
): () => void {
	if (!store.removeShapePermanently) return () => {};
	const shapesMap = doc.getMap<unknown>(opts.shapesMapKey ?? "shapes");
	const removalsMap = doc.getMap<boolean>(
		opts.removalsMapKey ?? DEFAULT_PERMANENT_REMOVALS_MAP_KEY,
	);
	// 記録マップから store に入れている最中。そのとき出る `shape:removed` は Y.Doc に書き戻さない。
	let applying = false;
	let unbound = false;

	/** 記録マップにある id を、まだ記録していない store に記録する。 */
	function recordInStore(ids: Iterable<string>): void {
		const fresh = [...ids].filter((id) => !store.isPermanentlyRemoved?.(id));
		if (fresh.length === 0) return;
		applying = true;
		try {
			applyExternal(store, () => {
				for (const id of fresh) store.removeShapePermanently?.(id);
			});
		} finally {
			applying = false;
		}
	}

	/** 記録済みなのに `shapes` に残っている id を消す。 */
	function purgeShapes(ids: Iterable<string>): void {
		const stale = [...ids].filter((id) => removalsMap.has(id) && shapesMap.has(id));
		if (stale.length === 0) return;
		doc.transact(() => {
			for (const id of stale) shapesMap.delete(id);
		}, PERMANENT_REMOVAL_ORIGIN);
	}

	// 1. 最初の読み込み
	recordInStore(removalsMap.keys());
	purgeShapes(removalsMap.keys());

	// 2. store → Y.Doc
	const unsubMutation = store.onMutation((event) => {
		if (applying || unbound) return;
		if (event.type !== "shape:removed" || !event.payload.permanent) return;
		const ids = event.payload.ids;
		doc.transact(() => {
			for (const id of ids) {
				if (!removalsMap.has(id)) removalsMap.set(id, true);
				if (shapesMap.has(id)) shapesMap.delete(id);
			}
		}, PERMANENT_REMOVAL_ORIGIN);
	});

	// 3 + 4. Y.Doc → store / 消し直し
	const beforeObserverCalls = (transaction: Y.Transaction): void => {
		if (unbound || transaction.origin === PERMANENT_REMOVAL_ORIGIN) return;
		let recorded: Set<string | null> | undefined;
		let shapeKeys: Set<string | null> | undefined;
		for (const [type, keys] of transaction.changed) {
			const changedType: unknown = type;
			if (changedType === removalsMap) recorded = keys;
			else if (changedType === shapesMap) shapeKeys = keys;
		}
		if (!recorded && !shapeKeys) return;
		const newlyRecorded: string[] = [];
		for (const key of recorded ?? []) {
			if (key !== null && removalsMap.has(key)) newlyRecorded.push(key);
		}
		recordInStore(newlyRecorded);
		// Observer の前なので、ここでの `doc.transact` はこのトランザクションの後に回される。
		const candidates = new Set(newlyRecorded);
		for (const key of shapeKeys ?? []) {
			if (key !== null) candidates.add(key);
		}
		purgeShapes(candidates);
	};
	doc.on("beforeObserverCalls", beforeObserverCalls);

	return () => {
		if (unbound) return;
		unbound = true;
		unsubMutation();
		doc.off("beforeObserverCalls", beforeObserverCalls);
	};
}
