export interface OverlayColors {
	/** 選択枠・ハンドルの線色。CSS 変数（例 `var(--colors-primary)`）も可。 */
	strokeColor: string;
	/** リサイズ/回転ハンドルの塗り色。 */
	handleFillColor: string;
}

const DEFAULTS: OverlayColors = { strokeColor: "#2680eb", handleFillColor: "#ffffff" };

/**
 * オーバーレイ色のストア。**setup（インスタンス）スコープ**で生成する。
 * モジュール共有にすると、複数 App 同時生成（StrictMode / 非同期 createApp）で
 * あるインスタンスの teardown が生存中の別インスタンスの色を壊す（#640）。
 * snap プラグインの `settings` クロージャと同様に per-setup で保持する。
 */
export interface OverlayColorStore {
	getSnapshot(): OverlayColors;
	subscribe(listener: () => void): () => void;
	/** 部分更新。未指定/undefined のキーは保持。 */
	set(patch: Partial<OverlayColors> | undefined): void;
}

export function createOverlayColorStore(initial?: Partial<OverlayColors>): OverlayColorStore {
	let colors: OverlayColors = { ...DEFAULTS };
	const listeners = new Set<() => void>();

	const store: OverlayColorStore = {
		getSnapshot: () => colors,
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		set(patch) {
			if (!patch) return;
			const next = { ...colors };
			if (patch.strokeColor != null) next.strokeColor = patch.strokeColor;
			if (patch.handleFillColor != null) next.handleFillColor = patch.handleFillColor;
			colors = next;
			for (const l of listeners) l();
		},
	};
	store.set(initial);
	return store;
}
