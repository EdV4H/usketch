/**
 * Controls ドックの表示設定（セクションの開閉 + ピン留め）。プラグインが
 * 増えるとセクションを全展開した縦スクロールが長くなりすぎるため、
 * プラグインセクションは既定で畳み、ユーザーが開いた/ピンしたものだけを
 * localStorage に覚えて次回も再現する。
 */
export interface DockPrefs {
	/** 開いているセクションのキー。 */
	readonly open: readonly string[];
	/** ピン留めされたプラグインの id（ピンした順）。 */
	readonly pinned: readonly string[];
}

/** 保存値がないときの初期状態。組み込みの Tools セクションだけ開いておく。 */
export const DEFAULT_DOCK_PREFS: DockPrefs = { open: ["@tools"], pinned: [] };

export function isOpen(prefs: DockPrefs, key: string): boolean {
	return prefs.open.includes(key);
}

export function isPinned(prefs: DockPrefs, pluginId: string): boolean {
	return prefs.pinned.includes(pluginId);
}

export function toggleOpen(prefs: DockPrefs, key: string): DockPrefs {
	return isOpen(prefs, key)
		? { ...prefs, open: prefs.open.filter((k) => k !== key) }
		: { ...prefs, open: [...prefs.open, key] };
}

/** ピンを付け外しする。ピンした直後に中身が見えるよう、ピン時は開いた状態にする。 */
export function togglePinned(prefs: DockPrefs, pluginId: string): DockPrefs {
	if (isPinned(prefs, pluginId)) {
		return { ...prefs, pinned: prefs.pinned.filter((id) => id !== pluginId) };
	}
	return {
		open: isOpen(prefs, pluginId) ? prefs.open : [...prefs.open, pluginId],
		pinned: [...prefs.pinned, pluginId],
	};
}

/** 指定キーのセクションをすべて畳む（ピンは保持）。 */
export function collapseAll(prefs: DockPrefs, keys: readonly string[]): DockPrefs {
	const drop = new Set(keys);
	return { ...prefs, open: prefs.open.filter((k) => !drop.has(k)) };
}

/** localStorage から読んだ未検証の値を DockPrefs に正規化する。 */
export function parseDockPrefs(raw: string | null): DockPrefs {
	if (!raw) return DEFAULT_DOCK_PREFS;
	try {
		const v = JSON.parse(raw) as unknown;
		if (v == null || typeof v !== "object") return DEFAULT_DOCK_PREFS;
		const obj = v as Record<string, unknown>;
		const strings = (x: unknown) =>
			Array.isArray(x) ? [...new Set(x.filter((s): s is string => typeof s === "string"))] : [];
		return { open: strings(obj.open), pinned: strings(obj.pinned) };
	} catch {
		return DEFAULT_DOCK_PREFS;
	}
}

export interface DockPrefsStore {
	get(): DockPrefs;
	update(fn: (prefs: DockPrefs) => DockPrefs): void;
	subscribe(listener: () => void): () => void;
}

export function createDockPrefsStore(storageKey: string): DockPrefsStore {
	let value = (() => {
		try {
			return parseDockPrefs(localStorage.getItem(storageKey));
		} catch {
			return DEFAULT_DOCK_PREFS;
		}
	})();
	const listeners = new Set<() => void>();

	return {
		get: () => value,
		update: (fn) => {
			const next = fn(value);
			if (next === value) return;
			value = next;
			try {
				localStorage.setItem(storageKey, JSON.stringify(next));
			} catch {
				// localStorage unavailable (private mode, SSR) — keep in-memory state.
			}
			for (const listener of listeners) listener();
		},
		subscribe: (listener) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}
