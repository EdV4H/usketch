import type { KeyboardPreset } from "@usketch/input-presets";
import type { CommandHandler, EventEmitter, KeyBinding, KeyboardConfig } from "../types";

/**
 * キーボード入力管理クラス
 */
export class KeyboardManager implements EventEmitter {
	private bindings: Map<string, KeyBinding> = new Map();
	private commandHandlers: Map<string, CommandHandler> = new Map();
	private activeModifiers: Set<string> = new Set();
	private listeners: Map<string, Set<Function>> = new Map();
	private config: KeyboardConfig;
	private enabled = true;

	constructor(config: KeyboardConfig = {}) {
		this.config = config;

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
	loadPreset(preset: KeyboardPreset): void {
		Object.entries(preset.bindings).forEach(([command, keys]) => {
			this.setBinding(command, keys);
		});
	}

	/**
	 * キーバインディングを設定
	 */
	setBinding(command: string, keys: string[]): void {
		this.bindings.set(command, {
			command,
			keys,
		});
	}

	/**
	 * 複数のバインディングを一括設定
	 */
	setBindings(bindings: Record<string, string[]>): void {
		Object.entries(bindings).forEach(([command, keys]) => {
			this.setBinding(command, keys);
		});
	}

	/**
	 * キーバインディングを削除
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
	executeCommand(command: string, event: KeyboardEvent): boolean {
		const handler = this.commandHandlers.get(command);
		if (handler) {
			if (this.config.debug) {
				console.log(`[KeyboardManager] Executing command: ${command}`);
			}
			return handler(event);
		}
		return false;
	}

	/**
	 * キーボードイベントを処理
	 */
	handleKeyDown(event: KeyboardEvent): boolean {
		if (!this.enabled) return false;

		// 入力フィールドでの動作制御
		if (!this.config.enableInInput) {
			const target = event.target as HTMLElement;
			if (
				target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.contentEditable === "true"
			) {
				return false;
			}
		}

		const key = this.normalizeKey(event);

		// 修飾キーの状態を更新
		this.updateModifiers(event);

		// 特殊キーのイベントを発火
		if (event.key === " ") {
			this.emit("space:down", event);
		}

		// マッチするコマンドを検索
		const command = this.findCommand(key);

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
	 * キーボードイベントを処理（キー離し）
	 */
	handleKeyUp(event: KeyboardEvent): boolean {
		if (!this.enabled) return false;

		// 修飾キーの状態を更新
		this.updateModifiers(event);

		// 特殊キーのイベントを発火
		if (event.key === " ") {
			this.emit("space:up", event);
		}

		return false;
	}

	/**
	 * キーを正規化
	 */
	private normalizeKey(event: KeyboardEvent): string {
		const parts: string[] = [];

		// プラットフォーム非依存の修飾キー
		if (event.ctrlKey || event.metaKey) {
			parts.push("mod");
		}

		if (event.shiftKey) {
			parts.push("shift");
		}

		if (event.altKey) {
			parts.push("alt");
		}

		// キー本体
		const key = event.key.toLowerCase();
		parts.push(key);

		return parts.join("+");
	}

	/**
	 * 修飾キーの状態を更新
	 */
	private updateModifiers(event: KeyboardEvent): void {
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

		if (event.key === " ") {
			if (event.type === "keydown") {
				this.activeModifiers.add("space");
			} else {
				this.activeModifiers.delete("space");
			}
		}
	}

	/**
	 * キーに対応するコマンドを検索
	 */
	private findCommand(key: string): string | null {
		for (const [command, binding] of this.bindings) {
			if (binding.keys.includes(key)) {
				return command;
			}
		}
		return null;
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
	getBindings(): Record<string, string[]> {
		const result: Record<string, string[]> = {};
		this.bindings.forEach((binding, command) => {
			result[command] = binding.keys;
		});
		return result;
	}
}
