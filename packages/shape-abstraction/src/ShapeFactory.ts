import type { BaseShapeConfig, ShapeRenderer, ShapeRendererConstructor } from "./types";

// Minimal shape interface
interface MinimalShape {
	id: string;
	type: string;
	x: number;
	y: number;
}

export class ShapeFactory {
	private static renderers = new Map<string, ShapeRendererConstructor>();

	static register<T extends MinimalShape = MinimalShape>(
		type: string,
		RendererClass: ShapeRendererConstructor<T>,
	): void {
		ShapeFactory.renderers.set(type, RendererClass as ShapeRendererConstructor);
	}

	static unregister(type: string): boolean {
		return ShapeFactory.renderers.delete(type);
	}

	static create<T extends MinimalShape = MinimalShape>(
		shape: T,
		config?: Partial<BaseShapeConfig<T>>,
	): ShapeRenderer<T> {
		const RendererClass = ShapeFactory.renderers.get(shape.type);

		if (!RendererClass) {
			throw new Error(`Unknown shape type: ${shape.type}. Did you forget to register it?`);
		}

		const fullConfig: BaseShapeConfig<T> = {
			type: shape.type,
			renderMode: config?.renderMode || "svg",
			enableInteractivity: config?.enableInteractivity || false,
			...config,
		};

		return new RendererClass(shape, fullConfig) as ShapeRenderer<T>;
	}

	static has(type: string): boolean {
		return ShapeFactory.renderers.has(type);
	}

	static getRegisteredTypes(): string[] {
		return Array.from(ShapeFactory.renderers.keys());
	}

	static clear(): void {
		ShapeFactory.renderers.clear();
	}
}
