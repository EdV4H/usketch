import type {
	CommandHandler,
	CommandRegistry,
	IKeyboardManager,
	KeyBinding,
	KeyBindings,
	KeyboardConfig,
	KeyboardContext,
	KeyboardPreset,
} from "./types";

export class KeyboardManager implements IKeyboardManager {
	private bindings: Map<string, KeyBinding>;
	private contexts: Map<string, KeyboardContext>;
	private activeContext: string = "default";
	private commandHandlers: CommandRegistry;
	private config: KeyboardConfig;
	private listeners: Map<string, Set<(data: any) => void>>;
	private pressedKeys: Set<string>;

	constructor(config?: KeyboardConfig) {
		this.bindings = new Map();
		this.contexts = new Map();
		this.commandHandlers = {};
		this.listeners = new Map();
		this.pressedKeys = new Set();
		this.config = {
			enableInInput: false,
			debug: false,
			...config,
		};

		if (config?.preset) {
			this.loadPreset(config.preset);
		}

		// デフォルトコンテキストを作成
		this.contexts.set("default", {
			name: "default",
			priority: 0,
		});
	}

	initialize(config: KeyboardConfig): void {
		this.config = { ...this.config, ...config };

		if (config.preset) {
			this.loadPreset(config.preset);
		}
		if (config.customBindings) {
			this.setBindings(config.customBindings);
		}
	}

	setBinding(command: string, keys: string[]): void {
		this.bindings.set(command, { command, keys });
		if (this.config.debug) {
			console.log(`[KeyboardManager] Binding set: ${command} -> ${keys.join(", ")}`);
		}
	}

	setBindings(bindings: KeyBindings): void {
		Object.entries(bindings).forEach(([command, keys]) => {
			this.setBinding(command, keys);
		});
	}

	removeBinding(command: string): void {
		this.bindings.delete(command);
	}

	loadPreset(preset: KeyboardPreset): void {
		// 既存のバインディングをクリア
		this.bindings.clear();

		// プリセットのバインディングを設定
		Object.entries(preset.bindings).forEach(([command, keys]) => {
			this.setBinding(command, keys);
		});

		if (this.config.debug) {
			console.log(`[KeyboardManager] Loaded preset: ${preset.name}`);
		}
	}

	pushContext(name: string, bindings?: KeyBindings): void {
		const priority = this.contexts.size;
		this.contexts.set(name, {
			name,
			bindings,
			priority,
		});
		this.activeContext = name;
	}

	popContext(): void {
		if (this.activeContext !== "default") {
			this.contexts.delete(this.activeContext);
			// 最も優先度の高いコンテキストを見つける
			let maxPriority = -1;
			let newContext = "default";

			for (const [name, context] of this.contexts) {
				if (context.priority > maxPriority) {
					maxPriority = context.priority;
					newContext = name;
				}
			}

			this.activeContext = newContext;
		}
	}

	registerCommand(name: string, handler: CommandHandler): void {
		this.commandHandlers[name] = handler;
		if (this.config.debug) {
			console.log(`[KeyboardManager] Command registered: ${name}`);
		}
	}

	unregisterCommand(name: string): void {
		delete this.commandHandlers[name];
	}

	executeCommand(command: string, event: KeyboardEvent): boolean {
		const handler = this.commandHandlers[command];
		if (handler) {
			const result = handler(event);
			if (this.config.debug) {
				console.log(`[KeyboardManager] Command executed: ${command} -> ${result}`);
			}
			return result;
		}
		return false;
	}

	handleKeyDown(event: KeyboardEvent): boolean {
		// 入力フィールド内でのキーボード操作を無視する設定
		if (!this.config.enableInInput && this.isInputElement(event.target)) {
			return false;
		}

		const key = this.normalizeKey(event);
		this.pressedKeys.add(key);

		// スペースキーの特別処理
		if (event.key === " " || event.key === "Space") {
			this.emit("space:down", event);
		}

		const command = this.findCommand(key);

		if (command) {
			event.preventDefault();
			return this.executeCommand(command, event);
		}

		return false;
	}

	handleKeyUp(event: KeyboardEvent): boolean {
		const key = this.normalizeKey(event);
		this.pressedKeys.delete(key);

		// スペースキーの特別処理
		if (event.key === " " || event.key === "Space") {
			this.emit("space:up", event);
		}

		return false;
	}

	destroy(): void {
		this.bindings.clear();
		this.contexts.clear();
		this.commandHandlers = {};
		this.listeners.clear();
		this.pressedKeys.clear();
	}

	// ヘルパーメソッド
	private normalizeKey(event: KeyboardEvent): string {
		const parts: string[] = [];

		// プラットフォーム非依存の修飾キー
		if (event.ctrlKey || event.metaKey) parts.push("mod");
		if (event.shiftKey) parts.push("shift");
		if (event.altKey) parts.push("alt");

		// キーを小文字に正規化
		let key = event.key.toLowerCase();

		// 特殊キーの正規化
		const keyMap: Record<string, string> = {
			" ": "space",
			arrowup: "ArrowUp",
			arrowdown: "ArrowDown",
			arrowleft: "ArrowLeft",
			arrowright: "ArrowRight",
			enter: "Enter",
			escape: "Escape",
			delete: "Delete",
			backspace: "Backspace",
			tab: "Tab",
		};

		key = keyMap[key] || key;
		parts.push(key);

		return parts.join("+");
	}

	private findCommand(key: string): string | undefined {
		// 現在のコンテキストのバインディングを優先
		const context = this.contexts.get(this.activeContext);
		if (context?.bindings) {
			for (const [command, keys] of Object.entries(context.bindings)) {
				if (keys.includes(key)) {
					return command;
				}
			}
		}

		// グローバルバインディングを検索
		for (const [command, binding] of this.bindings) {
			if (binding.keys.includes(key)) {
				return command;
			}
		}

		return undefined;
	}

	private isInputElement(target: EventTarget | null): boolean {
		if (!target || !(target instanceof HTMLElement)) return false;

		const tagName = target.tagName.toLowerCase();
		const editableElements = ["input", "textarea", "select"];

		return (
			editableElements.includes(tagName) ||
			target.contentEditable === "true" ||
			target.getAttribute("role") === "textbox"
		);
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
	isKeyPressed(key: string): boolean {
		return this.pressedKeys.has(key);
	}

	getActiveBindings(): KeyBinding[] {
		return Array.from(this.bindings.values());
	}

	getActiveContext(): string {
		return this.activeContext;
	}
}
