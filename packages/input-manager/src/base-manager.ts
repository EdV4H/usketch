import type { CommandHandler, CommandRegistry } from "./types";
import type { IInputManager, IManagerConfig } from "./types/base-manager";

/**
 * Base class for all Managers
 * Provides common functionality implementation
 */
export abstract class BaseInputManager<
	TConfig extends IManagerConfig = IManagerConfig,
	TBinding = unknown,
	TBindings = Record<string, TBinding>,
	TPreset = unknown,
	TEvent = unknown,
> implements IInputManager<TConfig, TBinding, TBindings, TPreset, TEvent>
{
	protected bindings: Map<string, TBinding> = new Map();
	protected commandHandlers: CommandRegistry = {};
	protected listeners: Map<string, Set<(data: any) => void>> = new Map();
	protected config: TConfig;

	constructor(config?: Partial<TConfig>) {
		this.config = this.getDefaultConfig();
		if (config) {
			this.config = { ...this.config, ...config };
		}
	}

	// Abstract methods (must be implemented by subclasses)
	abstract getDefaultConfig(): TConfig;
	abstract initialize(config: TConfig): void;
	abstract loadPreset(preset: TPreset): void;
	abstract getBindings(): TBindings;

	// Common implementation
	setBinding(command: string, binding: TBinding): void {
		if (this.config.debug) {
			console.log(`[${this.constructor.name}] Setting binding:`, command, binding);
		}
		this.bindings.set(command, binding);
	}

	removeBinding(command: string): void {
		if (this.config.debug) {
			console.log(`[${this.constructor.name}] Removing binding:`, command);
		}
		this.bindings.delete(command);
	}

	registerCommand(name: string, handler: CommandHandler): void {
		if (this.config.debug) {
			console.log(`[${this.constructor.name}] Registering command:`, name);
		}
		this.commandHandlers[name] = handler;
	}

	unregisterCommand(name: string): void {
		if (this.config.debug) {
			console.log(`[${this.constructor.name}] Unregistering command:`, name);
		}
		delete this.commandHandlers[name];
	}

	executeCommand(command: string, event: TEvent): boolean {
		const handler = this.commandHandlers[command];
		if (handler) {
			if (this.config.debug) {
				console.log(`[${this.constructor.name}] Executing command:`, command);
			}
			// Cast to any since handler expects different event types
			// The actual type safety is ensured by each subclass implementation
			return handler(event as any);
		}
		return false;
	}

	getActiveBindings(): TBinding[] {
		return Array.from(this.bindings.values());
	}

	// Event emitter functionality
	on(event: string, listener: (data: any) => void): void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		this.listeners.get(event)?.add(listener);
	}

	off(event: string, listener: (data: any) => void): void {
		this.listeners.get(event)?.delete(listener);
	}

	protected emit(event: string, data: any): void {
		this.listeners.get(event)?.forEach((listener) => {
			listener(data);
		});
	}

	destroy(): void {
		if (this.config.debug) {
			console.log(`[${this.constructor.name}] Destroying manager`);
		}
		this.bindings.clear();
		this.commandHandlers = {};
		this.listeners.clear();
	}
}

/**
 * Mixin for Managers with context functionality
 */
export class ContextMixin {
	private contextStack: Array<{ name: string; bindings: Map<string, unknown> }> = [];

	pushContext(name: string, bindings?: Record<string, unknown>): void {
		const contextBindings = new Map<string, unknown>();
		if (bindings) {
			Object.entries(bindings).forEach(([key, value]) => {
				contextBindings.set(key, value);
			});
		}
		this.contextStack.push({ name, bindings: contextBindings });
	}

	popContext(): void {
		this.contextStack.pop();
	}

	getCurrentContext(): { name: string; bindings: Map<string, unknown> } | undefined {
		return this.contextStack[this.contextStack.length - 1];
	}

	clearContexts(): void {
		this.contextStack = [];
	}
}

/**
 * Mixin for Managers with drag functionality
 */
export class DragMixin<TDragState = unknown> {
	protected dragState: TDragState | null = null;

	isDragging(): boolean {
		return this.dragState !== null;
	}

	getDragState(): TDragState | null {
		return this.dragState;
	}

	protected setDragState(state: TDragState | null): void {
		this.dragState = state;
	}
}
