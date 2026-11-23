import {
	type BoardStore,
	isReadOnly,
	isToolUsable,
	PERMISSIONS,
	type Permission,
	type PermissionProvider,
	type ToolRegistry,
} from "@edv4h/usketch-shared";

/** `base` と同じだが `denied` だけは常に不可（`createApp({ readOnly: true })` で使う）。 */
export function denyPermission(base: PermissionProvider, denied: Permission): PermissionProvider {
	return {
		can: (permission, resource) => (permission === denied ? false : base.can(permission, resource)),
		subscribe: (listener) => base.subscribe(listener),
	};
}

/**
 * ストアの読み取り専用を権限（`page.edit`）に合わせ、権限が変わったら追う。プラグインの setup より
 * 前に呼ぶ（見るだけの人のページで setup が書くものも止まる）。外すとストアを元に戻す。
 */
export function bindReadOnlyToPermissions(
	store: BoardStore,
	permissions: PermissionProvider,
): () => void {
	const before = isReadOnly(store);
	const apply = () => store.setReadOnly?.(!permissions.can(PERMISSIONS.pageEdit));
	apply();
	const off = permissions.subscribe(apply);
	return () => {
		off();
		store.setReadOnly?.(before);
	};
}

/** 読み取り専用のときに、今のツールの代わりに使うもの（既定のツール → select → 並びの最初）。 */
export function fallbackTool(store: BoardStore, tools: ToolRegistry): string | null {
	const candidates = [store.getDefaultToolId(), "select"];
	for (const id of candidates) {
		if (isToolUsable(store, tools.get(id))) return id;
	}
	for (const { id, definition } of tools.getOrdered()) {
		if (isToolUsable(store, definition)) return id;
	}
	return null;
}

/**
 * 読み取り専用のあいだは、使えないツール（`readOnlySafe` でないもの）に切り替わったら
 * すぐ使えるものへ戻す。ストアの変更の通知の中で戻すので、使えないツールの画面は出ない。
 */
export function keepToolUsable(store: BoardStore, tools: ToolRegistry): () => void {
	const check = () => {
		if (!isReadOnly(store)) return;
		const active = tools.get(store.getActiveToolId());
		// 登録されていないツール（まだ読み込み中など）はそのまま。
		if (!active || isToolUsable(store, active)) return;
		const next = fallbackTool(store, tools);
		if (next) store.setActiveToolId(next);
	};
	check();
	return store.onMutation((event) => {
		if (event.type === "tool:changed" || event.type === "read-only:changed") check();
	});
}
