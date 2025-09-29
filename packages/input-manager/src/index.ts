// Managers (リファクタリング済み実装を使用)

// Base classes and mixins
export { BaseInputManager, ContextMixin, DragMixin } from "./base-manager";
export { GestureManager } from "./gesture-manager-refactored";
export { KeyboardManager } from "./keyboard-manager-refactored";
export { MouseManager } from "./mouse-manager-refactored";

// Types
export type {
	CommandHandler,
	CommandRegistry,
	DragState,
	GestureBinding,
	GestureBindings,
	GestureConfig,
	GestureEvent,
	GesturePreset,
	GestureState,
	GestureType,
	IGestureManager,
	IKeyboardManager,
	IMouseManager,
	KeyBinding,
	KeyBindings,
	// Local types
	KeyboardConfig,
	KeyboardContext,
	// Re-export from input-presets
	KeyboardPreset,
	MouseBinding,
	MouseBindings,
	MouseConfig,
	MousePreset,
	PanEvent,
	PinchEvent,
	RotateEvent,
	SwipeEvent,
} from "./types";

// Unified interfaces
export type {
	IContextAwareManager,
	IDragAwareManager,
	IGestureAwareManager,
	IInputManager,
	IManagerConfig,
	IManagerState,
} from "./types/base-manager";

export type {
	IInputCoordinator,
	IInputManagerFactory,
	IUnifiedGestureManager,
	IUnifiedKeyboardManager,
	IUnifiedMouseManager,
} from "./types/unified-types";
