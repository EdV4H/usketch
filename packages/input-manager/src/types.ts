import type {
	GestureType,
	MouseBinding as InputMouseBinding,
	MouseBindings as InputMouseBindings,
	KeyBindings,
	KeyboardPreset,
	MousePreset,
} from "@usketch/input-presets";

export type {
	GestureType,
	KeyBindings,
	KeyboardPreset,
	MousePreset,
} from "@usketch/input-presets";

// ローカルのMouseBinding（commandフィールドを必須に）
export interface MouseBinding extends InputMouseBinding {
	command: string;
}

export interface MouseBindings {
	[command: string]: MouseBinding;
}

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
	customBindings?: InputMouseBindings;
	sensitivity?: number;
	invertScroll?: boolean;
	debug?: boolean;
}

// Gesture types
export interface GestureConfig {
	preset?: GesturePreset;
	customBindings?: GestureBindings;
	sensitivity?: number;
	debug?: boolean;
}

export interface GestureBinding {
	command: string;
	gesture: GestureType;
	modifiers?: string[];
	threshold?: number;
}

export interface GestureBindings {
	[command: string]: GestureBinding;
}

export interface GesturePreset {
	id: string;
	name: string;
	description: string;
	bindings: GestureBindings;
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
	centerX?: number;
	centerY?: number;
	distance?: number;
	startDistance?: number;
}

// 具体的なジェスチャーイベント型
export interface PinchEvent extends GestureEvent {
	type: "pinch";
	scale: number;
	centerX: number;
	centerY: number;
	startDistance: number;
}

export interface RotateEvent extends GestureEvent {
	type: "rotate";
	rotation: number;
	centerX: number;
	centerY: number;
}

export interface SwipeEvent extends GestureEvent {
	type: "swipe";
	direction: "up" | "down" | "left" | "right";
	distance: number;
	velocity: number;
	deltaX: number;
	deltaY: number;
}

export interface GestureState {
	type: GestureType;
	startTime: number;
	isActive: boolean;
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
	initialize(config: GestureConfig): void;
	setBinding(command: string, binding: GestureBinding): void;
	setBindings(bindings: GestureBindings): void;
	removeBinding(command: string): void;
	loadPreset(preset: GesturePreset): void;
	registerCommand(name: string, handler: CommandHandler): void;
	unregisterCommand(name: string): void;
	executeCommand(command: string, event: GestureEvent): boolean;
	handleTouchStart(event: TouchEvent): boolean;
	handleTouchMove(event: TouchEvent): boolean;
	handleTouchEnd(event: TouchEvent): boolean;
	destroy(): void;
}
