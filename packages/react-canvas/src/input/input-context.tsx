import type {
	GestureBindings,
	GestureManager,
	GesturePreset,
	KeyBindings,
	KeyboardManager,
	KeyboardPreset,
	MouseBindings,
	MouseManager,
	MousePreset,
} from "@usketch/input-manager";
import { createContext, useContext } from "react";

export interface InputContextValue {
	keyboard: KeyboardManager | null;
	mouse: MouseManager | null;
	gesture: GestureManager | null;

	// バインディング管理
	keyBindings: KeyBindings;
	mouseBindings: MouseBindings;
	gestureBindings: GestureBindings;

	// バインディング更新メソッド
	updateKeyBinding: (command: string, keys: string[]) => void;
	updateMouseBinding: (
		command: string,
		binding: import("@usketch/input-manager").MouseBinding,
	) => void;
	updateGestureBinding: (
		command: string,
		binding: import("@usketch/input-manager").GestureBinding,
	) => void;

	// プリセット管理
	resetToPreset: (
		type: "keyboard" | "mouse" | "gesture",
		preset: KeyboardPreset | MousePreset | GesturePreset,
	) => void;
}

export const InputContext = createContext<InputContextValue | null>(null);

export function useInput(): InputContextValue {
	const context = useContext(InputContext);
	if (!context) {
		throw new Error("useInput must be used within InputProvider");
	}
	return context;
}
