import {
	type CommandRegistration,
	useCommandRegistration,
	useWhiteboardCommands,
} from "@usketch/react-canvas";
import { useWhiteboardStore } from "@usketch/store";
import { useEffect, useMemo, useRef } from "react";
import { useToast } from "../contexts/toast-context";

interface InputCommandsOptions {
	onPanelToggle?: () => void;
}

// グローバルなコマンドインスタンスキャッシュ（StrictMode対策）
// storeをキーとして使用（onPanelToggleは関数なので毎回変わる）
const globalCustomCommandsCache = new Map<any, CommandRegistration>();
let commandsInstanceId = 0;

/**
 * 新しい入力システムを使用したコマンド登録
 */
export const useInputCommands = ({ onPanelToggle }: InputCommandsOptions = {}) => {
	const store = useWhiteboardStore();
	const { showToast } = useToast();
	const instanceIdRef = useRef<number | null>(null);

	// Whiteboard標準コマンドを使用
	useWhiteboardCommands();

	// カスタムコマンドの登録（グローバルキャッシュ使用）
	const customCommands = useMemo(() => {
		// 初回のみインスタンスIDを割り当て
		if (instanceIdRef.current === null) {
			instanceIdRef.current = commandsInstanceId++;
		}

		// storeをキーとして使用
		if (globalCustomCommandsCache.has(store)) {
			return globalCustomCommandsCache.get(store)!;
		}

		const newCommands: CommandRegistration = {
			keyboard: {
				// スタイルコピー・ペースト
				copyStyle: () => {
					const result = store.copyStyleFromSelection();
					if (result) {
						showToast("スタイルをコピーしました", "success");
					} else {
						showToast("形状が選択されていません", "error");
					}
					return result;
				},
				pasteStyle: () => {
					const result = store.pasteStyleToSelection();
					if (result) {
						showToast("スタイルを適用しました", "success");
					} else {
						showToast("コピーされたスタイルがありません", "error");
					}
					return result;
				},
				// プロパティパネルのトグル
				togglePropertyPanel: () => {
					onPanelToggle?.();
					return true;
				},
			},
		};

		globalCustomCommandsCache.set(store, newCommands);
		return newCommands;
	}, [store, showToast, onPanelToggle]);

	useCommandRegistration(customCommands);

	// 追加のキーボードイベント処理（入力フィールドでのショートカット無効化）
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Prevent shortcuts when typing in input fields
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
				e.stopPropagation();
			}
		};

		window.addEventListener("keydown", handleKeyDown, true);
		return () => window.removeEventListener("keydown", handleKeyDown, true);
	}, []);
};
