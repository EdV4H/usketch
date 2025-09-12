import type { Camera, Effect } from "@usketch/shared-types";
import type React from "react";

/**
 * Props passed to effect components
 */
export interface EffectComponentProps<T extends Effect = Effect> {
	effect: T;
	camera: Camera;
	onRemove?: () => void;
}

/**
 * Configuration for creating a default effect instance
 */
export interface CreateEffectProps {
	id: string;
	x: number;
	y: number;
	[key: string]: any;
}

/**
 * Effect plugin definition
 */
export interface EffectPlugin<T extends Effect = Effect> {
	type: string;
	name: string;
	component: React.ComponentType<EffectComponentProps<T>>;
	createDefaultEffect: (props: CreateEffectProps) => T;
	validate?: (effect: Effect) => boolean;
	interactive?: boolean;
	hitTest?: (effect: T, point: { x: number; y: number }) => boolean;
}

/**
 * Effect registry for managing plugins
 */
export class EffectRegistry {
	private plugins = new Map<string, EffectPlugin>();

	register<T extends Effect>(plugin: EffectPlugin<T>): void {
		if (this.plugins.has(plugin.type)) {
			console.warn(`Effect plugin "${plugin.type}" is already registered. Overwriting.`);
		}
		this.plugins.set(plugin.type, plugin as unknown as EffectPlugin);
	}

	unregister(type: string): boolean {
		return this.plugins.delete(type);
	}

	get(type: string): EffectPlugin | undefined {
		return this.plugins.get(type);
	}

	getAll(): EffectPlugin[] {
		return Array.from(this.plugins.values());
	}

	has(type: string): boolean {
		return this.plugins.has(type);
	}

	clear(): void {
		this.plugins.clear();
	}
}
