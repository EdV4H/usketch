import {
	type GestureBinding,
	type GestureBindings,
	GestureManager,
	type GesturePreset,
	type KeyBindings,
	KeyboardManager,
	type KeyboardPreset,
	type MouseBinding,
	type MouseBindings,
	MouseManager,
	type MousePreset,
} from "@usketch/input-manager";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { InputContext, type InputContextValue } from "./input-context";

export interface InputProviderProps {
	children: React.ReactNode;

	// プリセット設定
	keyboardPreset?: KeyboardPreset;
	mousePreset?: MousePreset;
	gesturePreset?: GesturePreset;

	// カスタムバインディング
	customKeyBindings?: KeyBindings;
	customMouseBindings?: MouseBindings;
	customGestureBindings?: GestureBindings;

	// 設定変更コールバック
	onBindingChange?: (
		type: "keyboard" | "mouse" | "gesture",
		bindings: KeyBindings | MouseBindings | GestureBindings,
	) => void;

	// デバッグオプション
	debug?: boolean;
}

export function InputProvider({
	children,
	keyboardPreset,
	mousePreset,
	gesturePreset,
	customKeyBindings,
	customMouseBindings,
	customGestureBindings,
	onBindingChange,
	debug = false,
}: InputProviderProps) {
	// マネージャーインスタンス
	const keyboardManagerRef = useRef<KeyboardManager | null>(null);
	const mouseManagerRef = useRef<MouseManager | null>(null);
	const gestureManagerRef = useRef<GestureManager | null>(null);

	// バインディング状態
	const [keyBindings, setKeyBindings] = useState<KeyBindings>({});
	const [mouseBindings, setMouseBindings] = useState<MouseBindings>({});
	const [gestureBindings, setGestureBindings] = useState<GestureBindings>({});

	// マネージャーの初期化
	useEffect(() => {
		// KeyboardManagerの初期化
		if (!keyboardManagerRef.current) {
			keyboardManagerRef.current = new KeyboardManager({
				preset: keyboardPreset,
				customBindings: customKeyBindings,
				debug,
			});
		}

		// MouseManagerの初期化
		if (!mouseManagerRef.current) {
			mouseManagerRef.current = new MouseManager({
				preset: mousePreset,
				customBindings: customMouseBindings,
				debug,
			});
		}

		// GestureManagerの初期化
		if (!gestureManagerRef.current) {
			gestureManagerRef.current = new GestureManager({
				preset: gesturePreset,
				customBindings: customGestureBindings,
				debug,
			});
		}

		// イベントリスナーの設定
		const handleKeyDown = (event: KeyboardEvent) => {
			keyboardManagerRef.current?.handleKeyDown(event);
		};

		const handleKeyUp = (event: KeyboardEvent) => {
			keyboardManagerRef.current?.handleKeyUp(event);
		};

		const handlePointerDown = (event: PointerEvent) => {
			mouseManagerRef.current?.handlePointerDown(event);
		};

		const handlePointerMove = (event: PointerEvent) => {
			mouseManagerRef.current?.handlePointerMove(event);
		};

		const handlePointerUp = (event: PointerEvent) => {
			mouseManagerRef.current?.handlePointerUp(event);
		};

		const handleWheel = (event: WheelEvent) => {
			mouseManagerRef.current?.handleWheel(event);
		};

		const handleTouchStart = (event: TouchEvent) => {
			gestureManagerRef.current?.handleTouchStart(event);
		};

		const handleTouchMove = (event: TouchEvent) => {
			gestureManagerRef.current?.handleTouchMove(event);
		};

		const handleTouchEnd = (event: TouchEvent) => {
			gestureManagerRef.current?.handleTouchEnd(event);
		};

		// イベントリスナーの追加
		document.addEventListener("keydown", handleKeyDown);
		document.addEventListener("keyup", handleKeyUp);
		document.addEventListener("pointerdown", handlePointerDown);
		document.addEventListener("pointermove", handlePointerMove);
		document.addEventListener("pointerup", handlePointerUp);
		document.addEventListener("wheel", handleWheel, { passive: false });
		document.addEventListener("touchstart", handleTouchStart, { passive: false });
		document.addEventListener("touchmove", handleTouchMove, { passive: false });
		document.addEventListener("touchend", handleTouchEnd);

		// クリーンアップ
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			document.removeEventListener("keyup", handleKeyUp);
			document.removeEventListener("pointerdown", handlePointerDown);
			document.removeEventListener("pointermove", handlePointerMove);
			document.removeEventListener("pointerup", handlePointerUp);
			document.removeEventListener("wheel", handleWheel);
			document.removeEventListener("touchstart", handleTouchStart);
			document.removeEventListener("touchmove", handleTouchMove);
			document.removeEventListener("touchend", handleTouchEnd);
		};
	}, [
		keyboardPreset,
		mousePreset,
		gesturePreset,
		customKeyBindings,
		customMouseBindings,
		customGestureBindings,
		debug,
	]);

	// バインディング状態の更新
	useEffect(() => {
		if (keyboardManagerRef.current) {
			const bindings = keyboardManagerRef.current.getActiveBindings();
			const bindingsObject: KeyBindings = {};
			bindings.forEach((binding) => {
				bindingsObject[binding.command] = binding.keys;
			});
			setKeyBindings(bindingsObject);
		}
	}, []);

	useEffect(() => {
		if (mouseManagerRef.current) {
			const bindings = mouseManagerRef.current.getActiveBindings();
			const bindingsObject: MouseBindings = {};
			bindings.forEach((binding) => {
				bindingsObject[binding.command] = binding;
			});
			setMouseBindings(bindingsObject);
		}
	}, []);

	useEffect(() => {
		if (gestureManagerRef.current) {
			const bindings = gestureManagerRef.current.getActiveBindings();
			const bindingsObject: GestureBindings = {};
			bindings.forEach((binding) => {
				bindingsObject[binding.command] = binding;
			});
			setGestureBindings(bindingsObject);
		}
	}, []);

	// バインディング更新メソッド
	const updateKeyBinding = (command: string, keys: string[]) => {
		if (!keyboardManagerRef.current) return;

		keyboardManagerRef.current.setBinding(command, keys);
		const newBindings = { ...keyBindings, [command]: keys };
		setKeyBindings(newBindings);
		onBindingChange?.("keyboard", newBindings);
	};

	const updateMouseBinding = (command: string, binding: MouseBinding) => {
		if (!mouseManagerRef.current) return;

		mouseManagerRef.current.setBinding(command, binding);
		const newBindings = { ...mouseBindings, [command]: binding };
		setMouseBindings(newBindings);
		onBindingChange?.("mouse", newBindings);
	};

	const updateGestureBinding = (command: string, binding: GestureBinding) => {
		if (!gestureManagerRef.current) return;

		gestureManagerRef.current.setBinding(command, binding);
		const newBindings = { ...gestureBindings, [command]: binding };
		setGestureBindings(newBindings);
		onBindingChange?.("gesture", newBindings);
	};

	const resetToPreset = (
		type: "keyboard" | "mouse" | "gesture",
		preset: KeyboardPreset | MousePreset | GesturePreset,
	) => {
		switch (type) {
			case "keyboard":
				if (keyboardManagerRef.current) {
					keyboardManagerRef.current.loadPreset(preset as KeyboardPreset);
					const bindings = keyboardManagerRef.current.getActiveBindings();
					const bindingsObject: KeyBindings = {};
					bindings.forEach((binding) => {
						bindingsObject[binding.command] = binding.keys;
					});
					setKeyBindings(bindingsObject);
					onBindingChange?.("keyboard", bindingsObject);
				}
				break;
			case "mouse":
				if (mouseManagerRef.current) {
					mouseManagerRef.current.loadPreset(preset as MousePreset);
					const bindings = mouseManagerRef.current.getActiveBindings();
					const bindingsObject: MouseBindings = {};
					bindings.forEach((binding) => {
						bindingsObject[binding.command] = binding;
					});
					setMouseBindings(bindingsObject);
					onBindingChange?.("mouse", bindingsObject);
				}
				break;
			case "gesture":
				if (gestureManagerRef.current) {
					gestureManagerRef.current.loadPreset(preset as GesturePreset);
					const bindings = gestureManagerRef.current.getActiveBindings();
					const bindingsObject: GestureBindings = {};
					bindings.forEach((binding) => {
						bindingsObject[binding.command] = binding;
					});
					setGestureBindings(bindingsObject);
					onBindingChange?.("gesture", bindingsObject);
				}
				break;
		}
	};

	// コンテキスト値
	const contextValue: InputContextValue = useMemo(
		() => ({
			keyboard: keyboardManagerRef.current,
			mouse: mouseManagerRef.current,
			gesture: gestureManagerRef.current,
			keyBindings,
			mouseBindings,
			gestureBindings,
			updateKeyBinding,
			updateMouseBinding,
			updateGestureBinding,
			resetToPreset,
		}),
		[keyBindings, mouseBindings, gestureBindings],
	);

	return <InputContext.Provider value={contextValue}>{children}</InputContext.Provider>;
}
