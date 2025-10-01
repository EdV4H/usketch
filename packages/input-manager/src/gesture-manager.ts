import { BaseInputManager } from "./base-manager";
import type {
	GestureBinding,
	GestureBindings,
	GestureConfig,
	GestureEvent,
	GesturePreset,
	GestureState,
	GestureType,
	PinchEvent,
	RotateEvent,
	SwipeEvent,
} from "./types";
import type { IUnifiedGestureManager } from "./types/unified-types";

// Base class for gesture recognizers
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

// Pinch gesture recognizer
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

		// Ignore small changes
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

// Rotation gesture recognizer
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

		// Normalize angle (-180 to 180)
		while (rotation > 180) rotation -= 360;
		while (rotation < -180) rotation += 360;

		// Ignore small changes
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

// Swipe gesture recognizer
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

		return null; // Swipe is determined after movement completion
	}

	update(_touches: TouchList): SwipeEvent | null {
		return null; // Swipe is only determined at end
	}

	end(touches: TouchList, endTime: number): SwipeEvent | null {
		if (touches.length !== 1 || this.startX === 0) return null;

		const touch = touches[0];
		if (!touch) return null;

		const deltaX = touch.clientX - this.startX;
		const deltaY = touch.clientY - this.startY;
		const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
		const duration = endTime - this.startTime;

		// Check threshold
		if (distance < this.threshold || duration > this.maxDuration) {
			this.reset();
			return null;
		}

		// Determine direction
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

// Two-finger drag recognizer
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

/**
 * GestureManager
 * BaseInputManagerを使用した実装
 */
export class GestureManager
	extends BaseInputManager<
		GestureConfig,
		GestureBinding,
		GestureBindings,
		GesturePreset,
		GestureEvent
	>
	implements IUnifiedGestureManager
{
	private recognizers: Map<GestureType, GestureRecognizer>;
	private activeGestures: Map<GestureType, GestureState>;
	private isActive: boolean = false;

	constructor(config?: Partial<GestureConfig>) {
		super(config);

		// Initialize gesture recognizers
		this.recognizers = new Map();
		this.recognizers.set("pinch", new PinchRecognizer());
		this.recognizers.set("rotate", new RotateRecognizer());
		this.recognizers.set("swipe", new SwipeRecognizer());
		this.recognizers.set("twoFingerDrag", new TwoFingerDragRecognizer());

		this.activeGestures = new Map();

		if (config?.preset) {
			this.loadPreset(config.preset);
		}

		this.initialize(this.config);
	}

	getDefaultConfig(): GestureConfig {
		return {
			sensitivity: 1.0,
			debug: false,
		};
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

	loadPreset(preset: GesturePreset): void {
		this.bindings.clear();

		Object.entries(preset.bindings).forEach(([command, binding]) => {
			const safeBinding: GestureBinding = { ...binding, command };
			this.setBinding(command, safeBinding);
		});

		if (this.config.debug) {
			console.log(`[GestureManager] Loaded preset: ${preset.name}`);
		}
	}

	getBindings(): GestureBindings {
		const bindings: GestureBindings = {};
		for (const [command, binding] of this.bindings) {
			bindings[command] = binding;
		}
		return bindings;
	}

	// GestureManager specific methods
	setBindings(bindings: GestureBindings): void {
		Object.entries(bindings).forEach(([command, binding]) => {
			const safeBinding: GestureBinding = { ...binding, command };
			this.setBinding(command, safeBinding);
		});
	}

	handleTouchStart(event: TouchEvent): boolean {
		this.isActive = true;
		const timestamp = Date.now();

		// Start new gesture with all recognizers
		for (const [type, recognizer] of this.recognizers) {
			const gestureEvent = recognizer.recognize(event.touches, timestamp);
			if (gestureEvent) {
				this.activeGestures.set(type, {
					type,
					startTime: timestamp,
					isActive: true,
				});

				// Execute corresponding binding
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

		// Update active gestures
		for (const [type, state] of this.activeGestures) {
			const recognizer = this.recognizers.get(type);
			if (recognizer && state.isActive) {
				const gestureEvent = recognizer.update(event.touches, timestamp);
				if (gestureEvent) {
					// Emit event
					this.emit(type, gestureEvent);

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

		// End active gestures
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

		// Reset when no touches
		if (event.touches.length === 0) {
			this.activeGestures.clear();
			this.isActive = false;
		}

		return handled;
	}

	isGestureActive(): boolean {
		return this.isActive && this.activeGestures.size > 0;
	}

	isGestureTypeActive(type: GestureType): boolean {
		return this.activeGestures.has(type) && this.activeGestures.get(type)?.isActive === true;
	}

	getActiveGestures(): GestureType[] {
		return Array.from(this.activeGestures.keys()).filter(
			(type) => this.activeGestures.get(type)?.isActive,
		);
	}

	// Helper methods
	private findBinding(gestureType: GestureType): GestureBinding | undefined {
		for (const [, binding] of this.bindings) {
			if (binding.gesture === gestureType) {
				return binding;
			}
		}
		return undefined;
	}

	override destroy(): void {
		super.destroy();
		this.activeGestures.clear();
		this.recognizers.clear();
		this.isActive = false;
	}
}

// Default export
export default GestureManager;
