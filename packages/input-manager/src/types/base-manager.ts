import type { CommandHandler, CommandRegistry } from "../types";

/**
 * Base Manager Interface
 * Common interface that all Input Managers (Keyboard, Mouse, Gesture) should implement
 */
export interface IInputManager<
	TConfig = Record<string, any>,
	TBinding = Record<string, any>,
	TBindings = Record<string, TBinding>,
	TPreset = { name: string; bindings: TBindings },
	TEvent = Event,
> {
	// Initialization and cleanup
	initialize(config: TConfig): void;
	destroy(): void;

	// Binding management
	setBinding(command: string, binding: TBinding): void;
	removeBinding(command: string): void;
	loadPreset(preset: TPreset): void;

	// Command management
	registerCommand(name: string, handler: CommandHandler): void;
	unregisterCommand(name: string): void;
	executeCommand(command: string, event: TEvent): boolean;

	// Current state retrieval
	getBindings(): TBindings;
	getActiveBindings(): TBinding[];

	// Event emitter
	on(event: string, listener: (data: any) => void): void;
	off(event: string, listener: (data: any) => void): void;
}

/**
 * Extended Manager Interfaces
 * Additional features that specific Managers implement
 */
export interface IContextAwareManager {
	// Context management (mainly for KeyboardManager)
	pushContext(name: string, bindings?: Record<string, any>): void;
	popContext(): void;
}

export interface IDragAwareManager {
	// Drag state management (mainly for MouseManager)
	isDragging(): boolean;
	getDragState(): Record<string, any> | null;
}

export interface IGestureAwareManager {
	// Gesture state management (for GestureManager)
	isGestureActive(): boolean;
	getActiveGestures(): Map<string, Record<string, any>>;
}

/**
 * Common Manager configuration interface
 */
export interface IManagerConfig {
	debug?: boolean;
	preset?: { name: string; bindings: Record<string, any> };
	customBindings?: Record<string, any>;
}

/**
 * Common Manager internal state
 */
export interface IManagerState<TBinding = unknown> {
	bindings: Map<string, TBinding>;
	commandHandlers: CommandRegistry;
	listeners: Map<string, Set<(data: any) => void>>;
	config: IManagerConfig;
}
