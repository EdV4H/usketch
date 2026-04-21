import type { AppInstance } from "@edv4h/usketch-core";
import { useEffect } from "react";

/**
 * ツールショートカットとキーボードショートカットのハンドリングを統一するhook。
 * app.tsx と community.tsx で共通利用。
 * `disabled=true` でショートカット全般を停止 (例: 発表モード中)。
 */
export function useKeyboardShortcuts(app: AppInstance | null, disabled = false) {
	useEffect(() => {
		if (!app || disabled) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			const tag = (e.target as HTMLElement)?.tagName;
			const isInput =
				tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;

			// Escape はテキスト入力中でも通す（入力欄からblurしてツールをselectに戻す）
			if (e.key === "Escape" && isInput) {
				(e.target as HTMLElement)?.blur();
				app.shortcuts.handleKeyDown(e);
				return;
			}

			// テキスト入力中はそれ以外のショートカットを無視
			if (isInput) {
				return;
			}
			const tools = app.tools.getAll();
			for (const [id, def] of tools) {
				if (
					def.shortcut &&
					e.key.toLowerCase() === def.shortcut.toLowerCase() &&
					!e.ctrlKey &&
					!e.metaKey &&
					!e.altKey
				) {
					app.store.setActiveToolId(id);
					return;
				}
			}
			app.shortcuts.handleKeyDown(e);
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [app, disabled]);
}
