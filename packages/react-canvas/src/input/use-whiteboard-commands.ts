import { useWhiteboardStore } from "@usketch/store";
import { useMemo } from "react";
import { createAppCommands } from "./app-commands";
import { createCameraCommands } from "./camera-commands";
import { type CommandRegistration, useCommandRegistration } from "./use-command-registration";

/**
 * ホワイトボード用のコマンドを一括登録するフック
 */
export function useWhiteboardCommands() {
	const store = useWhiteboardStore();

	// コマンドハンドラーを生成
	const commands: CommandRegistration = useMemo(() => {
		const cameraCommands = createCameraCommands(store);
		const appCommands = createAppCommands(store);

		return {
			keyboard: {
				...cameraCommands.keyboard,
				...appCommands.keyboard,
			},
			mouse: cameraCommands.mouse,
			gesture: cameraCommands.gesture,
		};
	}, [store]);

	// コマンドを登録
	useCommandRegistration(commands);

	return {
		store,
		commands,
	};
}
