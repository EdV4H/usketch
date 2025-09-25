import type { KeyboardPreset, MousePreset } from "@usketch/input-presets";
import { useEffect, useMemo } from "react";
import { GestureManager } from "../gesture/gesture-manager";
import { KeyboardManager } from "../keyboard/keyboard-manager";
import { MouseManager } from "../mouse/mouse-manager";
import type { CommandHandler, KeyboardConfig, MouseConfig } from "../types";

/**
 * 入力マネージャー統合フック設定
 */
export interface UseInputManagerOptions {
	keyboardConfig?: KeyboardConfig;
	mouseConfig?: MouseConfig;
	gestureConfig?: Partial<{
		pinchThreshold: number;
		rotationThreshold: number;
		swipeThreshold: number;
		swipeTimeout: number;
		doubleTapTimeout: number;
		longPressTimeout: number;
		debug: boolean;
	}>;
	enabled?: boolean;
	targetRef?: React.RefObject<HTMLElement>;
}

/**
 * 入力マネージャー統合フックの戻り値
 */
export interface InputManagerResult {
	keyboard: KeyboardManager;
	mouse: MouseManager;
	gesture: GestureManager;
	registerCommand: (name: string, handler: CommandHandler) => void;
	loadKeyboardPreset: (preset: KeyboardPreset) => void;
	loadMousePreset: (preset: MousePreset) => void;
	setEnabled: (enabled: boolean) => void;
}

/**
 * 入力マネージャー統合フック
 * キーボード、マウス、ジェスチャー入力を統合管理
 */
export function useInputManager(options: UseInputManagerOptions = {}): InputManagerResult {
	const { keyboardConfig, mouseConfig, gestureConfig, enabled = true, targetRef } = options;

	// マネージャーインスタンスを作成
	const managers = useMemo(() => {
		const keyboard = new KeyboardManager(keyboardConfig);
		const mouse = new MouseManager(mouseConfig);
		const gesture = new GestureManager(gestureConfig);

		// キーボードとマウス間で修飾キー状態を同期
		keyboard.on("modifiers:change", (modifiers: Set<string>) => {
			mouse.syncModifiers(modifiers);
		});

		// スペースキーをマウス操作の修飾キーとして使用
		keyboard.on("space:down", () => {
			const modifiers = keyboard.getActiveModifiers();
			mouse.syncModifiers(modifiers);
		});

		keyboard.on("space:up", () => {
			const modifiers = keyboard.getActiveModifiers();
			mouse.syncModifiers(modifiers);
		});

		return { keyboard, mouse, gesture };
	}, []); // 初回のみ作成

	// イベントリスナーの登録
	useEffect(() => {
		const target = targetRef?.current || document;

		// キーボードイベント
		const handleKeyDown = (e: KeyboardEvent) => {
			if (enabled) {
				managers.keyboard.handleKeyDown(e);
			}
		};

		const handleKeyUp = (e: KeyboardEvent) => {
			if (enabled) {
				managers.keyboard.handleKeyUp(e);
			}
		};

		// マウスイベント
		const handleMouseDown = (e: PointerEvent) => {
			if (enabled) {
				managers.mouse.handleMouseDown(e);
			}
		};

		const handleMouseMove = (e: PointerEvent) => {
			if (enabled) {
				managers.mouse.handleMouseMove(e);
			}
		};

		const handleMouseUp = (e: PointerEvent) => {
			if (enabled) {
				managers.mouse.handleMouseUp(e);
			}
		};

		const handleWheel = (e: WheelEvent) => {
			if (enabled) {
				managers.mouse.handleWheel(e);
			}
		};

		const handleContextMenu = (e: MouseEvent) => {
			if (enabled) {
				managers.mouse.handleContextMenu(e);
			}
		};

		// タッチイベント
		const handleTouchStart = (e: TouchEvent) => {
			if (enabled) {
				managers.gesture.handleTouchStart(e);
			}
		};

		const handleTouchMove = (e: TouchEvent) => {
			if (enabled) {
				managers.gesture.handleTouchMove(e);
			}
		};

		const handleTouchEnd = (e: TouchEvent) => {
			if (enabled) {
				managers.gesture.handleTouchEnd(e);
			}
		};

		const handleTouchCancel = (e: TouchEvent) => {
			if (enabled) {
				managers.gesture.handleTouchCancel(e);
			}
		};

		// イベントリスナー登録
		target.addEventListener("keydown", handleKeyDown as EventListener);
		target.addEventListener("keyup", handleKeyUp as EventListener);
		target.addEventListener("pointerdown", handleMouseDown as EventListener);
		target.addEventListener("pointermove", handleMouseMove as EventListener);
		target.addEventListener("pointerup", handleMouseUp as EventListener);
		target.addEventListener("wheel", handleWheel as EventListener);
		target.addEventListener("contextmenu", handleContextMenu as EventListener);
		target.addEventListener("touchstart", handleTouchStart as EventListener);
		target.addEventListener("touchmove", handleTouchMove as EventListener);
		target.addEventListener("touchend", handleTouchEnd as EventListener);
		target.addEventListener("touchcancel", handleTouchCancel as EventListener);

		// クリーンアップ
		return () => {
			target.removeEventListener("keydown", handleKeyDown as EventListener);
			target.removeEventListener("keyup", handleKeyUp as EventListener);
			target.removeEventListener("pointerdown", handleMouseDown as EventListener);
			target.removeEventListener("pointermove", handleMouseMove as EventListener);
			target.removeEventListener("pointerup", handleMouseUp as EventListener);
			target.removeEventListener("wheel", handleWheel as EventListener);
			target.removeEventListener("contextmenu", handleContextMenu as EventListener);
			target.removeEventListener("touchstart", handleTouchStart as EventListener);
			target.removeEventListener("touchmove", handleTouchMove as EventListener);
			target.removeEventListener("touchend", handleTouchEnd as EventListener);
			target.removeEventListener("touchcancel", handleTouchCancel as EventListener);
		};
	}, [enabled, targetRef, managers]);

	// 統合API
	const api = useMemo(
		() => ({
			keyboard: managers.keyboard,
			mouse: managers.mouse,
			gesture: managers.gesture,

			// 統合コマンド登録
			registerCommand: (name: string, handler: CommandHandler) => {
				managers.keyboard.registerCommand(name, handler);
				managers.mouse.registerCommand(name, handler);
			},

			// プリセット読み込み
			loadKeyboardPreset: (preset: KeyboardPreset) => {
				managers.keyboard.loadPreset(preset);
			},

			loadMousePreset: (preset: MousePreset) => {
				managers.mouse.loadPreset(preset);
			},

			// 有効/無効切り替え
			setEnabled: (enabled: boolean) => {
				if (enabled) {
					managers.keyboard.enable();
					managers.mouse.enable();
					managers.gesture.enable();
				} else {
					managers.keyboard.disable();
					managers.mouse.disable();
					managers.gesture.disable();
				}
			},
		}),
		[managers],
	);

	return api;
}
