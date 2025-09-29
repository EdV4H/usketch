import type {
	DragState,
	GestureBinding,
	GestureBindings,
	GestureConfig,
	GestureEvent,
	GesturePreset,
	KeyBindings,
	KeyboardConfig,
	KeyboardPreset,
	MouseBinding,
	MouseBindings,
	MouseConfig,
	MousePreset,
	PanEvent,
} from "../types";
import type { IContextAwareManager, IDragAwareManager, IInputManager } from "./base-manager";

/**
 * 統一されたKeyboardManagerインターフェース
 */
export interface IUnifiedKeyboardManager
	extends IInputManager<
			KeyboardConfig,
			string[], // キーボードのバインディングは文字列配列
			KeyBindings,
			KeyboardPreset,
			KeyboardEvent
		>,
		IContextAwareManager {
	// KeyboardManager固有のメソッド
	handleKeyDown(event: KeyboardEvent): boolean;
	handleKeyUp(event: KeyboardEvent): boolean;
	isModifierActive(modifier: string): boolean;
}

/**
 * 統一されたMouseManagerインターフェース
 */
export interface IUnifiedMouseManager
	extends IInputManager<
			MouseConfig,
			MouseBinding,
			MouseBindings,
			MousePreset,
			MouseEvent | WheelEvent | PanEvent
		>,
		IDragAwareManager {
	// MouseManager固有のメソッド
	handlePointerDown(event: PointerEvent): boolean;
	handlePointerMove(event: PointerEvent): boolean;
	handlePointerUp(event: PointerEvent): boolean;
	handleWheel(event: WheelEvent): boolean;
	getDragState(): DragState | null;
}

/**
 * 統一されたGestureManagerインターフェース
 */
export interface IUnifiedGestureManager
	extends IInputManager<
		GestureConfig,
		GestureBinding,
		GestureBindings,
		GesturePreset,
		GestureEvent
	> {
	// GestureManager固有のメソッド
	handleTouchStart(event: TouchEvent): boolean;
	handleTouchMove(event: TouchEvent): boolean;
	handleTouchEnd(event: TouchEvent): boolean;
	setBindings(bindings: GestureBindings): void;
	isGestureActive(): boolean;
}

/**
 * Manager生成のためのファクトリーインターフェース
 */
export interface IInputManagerFactory {
	createKeyboardManager(config?: KeyboardConfig): IUnifiedKeyboardManager;
	createMouseManager(config?: MouseConfig): IUnifiedMouseManager;
	createGestureManager(config?: GestureConfig): IUnifiedGestureManager;
}

/**
 * すべてのManagerを統合するコーディネーター
 */
export interface IInputCoordinator {
	keyboard: IUnifiedKeyboardManager;
	mouse: IUnifiedMouseManager;
	gesture: IUnifiedGestureManager;

	// 統合メソッド
	initialize(): void;
	destroy(): void;

	// クロスマネージャー連携
	enableSpaceDrag(): void;
	disableSpaceDrag(): void;
	syncModifiers(): void;

	// グローバル設定
	setDebugMode(enabled: boolean): void;
	exportSettings(): unknown;
	importSettings(settings: unknown): void;
}
