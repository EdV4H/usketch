import { BaseInputManager } from "./base-manager";
import type {
	DragState,
	MouseBinding,
	MouseBindings,
	MouseConfig,
	MousePreset,
	PanEvent,
} from "./types";
import type { IUnifiedMouseManager } from "./types/unified-types";
import { throttle } from "./utils/debounce";

/**
 * リファクタリング済みMouseManager
 * BaseInputManagerとDragMixinを使用した実装
 */
export class MouseManagerRefactored
	extends BaseInputManager<
		MouseConfig,
		MouseBinding,
		MouseBindings,
		MousePreset,
		MouseEvent | WheelEvent | PanEvent
	>
	implements IUnifiedMouseManager
{
	private dragState: DragState | null = null;
	private throttledWheel: (event: WheelEvent) => boolean;

	constructor(config?: Partial<MouseConfig>) {
		super(config);
		if (config?.preset) {
			this.loadPreset(config.preset);
		}
		// ホイールイベントをスロットル化（16ms = 60fps）
		this.throttledWheel = throttle(this.handleWheelInternal.bind(this), 16);
		this.initialize(this.config);
	}

	getDefaultConfig(): MouseConfig {
		return {
			sensitivity: 1.0,
			invertScroll: false,
			debug: false,
		};
	}

	initialize(config: MouseConfig): void {
		this.config = { ...this.config, ...config };
		if (config.preset) {
			this.loadPreset(config.preset);
		}
		if (config.customBindings) {
			Object.entries(config.customBindings).forEach(([command, binding]) => {
				// commandフィールドを追加
				const safeBinding: MouseBinding = { ...binding, command };
				this.setBinding(command, safeBinding);
			});
		}
	}

	loadPreset(preset: MousePreset): void {
		this.bindings.clear();
		Object.entries(preset.bindings).forEach(([command, binding]) => {
			const safeBinding: MouseBinding = { ...binding, command };
			this.setBinding(command, safeBinding);
		});

		if (this.config.debug) {
			console.log(`[MouseManager] Loaded preset: ${preset.name}`);
		}
	}

	getBindings(): MouseBindings {
		const bindings: MouseBindings = {};
		for (const [command, binding] of this.bindings) {
			bindings[command] = binding;
		}
		return bindings;
	}

	// ドラッグ状態管理
	isDragging(): boolean {
		return this.dragState !== null;
	}

	getDragState(): DragState | null {
		return this.dragState;
	}

	// MouseManager固有のメソッド
	handlePointerDown(event: PointerEvent): boolean {
		if (this.config.debug) {
			console.log("[MouseManager] Pointer down:", event);
		}

		// ドラッグ状態を開始
		const dragState: DragState = {
			startX: event.clientX,
			startY: event.clientY,
			button: event.button,
			modifiers: this.getModifiers(event),
		};
		this.dragState = dragState;

		const binding = this.findBinding("button", event.button, event);
		if (binding) {
			if (binding.action === "drag") {
				// ドラッグ開始コマンド
				return this.executeCommand(`${binding.command}:start`, event);
			}
			return this.executeCommand(binding.command, event);
		}
		return false;
	}

	handlePointerMove(event: PointerEvent): boolean {
		if (!this.isDragging()) return false;

		const dragState = this.getDragState();
		if (!dragState) return false;

		// ドラッグイベントを発行
		this.emit("drag", {
			startX: dragState.startX,
			startY: dragState.startY,
			currentX: event.clientX,
			currentY: event.clientY,
			deltaX: event.clientX - dragState.startX,
			deltaY: event.clientY - dragState.startY,
		});

		const binding = this.findBinding("button", dragState.button, event);
		if (binding && binding.action === "drag") {
			const panEvent: PanEvent = {
				originalEvent: event,
				deltaX: event.clientX - dragState.startX,
				deltaY: event.clientY - dragState.startY,
				clientX: event.clientX,
				clientY: event.clientY,
			};
			return this.executeCommand(`${binding.command}:move`, panEvent);
		}
		return false;
	}

	handlePointerUp(event: PointerEvent): boolean {
		const dragState = this.getDragState();
		if (dragState) {
			const binding = this.findBinding("button", dragState.button, event);
			if (binding && binding.action === "drag") {
				this.executeCommand(`${binding.command}:end`, event);
			}
			this.dragState = null;
		}
		return false;
	}

	handleWheel(event: WheelEvent): boolean {
		return this.throttledWheel(event);
	}

	private handleWheelInternal(event: WheelEvent): boolean {
		// ホイール方向の判定
		const direction = event.deltaY > 0 ? "down" : "up";
		const wheelBinding = this.findBinding("wheel", direction, event);

		if (wheelBinding) {
			return this.executeCommand(wheelBinding.command, event);
		}

		// ズームイベントを発行
		this.emit("zoom", {
			delta: event.deltaY * (this.config.sensitivity ?? 1.0),
			center: { x: event.clientX, y: event.clientY },
		});

		return false;
	}

	// ヘルパーメソッド
	private findBinding(
		type: "button" | "wheel" | "gesture",
		value: number | string | boolean,
		event?: MouseEvent | WheelEvent,
	): MouseBinding | undefined {
		for (const [, binding] of this.bindings) {
			// タイプチェック
			if (type === "button" && binding.button === undefined) continue;
			if (type === "wheel" && binding.wheel === undefined) continue;
			if (type === "gesture" && binding.gesture === undefined) continue;

			// 値のマッチング
			if (type === "button" && binding.button !== value) continue;
			if (type === "wheel") {
				if (typeof binding.wheel === "string" && binding.wheel !== value) continue;
				if (typeof binding.wheel === "boolean" && !binding.wheel) continue;
			}

			// 修飾キーのチェック
			if (event && !this.checkModifiers(binding.modifiers || [], event)) {
				continue;
			}

			return binding;
		}
		return undefined;
	}

	private checkModifiers(requiredModifiers: string[], event: MouseEvent | WheelEvent): boolean {
		const activeModifiers = this.getModifiers(event);

		// 必要な修飾キーがすべて押されているか
		for (const required of requiredModifiers) {
			if (!activeModifiers.includes(required)) {
				return false;
			}
		}

		// 余分な修飾キーがないか（厳密なマッチング）
		return activeModifiers.length === requiredModifiers.length;
	}

	private getModifiers(event: MouseEvent | KeyboardEvent): string[] {
		const modifiers: string[] = [];
		if (event.ctrlKey || event.metaKey) modifiers.push("mod");
		if (event.shiftKey) modifiers.push("shift");
		if (event.altKey) modifiers.push("alt");
		return modifiers;
	}

	override destroy(): void {
		super.destroy();
		this.dragState = null;
	}
}

// デフォルトエクスポート
export default MouseManagerRefactored;
export { MouseManagerRefactored as MouseManager };
