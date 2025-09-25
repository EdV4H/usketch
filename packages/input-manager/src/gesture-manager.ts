import type {
	CommandHandler,
	CommandRegistry,
	GestureBinding,
	GestureBindings,
	GestureConfig,
	GestureEvent,
	GesturePreset,
	GestureState,
	GestureType,
	IGestureManager,
	PinchEvent,
	RotateEvent,
	SwipeEvent,
} from "./types";

// ジェスチャー認識器の基底クラス
abstract class GestureRecognizer {
	abstract readonly type: GestureType;
	protected threshold: number = 10;
	protected minDuration: number = 100;
	protected maxDuration: number = 5000;

	constructor(options?: { threshold?: number; minDuration?: number; maxDuration?: number }) {
		if (options) {
			this.threshold = options.threshold ?? this.threshold;
			this.minDuration = options.minDuration ?? this.minDuration;
			this.maxDuration = options.maxDuration ?? this.maxDuration;
		}
	}

	abstract recognize(touches: TouchList, startTime: number): GestureEvent | null;
	abstract update(touches: TouchList, currentTime: number): GestureEvent | null;
	abstract end(touches: TouchList, endTime: number): GestureEvent | null;
}

// ピンチジェスチャー認識器
class PinchRecognizer extends GestureRecognizer {
	readonly type: GestureType = "pinch";
	private initialDistance: number = 0;
	private previousScale: number = 1;

	recognize(touches: TouchList): PinchEvent | null {
		if (touches.length !== 2) return null;

		const touch1 = touches[0];
		const touch2 = touches[1];
		if (!touch1 || !touch2) return null;

		this.initialDistance = this.getDistance(touch1, touch2);
		this.previousScale = 1;

		return {
			type: "pinch",
			scale: 1,
			centerX: (touch1.clientX + touch2.clientX) / 2,
			centerY: (touch1.clientY + touch2.clientY) / 2,
			startDistance: this.initialDistance,
		};
	}

	update(touches: TouchList): PinchEvent | null {
		if (touches.length !== 2 || this.initialDistance === 0) return null;

		const touch1 = touches[0];
		const touch2 = touches[1];
		if (!touch1 || !touch2) return null;

		const currentDistance = this.getDistance(touch1, touch2);
		const scale = currentDistance / this.initialDistance;

		// 微小な変化は無視
		if (Math.abs(scale - this.previousScale) < 0.01) return null;

		this.previousScale = scale;

		return {
			type: "pinch",
			scale,
			centerX: (touch1.clientX + touch2.clientX) / 2,
			centerY: (touch1.clientY + touch2.clientY) / 2,
			startDistance: this.initialDistance,
		};
	}

	end(touches: TouchList): PinchEvent | null {
		const result = this.update(touches);
		this.initialDistance = 0;
		this.previousScale = 1;
		return result;
	}

	private getDistance(touch1: Touch, touch2: Touch): number {
		const dx = touch1.clientX - touch2.clientX;
		const dy = touch1.clientY - touch2.clientY;
		return Math.sqrt(dx * dx + dy * dy);
	}
}

// ローテーションジェスチャー認識器
class RotateRecognizer extends GestureRecognizer {
	readonly type: GestureType = "rotate";
	private initialAngle: number = 0;
	private previousRotation: number = 0;

	recognize(touches: TouchList): RotateEvent | null {
		if (touches.length !== 2) return null;

		const touch1 = touches[0];
		const touch2 = touches[1];
		if (!touch1 || !touch2) return null;

		this.initialAngle = this.getAngle(touch1, touch2);
		this.previousRotation = 0;

		return {
			type: "rotate",
			rotation: 0,
			centerX: (touch1.clientX + touch2.clientX) / 2,
			centerY: (touch1.clientY + touch2.clientY) / 2,
		};
	}

	update(touches: TouchList): RotateEvent | null {
		if (touches.length !== 2 || this.initialAngle === 0) return null;

		const touch1 = touches[0];
		const touch2 = touches[1];
		if (!touch1 || !touch2) return null;

		const currentAngle = this.getAngle(touch1, touch2);
		let rotation = currentAngle - this.initialAngle;

		// 角度の正規化 (-180 to 180)
		while (rotation > 180) rotation -= 360;
		while (rotation < -180) rotation += 360;

		// 微小な変化は無視
		if (Math.abs(rotation - this.previousRotation) < 1) return null;

		this.previousRotation = rotation;

		return {
			type: "rotate",
			rotation,
			centerX: (touch1.clientX + touch2.clientX) / 2,
			centerY: (touch1.clientY + touch2.clientY) / 2,
		};
	}

	end(touches: TouchList): RotateEvent | null {
		const result = this.update(touches);
		this.initialAngle = 0;
		this.previousRotation = 0;
		return result;
	}

	private getAngle(touch1: Touch, touch2: Touch): number {
		const dx = touch2.clientX - touch1.clientX;
		const dy = touch2.clientY - touch1.clientY;
		return (Math.atan2(dy, dx) * 180) / Math.PI;
	}
}

// スワイプジェスチャー認識器
class SwipeRecognizer extends GestureRecognizer {
	readonly type: GestureType = "swipe";
	private startX: number = 0;
	private startY: number = 0;
	private startTime: number = 0;

	recognize(touches: TouchList, startTime: number): SwipeEvent | null {
		if (touches.length !== 1) return null;

		const touch = touches[0];
		if (!touch) return null;

		this.startX = touch.clientX;
		this.startY = touch.clientY;
		this.startTime = startTime;

		return null; // スワイプは動きが完了してから判定
	}

	update(_touches: TouchList): SwipeEvent | null {
		return null; // スワイプは終了時のみ判定
	}

	end(touches: TouchList, endTime: number): SwipeEvent | null {
		if (touches.length !== 1 || this.startX === 0) return null;

		const touch = touches[0];
		if (!touch) return null;

		const deltaX = touch.clientX - this.startX;
		const deltaY = touch.clientY - this.startY;
		const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
		const duration = endTime - this.startTime;

		// しきい値チェック
		if (distance < this.threshold || duration > this.maxDuration) {
			this.reset();
			return null;
		}

		// 方向の判定
		let direction: "up" | "down" | "left" | "right";
		if (Math.abs(deltaX) > Math.abs(deltaY)) {
			direction = deltaX > 0 ? "right" : "left";
		} else {
			direction = deltaY > 0 ? "down" : "up";
		}

		const velocity = distance / duration;

		this.reset();

		return {
			type: "swipe",
			direction,
			distance,
			velocity,
			deltaX,
			deltaY,
		};
	}

	private reset(): void {
		this.startX = 0;
		this.startY = 0;
		this.startTime = 0;
	}
}

// 2本指ドラッグ認識器
class TwoFingerDragRecognizer extends GestureRecognizer {
	readonly type: GestureType = "twoFingerDrag";
	private startCenterX: number = 0;
	private startCenterY: number = 0;

	recognize(touches: TouchList): GestureEvent | null {
		if (touches.length !== 2) return null;

		const touch1 = touches[0];
		const touch2 = touches[1];
		if (!touch1 || !touch2) return null;

		this.startCenterX = (touch1.clientX + touch2.clientX) / 2;
		this.startCenterY = (touch1.clientY + touch2.clientY) / 2;

		return {
			type: "twoFingerDrag",
			deltaX: 0,
			deltaY: 0,
			centerX: this.startCenterX,
			centerY: this.startCenterY,
		};
	}

	update(touches: TouchList): GestureEvent | null {
		if (touches.length !== 2 || this.startCenterX === 0) return null;

		const touch1 = touches[0];
		const touch2 = touches[1];
		if (!touch1 || !touch2) return null;

		const centerX = (touch1.clientX + touch2.clientX) / 2;
		const centerY = (touch1.clientY + touch2.clientY) / 2;

		return {
			type: "twoFingerDrag",
			deltaX: centerX - this.startCenterX,
			deltaY: centerY - this.startCenterY,
			centerX,
			centerY,
		};
	}

	end(touches: TouchList): GestureEvent | null {
		const result = this.update(touches);
		this.startCenterX = 0;
		this.startCenterY = 0;
		return result;
	}
}

export class GestureManager implements IGestureManager {
	private bindings: Map<string, GestureBinding>;
	private commandHandlers: CommandRegistry;
	private config: GestureConfig;
	private recognizers: Map<GestureType, GestureRecognizer>;
	private activeGestures: Map<GestureType, GestureState>;
	private listeners: Map<string, Set<(data: any) => void>>;
	private isActive: boolean = false;

	constructor(config?: GestureConfig) {
		this.bindings = new Map();
		this.commandHandlers = {};
		this.listeners = new Map();
		this.activeGestures = new Map();
		this.config = {
			sensitivity: 1.0,
			debug: false,
			...config,
		};

		// ジェスチャー認識器の初期化
		this.recognizers = new Map();
		this.recognizers.set("pinch", new PinchRecognizer());
		this.recognizers.set("rotate", new RotateRecognizer());
		this.recognizers.set("swipe", new SwipeRecognizer());
		this.recognizers.set("twoFingerDrag", new TwoFingerDragRecognizer());

		if (config?.preset) {
			this.loadPreset(config.preset);
		}
	}

	initialize(config: GestureConfig): void {
		this.config = { ...this.config, ...config };

		if (config.preset) {
			this.loadPreset(config.preset);
		}
		if (config.customBindings) {
			this.setBindings(config.customBindings);
		}
	}

	setBinding(command: string, binding: GestureBinding): void {
		this.bindings.set(command, { ...binding, command });
		if (this.config.debug) {
			console.log(`[GestureManager] Binding set: ${command}`, binding);
		}
	}

	setBindings(bindings: GestureBindings): void {
		Object.entries(bindings).forEach(([command, binding]) => {
			this.setBinding(command, binding);
		});
	}

	removeBinding(command: string): void {
		this.bindings.delete(command);
	}

	loadPreset(preset: GesturePreset): void {
		// 既存のバインディングをクリア
		this.bindings.clear();

		// プリセットのバインディングを設定
		Object.entries(preset.bindings).forEach(([command, binding]) => {
			this.setBinding(command, binding);
		});

		if (this.config.debug) {
			console.log(`[GestureManager] Loaded preset: ${preset.name}`);
		}
	}

	registerCommand(name: string, handler: CommandHandler): void {
		this.commandHandlers[name] = handler;
		if (this.config.debug) {
			console.log(`[GestureManager] Command registered: ${name}`);
		}
	}

	unregisterCommand(name: string): void {
		delete this.commandHandlers[name];
	}

	executeCommand(command: string, event: GestureEvent): boolean {
		const handler = this.commandHandlers[command];
		if (handler) {
			const result = handler(event);
			if (this.config.debug) {
				console.log(`[GestureManager] Command executed: ${command} -> ${result}`);
			}
			return result;
		}
		return false;
	}

	handleTouchStart(event: TouchEvent): boolean {
		this.isActive = true;
		const timestamp = Date.now();

		// 全ての認識器で新しいジェスチャーを開始
		for (const [type, recognizer] of this.recognizers) {
			const gestureEvent = recognizer.recognize(event.touches, timestamp);
			if (gestureEvent) {
				this.activeGestures.set(type, {
					type,
					startTime: timestamp,
					isActive: true,
				});

				// 対応するバインディングを実行
				const binding = this.findBinding(type);
				if (binding) {
					this.executeCommand(`${binding.command}:start`, gestureEvent);
				}
			}
		}

		return this.activeGestures.size > 0;
	}

	handleTouchMove(event: TouchEvent): boolean {
		if (!this.isActive) return false;

		const timestamp = Date.now();
		let handled = false;

		// アクティブなジェスチャーを更新
		for (const [type, state] of this.activeGestures) {
			const recognizer = this.recognizers.get(type);
			if (recognizer && state.isActive) {
				const gestureEvent = recognizer.update(event.touches, timestamp);
				if (gestureEvent) {
					const binding = this.findBinding(type);
					if (binding) {
						this.executeCommand(`${binding.command}:move`, gestureEvent);
						handled = true;
					}
				}
			}
		}

		return handled;
	}

	handleTouchEnd(event: TouchEvent): boolean {
		const timestamp = Date.now();
		let handled = false;

		// アクティブなジェスチャーを終了
		for (const [type, state] of this.activeGestures) {
			const recognizer = this.recognizers.get(type);
			if (recognizer && state.isActive) {
				const gestureEvent = recognizer.end(event.touches, timestamp);
				if (gestureEvent) {
					const binding = this.findBinding(type);
					if (binding) {
						this.executeCommand(`${binding.command}:end`, gestureEvent);
						handled = true;
					}
				}
			}
		}

		// タッチがなくなったらリセット
		if (event.touches.length === 0) {
			this.activeGestures.clear();
			this.isActive = false;
		}

		return handled;
	}

	destroy(): void {
		this.bindings.clear();
		this.commandHandlers = {};
		this.listeners.clear();
		this.activeGestures.clear();
		this.isActive = false;
	}

	// ヘルパーメソッド
	private findBinding(gestureType: GestureType): GestureBinding | undefined {
		for (const [, binding] of this.bindings) {
			if (binding.gesture === gestureType) {
				return binding;
			}
		}
		return undefined;
	}

	// イベントエミッター機能
	on(event: string, listener: (data: any) => void): void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		this.listeners.get(event)?.add(listener);
	}

	off(event: string, listener: (data: any) => void): void {
		this.listeners.get(event)?.delete(listener);
	}

	// private emit(event: string, data: any): void {
	// 	this.listeners.get(event)?.forEach((listener) => {
	// 		listener(data);
	// 	});
	// }

	// 公開メソッド
	getActiveBindings(): GestureBinding[] {
		return Array.from(this.bindings.values());
	}

	isGestureActive(type: GestureType): boolean {
		return this.activeGestures.has(type) && this.activeGestures.get(type)?.isActive === true;
	}

	getActiveGestures(): GestureType[] {
		return Array.from(this.activeGestures.keys()).filter(
			(type) => this.activeGestures.get(type)?.isActive,
		);
	}
}
