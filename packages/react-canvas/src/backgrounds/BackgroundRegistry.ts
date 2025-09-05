import type {
	BackgroundComponent,
	BackgroundRegistry as IBackgroundRegistry,
} from "@usketch/shared-types";

/**
 * 背景コンポーネントのレジストリ
 * IDベースで背景コンポーネントを管理
 */
export class BackgroundRegistry implements IBackgroundRegistry {
	private backgrounds = new Map<string, BackgroundComponent>();
	private lazyBackgrounds = new Map<string, () => Promise<{ default: BackgroundComponent }>>();

	/**
	 * 背景コンポーネントを登録
	 */
	register(id: string, component: BackgroundComponent): void {
		if (this.backgrounds.has(id)) {
			console.warn(`Background with id "${id}" is already registered. Overwriting.`);
		}
		this.backgrounds.set(id, component);
	}

	/**
	 * 背景コンポーネントを遅延登録
	 */
	registerLazy(id: string, loader: () => Promise<{ default: BackgroundComponent }>): void {
		if (this.lazyBackgrounds.has(id)) {
			console.warn(`Lazy background with id "${id}" is already registered. Overwriting.`);
		}
		this.lazyBackgrounds.set(id, loader);
	}

	/**
	 * 複数の背景を一括登録
	 */
	registerMultiple(backgrounds: Record<string, BackgroundComponent>): void {
		for (const [id, component] of Object.entries(backgrounds)) {
			this.register(id, component);
		}
	}

	/**
	 * IDから背景コンポーネントを取得
	 */
	get(id: string): BackgroundComponent | undefined {
		return this.backgrounds.get(id);
	}

	/**
	 * IDから背景コンポーネントを非同期で取得（遅延読み込み対応）
	 */
	async getAsync(id: string): Promise<BackgroundComponent | undefined> {
		// 既に登録済みの場合
		const component = this.backgrounds.get(id);
		if (component) {
			return component;
		}

		// 遅延登録の場合
		const loader = this.lazyBackgrounds.get(id);
		if (loader) {
			try {
				const module = await loader();
				const loadedComponent = module.default;
				// 読み込み後はキャッシュ
				this.backgrounds.set(id, loadedComponent);
				this.lazyBackgrounds.delete(id);
				return loadedComponent;
			} catch (error) {
				console.error(`Failed to load background "${id}":`, error);
				return undefined;
			}
		}

		return undefined;
	}

	/**
	 * 登録されている背景IDのリストを取得
	 */
	list(): string[] {
		return [...Array.from(this.backgrounds.keys()), ...Array.from(this.lazyBackgrounds.keys())];
	}

	/**
	 * 特定のプレフィックスを持つ背景IDのリストを取得
	 */
	listByPrefix(prefix: string): string[] {
		return this.list().filter((id) => id.startsWith(prefix));
	}

	/**
	 * 背景が登録されているか確認
	 */
	has(id: string): boolean {
		return this.backgrounds.has(id) || this.lazyBackgrounds.has(id);
	}

	/**
	 * 背景の登録を解除
	 */
	unregister(id: string): void {
		this.backgrounds.delete(id);
		this.lazyBackgrounds.delete(id);
	}

	/**
	 * すべての登録をクリア
	 */
	clear(): void {
		this.backgrounds.clear();
		this.lazyBackgrounds.clear();
	}

	/**
	 * レジストリのクローンを作成
	 */
	clone(): BackgroundRegistry {
		const clone = new BackgroundRegistry();
		for (const [id, component] of this.backgrounds) {
			clone.register(id, component);
		}
		for (const [id, loader] of this.lazyBackgrounds) {
			clone.registerLazy(id, loader);
		}
		return clone;
	}
}

// グローバルシングルトンインスタンス
export const globalBackgroundRegistry = new BackgroundRegistry();
