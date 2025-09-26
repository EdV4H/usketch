import type {
	CommandHandler,
	GestureManager,
	KeyboardManager,
	MouseManager,
} from "@usketch/input-manager";
import { useEffect } from "react";
import { useInput } from "./input-context";

export interface CommandRegistration {
	keyboard?: Record<string, CommandHandler>;
	mouse?: Record<string, CommandHandler>;
	gesture?: Record<string, CommandHandler>;
}

/**
 * コマンドハンドラーを一括登録・管理するフック
 */
export function useCommandRegistration(commands: CommandRegistration) {
	const { keyboard, mouse, gesture } = useInput();

	useEffect(() => {
		// キーボードコマンドの登録
		if (keyboard && commands.keyboard) {
			Object.entries(commands.keyboard).forEach(([command, handler]) => {
				keyboard.registerCommand(command, handler);
			});
		}

		// マウスコマンドの登録
		if (mouse && commands.mouse) {
			Object.entries(commands.mouse).forEach(([command, handler]) => {
				mouse.registerCommand(command, handler);
			});
		}

		// ジェスチャーコマンドの登録
		if (gesture && commands.gesture) {
			Object.entries(commands.gesture).forEach(([command, handler]) => {
				gesture.registerCommand(command, handler);
			});
		}

		// クリーンアップ
		return () => {
			if (keyboard && commands.keyboard) {
				Object.keys(commands.keyboard).forEach((command) => {
					keyboard.unregisterCommand(command);
				});
			}

			if (mouse && commands.mouse) {
				Object.keys(commands.mouse).forEach((command) => {
					mouse.unregisterCommand(command);
				});
			}

			if (gesture && commands.gesture) {
				Object.keys(commands.gesture).forEach((command) => {
					gesture.unregisterCommand(command);
				});
			}
		};
		// commandsを依存配列から削除し、個別のフィールドを監視
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [keyboard, mouse, gesture, commands.gesture, commands.keyboard, commands.mouse]);
}

/**
 * 単一コマンドを登録するフック
 */
export function useCommand(
	type: "keyboard" | "mouse" | "gesture",
	command: string,
	handler: CommandHandler,
) {
	const { keyboard, mouse, gesture } = useInput();

	useEffect(() => {
		let manager: KeyboardManager | MouseManager | GestureManager | null;
		switch (type) {
			case "keyboard":
				manager = keyboard;
				break;
			case "mouse":
				manager = mouse;
				break;
			case "gesture":
				manager = gesture;
				break;
			default:
				manager = null;
				break;
		}

		if (manager) {
			manager.registerCommand(command, handler);
			return () => {
				manager.unregisterCommand(command);
			};
		}
	}, [type, command, handler, keyboard, mouse, gesture]);
}
