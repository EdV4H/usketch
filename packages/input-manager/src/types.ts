import type { GestureType, KeyboardPreset, MousePreset } from "@usketch/input-presets";

/**
 * コマンドハンドラー
 * @returns true: イベントを処理した、false: イベントを処理しなかった
 */
export type CommandHandler<T = any> = (event: T) => boolean;

/**
 * キーボード設定
 */
export interface KeyboardConfig {
	preset?: KeyboardPreset;
	customBindings?: Record<string, string[]>;
	enableInInput?: boolean;
	debug?: boolean;
}

/**
 * マウス設定
 */
export interface MouseConfig {
	preset?: MousePreset;
	customBindings?: Record<string, MouseBinding>;
	invertPan?: boolean; // パン方向を反転するか
	sensitivity?: number; // 感度設定
	debug?: boolean;
}

/**
 * キーバインディング
 */
export interface KeyBinding {
	command: string;
	keys: string[];
	when?: string; // 条件式
}

/**
 * マウスバインディング（拡張版）
 */
export interface MouseBinding {
	button?: number;
	action?: "click" | "drag";
	wheel?: boolean | "up" | "down";
	gesture?: GestureType;
	modifiers?: string[];
}

/**
 * ドラッグ状態
 */
export interface DragState {
	startX: number;
	startY: number;
	button: number;
	modifiers: string[];
	lastX?: number;
	lastY?: number;
}

/**
 * パンイベント
 */
export interface PanEvent {
	originalEvent: PointerEvent;
	deltaX: number;
	deltaY: number;
	clientX: number;
	clientY: number;
}

/**
 * ジェスチャーイベント
 */
export interface GestureEvent {
	type: GestureType;
	scale?: number; // ピンチズーム用
	rotation?: number; // 回転用
	deltaX?: number; // パン用
	deltaY?: number; // パン用
	velocity?: number; // スワイプ用
	direction?: "up" | "down" | "left" | "right";
}

/**
 * ジェスチャー状態
 */
export interface GestureState {
	id: number;
	startX: number;
	startY: number;
	currentX: number;
	currentY: number;
	timestamp: number;
}

/**
 * イベントエミッター
 */
export interface EventEmitter<T = any> {
	on(event: string, handler: (data: T) => void): void;
	off(event: string, handler: (data: T) => void): void;
	emit(event: string, data: T): void;
}
