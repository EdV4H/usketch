import { BaseInputManager, ContextMixin } from "./base-manager";
import type { KeyBindings, KeyboardConfig, KeyboardPreset } from "./types";
import type { IUnifiedKeyboardManager } from "./types/unified-types";
import { ScreenReaderAnnouncer } from "./utils/accessibility";

/**
 * KeyboardManager
 * BaseInputManagerとContextMixinを使用した実装
 */
export class KeyboardManager
	extends BaseInputManager<KeyboardConfig, string[], KeyBindings, KeyboardPreset, KeyboardEvent>
	implements IUnifiedKeyboardManager
{
	private contextMixin = new ContextMixin();
	private modifierState = new Map<string, boolean>();
	private announcer?: ScreenReaderAnnouncer;
	private commandCache = new WeakMap<KeyboardEvent, Set<string>>();

	constructor(config?: Partial<KeyboardConfig>) {
		super(config);
		if (config?.preset) {
			this.loadPreset(config.preset);
		}
		if (config?.enableAccessibility) {
			this.announcer = new ScreenReaderAnnouncer();
		}
		this.initialize(this.config);
	}

	getDefaultConfig(): KeyboardConfig {
		return {
			debug: false,
			enableAccessibility: false,
		};
	}

	initialize(config: KeyboardConfig): void {
		this.config = { ...this.config, ...config };
		if (config.preset) {
			this.loadPreset(config.preset);
		}
		if (config.customBindings) {
			Object.entries(config.customBindings).forEach(([command, keys]) => {
				this.setBinding(command, keys);
			});
		}
	}

	loadPreset(preset: KeyboardPreset): void {
		this.bindings.clear();
		Object.entries(preset.bindings).forEach(([command, keys]) => {
			this.setBinding(command, keys);
		});

		if (this.config.debug) {
			console.log(`[KeyboardManager] Loaded preset: ${preset.name}`);
		}
	}

	getBindings(): KeyBindings {
		const bindings: KeyBindings = {};
		for (const [command, keys] of this.bindings) {
			bindings[command] = keys;
		}
		return bindings;
	}

	// Context管理のデリゲート
	pushContext(name: string, bindings?: KeyBindings): void {
		this.contextMixin.pushContext(name, bindings);
		if (this.config.debug) {
			console.log(`[KeyboardManager] Pushed context: ${name}`);
		}
	}

	popContext(): void {
		this.contextMixin.popContext();
		if (this.config.debug) {
			console.log("[KeyboardManager] Popped context");
		}
	}

	// KeyboardManager固有のメソッド
	handleKeyDown(event: KeyboardEvent): boolean {
		// キャッシュチェック
		if (this.commandCache.has(event)) {
			const cachedCommands = this.commandCache.get(event);
			if (cachedCommands?.size) {
				for (const command of cachedCommands) {
					if (this.executeCommand(command, event)) {
						return true;
					}
				}
			}
			return false;
		}

		const key = this.normalizeKey(event);
		this.updateModifierState(key, true);

		// スペースキーのイベントを発火
		if (key === "space") {
			this.emit("space:down", event);
		}

		// コンテキスト内のバインディングを優先
		const context = this.contextMixin.getCurrentContext();
		if (context?.bindings) {
			for (const [command, keys] of context.bindings) {
				if (this.matchesBinding(event, keys as string[])) {
					this.announceCommand(command);
					return this.executeCommand(command, event);
				}
			}
		}

		// グローバルバインディングをチェック
		const matchedCommands = new Set<string>();
		for (const [command, binding] of this.bindings) {
			// bindingはstring[]型
			const keys = binding as string[];
			if (this.matchesBinding(event, keys)) {
				matchedCommands.add(command);
				this.announceCommand(command);
				if (this.executeCommand(command, event)) {
					this.commandCache.set(event, matchedCommands);
					return true;
				}
			}
		}

		this.commandCache.set(event, matchedCommands);
		return false;
	}

	handleKeyUp(event: KeyboardEvent): boolean {
		const key = this.normalizeKey(event);
		this.updateModifierState(key, false);

		// スペースキーのイベントを発火
		if (key === "space") {
			this.emit("space:up", event);
		}

		return false;
	}

	isModifierActive(modifier: string): boolean {
		return this.modifierState.get(modifier) || false;
	}

	// ヘルパーメソッド
	private normalizeKey(event: KeyboardEvent): string {
		const key = event.key.toLowerCase();
		return key === " " ? "space" : key;
	}

	private updateModifierState(key: string, pressed: boolean): void {
		const modifierMap: Record<string, string> = {
			control: "ctrl",
			meta: "cmd",
			alt: "alt",
			shift: "shift",
		};

		const modifier = modifierMap[key];
		if (modifier) {
			this.modifierState.set(modifier, pressed);
		}
	}

	private matchesBinding(event: KeyboardEvent, keys: string[]): boolean {
		const pressedKey = this.normalizeKey(event);
		const modifiers = this.getModifiers(event);

		for (const binding of keys) {
			const parts = binding.toLowerCase().split("+");
			const bindingKey = parts[parts.length - 1];
			const bindingModifiers = parts.slice(0, -1);

			if (bindingKey !== pressedKey) continue;

			// 修飾キーのマッチング
			const requiredMods = new Set(bindingModifiers);
			const activeMods = new Set(modifiers);

			// "mod"をプラットフォーム依存のキーに変換
			if (requiredMods.has("mod")) {
				requiredMods.delete("mod");
				// metaKeyが押されている場合はcmd、ctrlKeyが押されている場合はctrlとして扱う
				if (event.metaKey) {
					requiredMods.add("cmd");
				} else if (event.ctrlKey) {
					requiredMods.add("ctrl");
				}
			}

			if (requiredMods.size !== activeMods.size) continue;

			let allMatch = true;
			for (const mod of requiredMods) {
				if (!activeMods.has(mod)) {
					allMatch = false;
					break;
				}
			}

			if (allMatch) return true;
		}

		return false;
	}

	private getModifiers(event: KeyboardEvent): string[] {
		const modifiers: string[] = [];
		if (event.ctrlKey) modifiers.push("ctrl");
		if (event.metaKey) modifiers.push("cmd");
		if (event.altKey) modifiers.push("alt");
		if (event.shiftKey) modifiers.push("shift");
		return modifiers;
	}

	private announceCommand(command: string): void {
		if (this.announcer) {
			const message = `${command.replace(/([A-Z])/g, " $1").toLowerCase()} activated`;
			this.announcer.announce(message);
		}
	}

	override destroy(): void {
		super.destroy();
		this.contextMixin.clearContexts();
		this.modifierState.clear();
		this.commandCache = new WeakMap();
		this.announcer?.destroy();
	}
}

// デフォルトエクスポート
export default KeyboardManager;
