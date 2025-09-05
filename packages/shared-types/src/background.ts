import type React from "react";

// Camera type (index.tsで定義されているものと同じ)
interface Camera {
	x: number;
	y: number;
	zoom: number;
}

/**
 * 背景コンポーネントのprops
 */
export interface BackgroundComponentProps {
	camera: Camera;
	config?: any;
}

/**
 * 背景コンポーネントの型
 */
export type BackgroundComponent = React.FC<BackgroundComponentProps>;

/**
 * BackgroundRegistryのインターフェース
 * 背景コンポーネントの登録と管理を行う
 */
export interface BackgroundRegistry {
	register(id: string, component: BackgroundComponent): void;
	registerMultiple(backgrounds: Record<string, BackgroundComponent>): void;
	get(id: string): BackgroundComponent | undefined;
	getAsync(id: string): Promise<BackgroundComponent | undefined>;
	has(id: string): boolean;
	list(): string[];
	listByPrefix(prefix: string): string[];
	unregister(id: string): void;
	clear(): void;
	clone(): BackgroundRegistry;
	registerLazy(id: string, loader: () => Promise<{ default: BackgroundComponent }>): void;
}
