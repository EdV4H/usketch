import type {
	GestureType,
	KeyBindings,
	KeyboardPreset,
	MouseBinding,
	MouseBindings,
	MousePreset,
} from "@usketch/input-presets";

export type {
	GestureType,
	KeyBindings,
	KeyboardPreset,
	MouseBinding,
	MouseBindings,
	MousePreset,
} from "@usketch/input-presets";

// Keyboard types
export interface KeyboardConfig {
	preset?: KeyboardPreset;
	customBindings?: KeyBindings;
	enableInInput?: boolean;
	debug?: boolean;
}

export interface KeyBinding {
	command: string;
	keys: string[];
	context?: string;
	when?: string; // 条件式
}

export interface KeyboardContext {
	name: string;
	bindings?: KeyBindings;
	priority: number;
}

// Mouse types
export interface MouseConfig {
	preset?: MousePreset;
	customBindings?: MouseBindings;
	sensitivity?: number;
	invertScroll?: boolean;
	debug?: boolean;
}

export interface DragState {
	startX: number;
	startY: number;
	button: number;
	modifiers: string[];
	lastX?: number;
	lastY?: number;
}

// Event types
export interface PanEvent {
	originalEvent: PointerEvent;
	deltaX: number;
	deltaY: number;
	clientX: number;
	clientY: number;
}

export interface GestureEvent {
	type: GestureType;
	scale?: number; // ピンチズーム用
	rotation?: number; // 回転用
	deltaX?: number; // パン用
	deltaY?: number; // パン用
	velocity?: number; // スワイプ用
	direction?: "up" | "down" | "left" | "right";
}

export interface GestureState {
	id: number;
	startX: number;
	startY: number;
	currentX: number;
	currentY: number;
	timestamp: number;
}

// Command types
export type CommandHandler = (
	event: KeyboardEvent | MouseEvent | WheelEvent | PanEvent | GestureEvent,
) => boolean;

export interface CommandRegistry {
	[command: string]: CommandHandler;
}

// Manager interfaces
export interface IKeyboardManager {
	initialize(config: KeyboardConfig): void;
	setBinding(command: string, keys: string[]): void;
	removeBinding(command: string): void;
	loadPreset(preset: KeyboardPreset): void;
	pushContext(name: string, bindings?: KeyBindings): void;
	popContext(): void;
	registerCommand(name: string, handler: CommandHandler): void;
	unregisterCommand(name: string): void;
	executeCommand(command: string, event: KeyboardEvent): boolean;
	handleKeyDown(event: KeyboardEvent): boolean;
	handleKeyUp(event: KeyboardEvent): boolean;
	destroy(): void;
}

export interface IMouseManager {
	initialize(config: MouseConfig): void;
	setBinding(command: string, binding: MouseBinding): void;
	removeBinding(command: string): void;
	loadPreset(preset: MousePreset): void;
	registerCommand(name: string, handler: CommandHandler): void;
	unregisterCommand(name: string): void;
	executeCommand(command: string, event: MouseEvent | WheelEvent | PanEvent): boolean;
	handlePointerDown(event: PointerEvent): boolean;
	handlePointerMove(event: PointerEvent): boolean;
	handlePointerUp(event: PointerEvent): boolean;
	handleWheel(event: WheelEvent): boolean;
	destroy(): void;
}

export interface IGestureManager {
	processPointerEvent(event: PointerEvent): GestureEvent | null;
	reset(): void;
	destroy(): void;
}
