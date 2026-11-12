import type { AppInstance } from "@edv4h/usketch-core";
import { useEffect } from "react";

/**
 * ツールショートカットとキーボードショートカット（どちらも app.keymap に登録済み）を
 * 処理するhook。
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
			// ツールのショートカット（ToolDefinition.shortcut）もキーマップに入っているので、
			// 同じキーの重なりは keymap が when / priority / プラグイン順で 1 つに決める。
			app.shortcuts.handleKeyDown(e);
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [app, disabled]);
}
