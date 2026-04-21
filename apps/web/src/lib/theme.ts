/**
 * Theme management — light / dark / system の 3 モードを管理する。
 *
 * - localStorage キー `usketch-theme` に永続化
 * - "system" モードは OS の `prefers-color-scheme` を解決して追従
 * - `data-theme` 属性を `<html>` に書き込む（tokens.css の変数がスコープされる）
 *
 * 初回 flash 防止のため、HTML の `<head>` 内で同名ロジックをインライン実行して
 * React 起動前に属性を設定する。この TS モジュールは runtime 変更・購読用。
 */

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "usketch-theme";

const listeners = new Set<(theme: Theme, resolved: ResolvedTheme) => void>();
let currentTheme: Theme = "system";
let mediaQuery: MediaQueryList | null = null;
let mediaListener: ((e: MediaQueryListEvent) => void) | null = null;

function isTheme(value: unknown): value is Theme {
	return value === "light" || value === "dark" || value === "system";
}

function readStoredTheme(): Theme {
	try {
		const stored = localStorage.getItem(THEME_STORAGE_KEY);
		if (isTheme(stored)) return stored;
	} catch {
		// localStorage が使えない環境はフォールスルー
	}
	return "system";
}

function resolveSystem(): ResolvedTheme {
	if (typeof window === "undefined") return "dark";
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(theme: Theme): ResolvedTheme {
	return theme === "system" ? resolveSystem() : theme;
}

export function getInitialTheme(): Theme {
	return readStoredTheme();
}

export function getCurrentTheme(): Theme {
	return currentTheme;
}

function apply(theme: Theme): void {
	const resolved = resolveTheme(theme);
	document.documentElement.dataset.theme = resolved;
	for (const l of listeners) l(theme, resolved);
}

function ensureSystemListener(active: boolean): void {
	if (typeof window === "undefined") return;
	if (active && !mediaListener) {
		mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		mediaListener = () => {
			if (currentTheme === "system") apply("system");
		};
		mediaQuery.addEventListener("change", mediaListener);
	} else if (!active && mediaListener && mediaQuery) {
		mediaQuery.removeEventListener("change", mediaListener);
		mediaListener = null;
		mediaQuery = null;
	}
}

export function setTheme(theme: Theme): void {
	currentTheme = theme;
	try {
		localStorage.setItem(THEME_STORAGE_KEY, theme);
	} catch {
		// localStorage が使えない環境は無視
	}
	ensureSystemListener(theme === "system");
	apply(theme);
}

export function subscribeTheme(
	listener: (theme: Theme, resolved: ResolvedTheme) => void,
): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/** アプリ起動時に 1 回だけ呼ぶ。localStorage から現在テーマを復元してリスナーを繋ぐ。 */
export function initTheme(): void {
	currentTheme = readStoredTheme();
	ensureSystemListener(currentTheme === "system");
	apply(currentTheme);
}
