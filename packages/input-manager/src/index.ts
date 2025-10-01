// Managers

// Base classes and mixins
export { BaseInputManager, ContextMixin, DragMixin } from "./base-manager";
export { GestureManager } from "./gesture-manager";
export { KeyboardManager } from "./keyboard-manager";
export { MouseManager } from "./mouse-manager";

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
