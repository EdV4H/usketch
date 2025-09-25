import type { MousePreset } from "@usketch/input-presets";
import type {
	CommandHandler,
	DragState,
	EventEmitter,
	MouseBinding,
	MouseConfig,
	PanEvent,
} from "../types";

/**
 * マウス入力管理クラス
 */
export class MouseManager implements EventEmitter {
	private bindings: Map<string, MouseBinding> = new Map();
	private commandHandlers: Map<string, CommandHandler> = new Map();
	private activeModifiers: Set<string> = new Set();
	private listeners: Map<string, Set<Function>> = new Map();
	private config: MouseConfig;
	private enabled = true;
	private dragState: DragState | null = null;

	constructor(config: MouseConfig = {}) {
		this.config = {
			invertPan: false,
			sensitivity: 1.0,
			...config,
		};

		if (config.preset) {
			this.loadPreset(config.preset);
		}

		if (config.customBindings) {
			this.setBindings(config.customBindings);
		}
	}

	/**
	 * プリセットを読み込む
	 */
	loadPreset(preset: MousePreset): void {
		Object.entries(preset.bindings).forEach(([command, binding]) => {
			this.setBinding(command, binding);
		});
	}

	/**
	 * マウスバインディングを設定
	 */
	setBinding(command: string, binding: MouseBinding): void {
		this.bindings.set(command, binding);
	}

	/**
	 * 複数のバインディングを一括設定
	 */
	setBindings(bindings: Record<string, MouseBinding>): void {
		Object.entries(bindings).forEach(([command, binding]) => {
			this.setBinding(command, binding);
		});
	}

	/**
	 * バインディングを削除
	 */
	removeBinding(command: string): void {
		this.bindings.delete(command);
	}

	/**
	 * コマンドハンドラーを登録
	 */
	registerCommand(name: string, handler: CommandHandler): void {
		this.commandHandlers.set(name, handler);
	}

	/**
	 * コマンドを実行
	 */
	executeCommand(command: string, event: MouseEvent | WheelEvent): boolean {
		const handler = this.commandHandlers.get(command);
		if (handler) {
			if (this.config.debug) {
				console.log(`[MouseManager] Executing command: ${command}`);
			}
			return handler(event);
		}
		return false;
	}

	/**
	 * マウスダウンイベントを処理
	 */
	handleMouseDown(event: PointerEvent): boolean {
		if (!this.enabled) return false;

		this.updateModifiers(event);

		// ドラッグ開始の準備
		this.dragState = {
			startX: event.clientX,
			startY: event.clientY,
			button: event.button,
			modifiers: Array.from(this.activeModifiers),
		};

		// クリック操作のコマンドを検索
		const command = this.findCommand({
			button: event.button,
			action: "click",
			modifiers: Array.from(this.activeModifiers),
		});

		if (command) {
			const result = this.executeCommand(command, event);
			if (result) {
				event.preventDefault();
				return true;
			}
		}

		return false;
	}

	/**
	 * マウスムーブイベントを処理
	 */
	handleMouseMove(event: PointerEvent): boolean {
		if (!this.enabled || !this.dragState) return false;

		this.updateModifiers(event);

		const deltaX = event.clientX - (this.dragState.lastX ?? this.dragState.startX);
		const deltaY = event.clientY - (this.dragState.lastY ?? this.dragState.startY);

		// ドラッグ操作のコマンドを検索
		const command = this.findCommand({
			button: this.dragState.button,
			action: "drag",
			modifiers: this.dragState.modifiers,
		});

		if (command) {
			// パンイベントを作成
			const panEvent: PanEvent = {
				originalEvent: event,
				deltaX: deltaX * this.config.sensitivity!,
				deltaY: deltaY * this.config.sensitivity!,
				clientX: event.clientX,
				clientY: event.clientY,
			};

			// カメラパン操作の場合、方向を反転
			if (command === "camera.pan" && this.config.invertPan) {
				panEvent.deltaX = -panEvent.deltaX;
				panEvent.deltaY = -panEvent.deltaY;
			}

			// パンイベントを発火
			this.emit(`${command}:move`, panEvent);

			// コマンドも実行
			const result = this.executeCommand(command, event);
			if (result) {
				event.preventDefault();
			}
		}

		// 最後の位置を更新
		this.dragState.lastX = event.clientX;
		this.dragState.lastY = event.clientY;

		return false;
	}

	/**
	 * マウスアップイベントを処理
	 */
	handleMouseUp(event: PointerEvent): boolean {
		if (!this.enabled) return false;

		this.updateModifiers(event);

		// ドラッグ終了イベントを発火
		if (this.dragState) {
			const command = this.findCommand({
				button: this.dragState.button,
				action: "drag",
				modifiers: this.dragState.modifiers,
			});

			if (command) {
				this.emit(`${command}:end`, event);
			}
		}

		// ドラッグ状態をクリア
		this.dragState = null;

		return false;
	}

	/**
	 * ホイールイベントを処理
	 */
	handleWheel(event: WheelEvent): boolean {
		if (!this.enabled) return false;

		this.updateModifiers(event);

		// ホイール操作のコマンドを検索
		const direction = event.deltaY > 0 ? "down" : "up";
		const command = this.findCommand({
			wheel: true,
			modifiers: Array.from(this.activeModifiers),
		});

		if (command) {
			// ホイールイベントデータを付与
			const wheelEvent = Object.assign({}, event, {
				direction,
				delta: Math.abs(event.deltaY),
			});

			this.emit(`${command}:wheel`, wheelEvent);

			const result = this.executeCommand(command, event);
			if (result) {
				event.preventDefault();
				return true;
			}
		}

		return false;
	}

	/**
	 * コンテキストメニューイベントを処理
	 */
	handleContextMenu(event: MouseEvent): boolean {
		if (!this.enabled) return false;

		// 右クリック操作のコマンドを検索
		const command = this.findCommand({
			button: 2,
			modifiers: Array.from(this.activeModifiers),
		});

		if (command) {
			const result = this.executeCommand(command, event);
			if (result) {
				event.preventDefault();
				return true;
			}
		}

		return false;
	}

	/**
	 * 修飾キーの状態を更新
	 */
	private updateModifiers(event: MouseEvent | WheelEvent): void {
		this.activeModifiers.clear();

		if (event.ctrlKey || event.metaKey) {
			this.activeModifiers.add("mod");
		}

		if (event.shiftKey) {
			this.activeModifiers.add("shift");
		}

		if (event.altKey) {
			this.activeModifiers.add("alt");
		}
	}

	/**
	 * バインディングに対応するコマンドを検索
	 */
	private findCommand(criteria: Partial<MouseBinding>): string | null {
		for (const [command, binding] of this.bindings) {
			// ボタンマッチ
			if (criteria.button !== undefined && binding.button !== criteria.button) {
				continue;
			}

			// アクションマッチ
			if (criteria.action && binding.action !== criteria.action) {
				continue;
			}

			// ホイールマッチ
			if (criteria.wheel !== undefined && !binding.wheel) {
				continue;
			}

			// 修飾キーマッチ
			if (criteria.modifiers) {
				const bindingModifiers = binding.modifiers ?? [];
				if (
					bindingModifiers.length !== criteria.modifiers.length ||
					!bindingModifiers.every((mod) => criteria.modifiers!.includes(mod))
				) {
					continue;
				}
			} else if (binding.modifiers && binding.modifiers.length > 0) {
				continue;
			}

			return command;
		}

		return null;
	}

	/**
	 * キーボードマネージャーからの修飾キー状態を受け取る
	 */
	syncModifiers(modifiers: Set<string>): void {
		this.activeModifiers = new Set(modifiers);
	}

	/**
	 * 現在の修飾キー状態を取得
	 */
	getActiveModifiers(): Set<string> {
		return new Set(this.activeModifiers);
	}

	/**
	 * イベントエミッター: イベントリスナーを登録
	 */
	on(event: string, handler: Function): void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		this.listeners.get(event)!.add(handler);
	}

	/**
	 * イベントエミッター: イベントリスナーを削除
	 */
	off(event: string, handler: Function): void {
		const handlers = this.listeners.get(event);
		if (handlers) {
			handlers.delete(handler);
		}
	}

	/**
	 * イベントエミッター: イベントを発火
	 */
	emit(event: string, data: any): void {
		const handlers = this.listeners.get(event);
		if (handlers) {
			handlers.forEach((handler) => {
				handler(data);
			});
		}
	}

	/**
	 * マネージャーを有効化
	 */
	enable(): void {
		this.enabled = true;
	}

	/**
	 * マネージャーを無効化
	 */
	disable(): void {
		this.enabled = false;
	}

	/**
	 * 現在のバインディングを取得
	 */
	getBindings(): Record<string, MouseBinding> {
		const result: Record<string, MouseBinding> = {};
		this.bindings.forEach((binding, command) => {
			result[command] = binding;
		});
		return result;
	}

	/**
	 * 設定を更新
	 */
	updateConfig(config: Partial<MouseConfig>): void {
		this.config = {
			...this.config,
			...config,
		};
	}
}
