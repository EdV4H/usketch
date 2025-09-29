import type { CommandHandler, CommandRegistry } from "../types";

/**
 * 基底Managerインターフェース
 * すべてのInput Manager（Keyboard, Mouse, Gesture）が実装すべき共通インターフェース
 */
export interface IInputManager<
	TConfig = unknown,
	TBinding = unknown,
	TBindings = Record<string, TBinding>,
	TPreset = unknown,
	TEvent = unknown,
> {
	// 初期化・破棄
	initialize(config: TConfig): void;
	destroy(): void;

	// バインディング管理
	setBinding(command: string, binding: TBinding): void;
	removeBinding(command: string): void;
	loadPreset(preset: TPreset): void;

	// コマンド管理
	registerCommand(name: string, handler: CommandHandler): void;
	unregisterCommand(name: string): void;
	executeCommand(command: string, event: TEvent): boolean;

	// 現在の状態取得
	getBindings(): TBindings;
	getActiveBindings(): TBinding[];

	// イベントエミッター
	on(event: string, listener: (data: any) => void): void;
	off(event: string, listener: (data: any) => void): void;
}

/**
 * 拡張Managerインターフェース
 * 特定のManagerが追加で実装する機能
 */
export interface IContextAwareManager {
	// コンテキスト管理（主にKeyboardManager用）
	pushContext(name: string, bindings?: unknown): void;
	popContext(): void;
}

export interface IDragAwareManager {
	// ドラッグ状態管理（主にMouseManager用）
	isDragging(): boolean;
	getDragState(): unknown | null;
}

export interface IGestureAwareManager {
	// ジェスチャー状態管理（GestureManager用）
	isGestureActive(): boolean;
	getActiveGestures(): Map<string, unknown>;
}

/**
 * Manager共通の設定インターフェース
 */
export interface IManagerConfig {
	debug?: boolean;
	preset?: unknown;
	customBindings?: unknown;
}

/**
 * Manager共通の内部状態
 */
export interface IManagerState<TBinding = unknown> {
	bindings: Map<string, TBinding>;
	commandHandlers: CommandRegistry;
	listeners: Map<string, Set<(data: any) => void>>;
	config: IManagerConfig;
}
