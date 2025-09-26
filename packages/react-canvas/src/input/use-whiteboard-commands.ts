import { useWhiteboardStore } from "@usketch/store";
import { useMemo, useRef } from "react";
import { createAppCommands } from "./app-commands";
import { createCameraCommands } from "./camera-commands";
import { type CommandRegistration, useCommandRegistration } from "./use-command-registration";

// グローバルなコマンドインスタンスキャッシュ（StrictMode対策）
const globalCommandsCache = new WeakMap<any, CommandRegistration>();

/**
 * ホワイトボード用のコマンドを一括登録するフック
 */
export function useWhiteboardCommands() {
	const store = useWhiteboardStore();

	// storeをキーとしてグローバルにコマンドをキャッシュ
	const commands = useMemo(() => {
		// すでに作成済みならそれを返す
		if (globalCommandsCache.has(store)) {
			return globalCommandsCache.get(store)!;
		}

		const cameraCommands = createCameraCommands(store);
		const appCommands = createAppCommands(store);

		const newCommands: CommandRegistration = {
			keyboard: {
				...cameraCommands.keyboard,
				...appCommands.keyboard,
			},
			mouse: cameraCommands.mouse,
			gesture: cameraCommands.gesture,
		};

		// グローバルキャッシュに保存
		globalCommandsCache.set(store, newCommands);
		return newCommands;
	}, [store]);

	// コマンドを登録
	useCommandRegistration(commands);

	return {
		store,
		commands,
	};
}
