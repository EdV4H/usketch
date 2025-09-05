import type { BackgroundComponent } from "./types";

/**
 * BackgroundRegistryのインターフェース
 * 実装はreact-canvasパッケージにあるが、循環依存を避けるためインターフェースのみ定義
 */
export interface BackgroundRegistry {
	register(id: string, component: BackgroundComponent): void;
	registerMultiple(backgrounds: Record<string, BackgroundComponent>): void;
	get(id: string): BackgroundComponent | undefined;
	has(id: string): boolean;
}
