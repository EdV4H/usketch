import type {
	CommandHandler,
	CommandRegistry,
	DragState,
	IMouseManager,
	MouseBinding,
	MouseBindings,
	MouseConfig,
	MousePreset,
	PanEvent,
} from "./types";
import { throttle } from "./utils/debounce";

export class MouseManager implements IMouseManager {
	private bindings: Map<string, MouseBinding>;
	private commandHandlers: CommandRegistry;
	private config: MouseConfig;
	private dragState: DragState | null = null;
	private listeners: Map<string, Set<(data: any) => void>>;
	private throttledWheel: (event: WheelEvent) => boolean;

	constructor(config?: MouseConfig) {
		this.bindings = new Map();
		this.commandHandlers = {};
		this.listeners = new Map();
		this.config = {
			sensitivity: 1.0,
			invertScroll: false,
			debug: false,
			...config,
		};

		if (config?.preset) {
			this.loadPreset(config.preset);
		}

		// ホイールイベントをスロットル化（16ms = 60fps）
		this.throttledWheel = throttle(this.handleWheelInternal.bind(this), 16);
	}

	initialize(config: MouseConfig): void {
		this.config = { ...this.config, ...config };

		if (config.preset) {
			this.loadPreset(config.preset);
		}
		if (config.customBindings) {
			// 型変換：commandフィールドを追加
			const safeBindings: MouseBindings = {};
			Object.entries(config.customBindings).forEach(([command, binding]) => {
				safeBindings[command] = { ...binding, command };
			});
			this.setBindings(safeBindings);
		}
	}

	setBinding(command: string, binding: MouseBinding): void {
		this.bindings.set(command, { ...binding, command });
		if (this.config.debug) {
			console.log(`[MouseManager] Binding set: ${command}`, binding);
		}
	}

	setBindings(bindings: MouseBindings): void {
		Object.entries(bindings).forEach(([command, binding]) => {
			this.setBinding(command, binding);
		});
	}

	removeBinding(command: string): void {
		this.bindings.delete(command);
	}

	getBindings(): MouseBindings {
		const bindings: MouseBindings = {};
		for (const [command, binding] of this.bindings) {
			bindings[command] = binding;
		}
		return bindings;
	}

	loadPreset(preset: MousePreset): void {
		// 既存のバインディングをクリア
		this.bindings.clear();

		// プリセットのバインディングを設定（commandフィールドを追加）
		Object.entries(preset.bindings).forEach(([command, binding]) => {
			this.setBinding(command, { ...binding, command });
		});

		if (this.config.debug) {
			console.log(`[MouseManager] Loaded preset: ${preset.name}`);
		}
	}

	registerCommand(name: string, handler: CommandHandler): void {
		this.commandHandlers[name] = handler;
		if (this.config.debug) {
			console.log(`[MouseManager] Command registered: ${name}`);
		}
	}

	unregisterCommand(name: string): void {
		delete this.commandHandlers[name];
	}

	executeCommand(command: string, event: MouseEvent | WheelEvent | PanEvent): boolean {
		const handler = this.commandHandlers[command];
		if (handler) {
			const result = handler(event);
			if (this.config.debug) {
				console.log(`[MouseManager] Command executed: ${command} -> ${result}`);
			}
			return result;
		}
		return false;
	}

	handlePointerDown(event: PointerEvent): boolean {
		// ドラッグ操作の開始を記録
		this.dragState = {
			startX: event.clientX,
			startY: event.clientY,
			button: event.button,
			modifiers: this.getModifiers(event),
		};

		const binding = this.findBinding("button", event.button, event);
		if (binding) {
			if (binding.action === "drag") {
				// ドラッグ開始コマンドを実行
				return this.executeCommand(`${binding.command}:start`, event);
			}
			return this.executeCommand(binding.command, event);
		}
		return false;
	}

	handlePointerMove(event: PointerEvent): boolean {
		if (!this.dragState) return false;

		const binding = this.findBinding("button", this.dragState.button, event);
		if (binding && binding.action === "drag") {
			// PanEventタイプで一貫性を保つ
			const panEvent: PanEvent = {
				originalEvent: event,
				deltaX: event.clientX - this.dragState.startX,
				deltaY: event.clientY - this.dragState.startY,
				clientX: event.clientX,
				clientY: event.clientY,
			};
			return this.executeCommand(`${binding.command}:move`, panEvent);
		}
		return false;
	}

	handlePointerUp(event: PointerEvent): boolean {
		if (this.dragState) {
			const binding = this.findBinding("button", this.dragState.button, event);
			if (binding && binding.action === "drag") {
				this.executeCommand(`${binding.command}:end`, event);
			}
			this.dragState = null;
		}
		return false;
	}

	handleWheel(event: WheelEvent): boolean {
		// スロットル化されたハンドラーを呼び出し
		return this.throttledWheel(event);
	}

	private handleWheelInternal(event: WheelEvent): boolean {
		// スクロール方向の判定
		let direction: "up" | "down";
		if (this.config.invertScroll) {
			direction = event.deltaY > 0 ? "up" : "down";
		} else {
			direction = event.deltaY > 0 ? "down" : "up";
		}

		const binding = this.findBinding("wheel", direction, event);
		if (binding) {
			return this.executeCommand(binding.command, event);
		}

		// 一般的なwheel bindingも確認
		const wheelBinding = this.findBinding("wheel", true, event);
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

	destroy(): void {
		this.bindings.clear();
		this.commandHandlers = {};
		this.listeners.clear();
		this.dragState = null;
	}

	// ヘルパーメソッド
	private findBinding(
		type: "button" | "wheel" | "gesture",
		value: number | string | boolean,
		event?: MouseEvent | WheelEvent,
	): MouseBinding | undefined {
		for (const [, binding] of this.bindings) {
			// タイプが違う場合はスキップ
			if (type === "button" && binding.button === undefined) continue;
			if (type === "wheel" && binding.wheel === undefined) continue;
			if (type === "gesture" && binding.gesture === undefined) continue;

			// 値の一致確認
			if (type === "button" && binding.button !== value) continue;
			if (type === "wheel" && typeof binding.wheel === "string" && binding.wheel !== value)
				continue;
			if (type === "wheel" && typeof binding.wheel === "boolean" && binding.wheel !== true)
				continue;

			// 修飾キーの確認
			if (event && !this.checkModifiers(binding.modifiers || [], event)) {
				continue;
			}

			return binding;
		}

		return undefined;
	}

	private checkModifiers(requiredModifiers: string[], event: MouseEvent | WheelEvent): boolean {
		const activeModifiers = this.getModifiers(event);

		// 要求される修飾キーが全て押されているかチェック
		for (const required of requiredModifiers) {
			if (!activeModifiers.includes(required)) {
				return false;
			}
		}

		// 余分な修飾キーがないかチェック（厳密なマッチング）
		if (activeModifiers.length !== requiredModifiers.length) {
			return false;
		}

		return true;
	}

	/**
	 * 修飾キーの状態を取得
	 * 'mod'はプラットフォーム非依存の抽象化キー：
	 * - macOS: Cmd (metaKey)
	 * - Windows/Linux: Ctrl (ctrlKey)
	 */
	private getModifiers(event: MouseEvent | KeyboardEvent): string[] {
		const modifiers: string[] = [];
		if (event.ctrlKey || event.metaKey) modifiers.push("mod"); // プラットフォーム非依存
		if (event.shiftKey) modifiers.push("shift");
		if (event.altKey) modifiers.push("alt");
		return modifiers;
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

	private emit(event: string, data: any): void {
		this.listeners.get(event)?.forEach((listener) => {
			listener(data);
		});
	}

	// 公開メソッド
	getActiveBindings(): MouseBinding[] {
		return Array.from(this.bindings.values());
	}

	isDragging(): boolean {
		return this.dragState !== null;
	}

	getDragState(): DragState | null {
		return this.dragState;
	}
}
