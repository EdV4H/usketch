import type { BaseShape, Point } from "@usketch/shared-types";
import type { RegistryEvent, RegistryEventListener, ShapePlugin } from "./types";

/**
 * Shape Registry for managing shape plugins
 */
export class ShapeRegistry {
	private plugins = new Map<string, ShapePlugin>();
	private listeners = new Set<RegistryEventListener>();

	/**
	 * Register a shape plugin
	 */
	register<T extends BaseShape = BaseShape>(plugin: ShapePlugin<T>): void {
		if (!plugin.type) {
			throw new Error("Plugin must have a 'type' property");
		}

		if (this.plugins.has(plugin.type)) {
			console.warn(`Plugin for type '${plugin.type}' is already registered. Overwriting.`);
		}

		// Use type assertion to handle generic variance
		this.plugins.set(plugin.type, plugin as any);
		this.emit({
			type: "register",
			shapeType: plugin.type,
			plugin: plugin as any,
		});
	}

	/**
	 * Unregister a shape plugin
	 */
	unregister(type: string): void {
		const plugin = this.plugins.get(type);
		if (plugin) {
			this.plugins.delete(type);
			this.emit({
				type: "unregister",
				shapeType: type,
				plugin,
			});
		}
	}

	/**
	 * Get a shape plugin by type
	 */
	getPlugin(type: string): ShapePlugin | undefined {
		return this.plugins.get(type);
	}

	/**
	 * Get all registered plugins
	 */
	getAllPlugins(): ShapePlugin[] {
		return Array.from(this.plugins.values());
	}

	/**
	 * Get all registered shape types
	 */
	getRegisteredTypes(): string[] {
		return Array.from(this.plugins.keys());
	}

	/**
	 * Check if a shape type is registered
	 */
	hasPlugin(type: string): boolean {
		return this.plugins.has(type);
	}

	/**
	 * Clear all registered plugins
	 */
	clear(): void {
		const types = this.getRegisteredTypes();
		types.forEach((type) => {
			this.unregister(type);
		});
	}

	/**
	 * Register multiple plugins at once
	 */
	registerMultiple(plugins: ShapePlugin[]): void {
		plugins.forEach((plugin) => {
			this.register(plugin);
		});
	}

	/**
	 * Add an event listener
	 */
	addEventListener(listener: RegistryEventListener): () => void {
		this.listeners.add(listener);

		// Return unsubscribe function
		return () => {
			this.listeners.delete(listener);
		};
	}

	/**
	 * Remove an event listener
	 */
	removeEventListener(listener: RegistryEventListener): void {
		this.listeners.delete(listener);
	}

	/**
	 * Emit an event to all listeners
	 */
	private emit(event: RegistryEvent): void {
		this.listeners.forEach((listener) => {
			try {
				listener(event);
			} catch (error) {
				console.error("Error in registry event listener:", error);
			}
		});
	}

	/**
	 * Create a default shape using the registered plugin
	 */
	createShape(type: string, props: any): BaseShape | null {
		const plugin = this.getPlugin(type);
		if (!plugin) {
			console.warn(`No plugin registered for shape type: ${type}`);
			return null;
		}

		return plugin.createDefaultShape(props);
	}

	/**
	 * Validate a shape using its plugin validator
	 */
	validateShape(shape: BaseShape): boolean {
		const plugin = this.getPlugin(shape.type);
		if (!plugin) {
			return false;
		}

		if (plugin.validate) {
			return plugin.validate(shape);
		}

		// Default validation: check required properties
		return !!(shape.id && shape.type && typeof shape.x === "number" && typeof shape.y === "number");
	}

	/**
	 * Clone the registry (useful for testing or creating isolated instances)
	 */
	clone(): ShapeRegistry {
		const newRegistry = new ShapeRegistry();
		this.plugins.forEach((plugin, type) => {
			newRegistry.plugins.set(type, plugin);
		});
		return newRegistry;
	}

	/**
	 * Get registry statistics
	 */
	getStats(): {
		totalPlugins: number;
		registeredTypes: string[];
		hasToolSupport: string[];
		hasSerializationSupport: string[];
	} {
		const registeredTypes = this.getRegisteredTypes();
		const hasToolSupport = registeredTypes.filter(
			(type) => this.getPlugin(type)?.toolComponent !== undefined,
		);
		const hasSerializationSupport = registeredTypes.filter((type) => {
			const plugin = this.getPlugin(type);
			return plugin?.serialize !== undefined && plugin?.deserialize !== undefined;
		});

		return {
			totalPlugins: this.plugins.size,
			registeredTypes,
			hasToolSupport,
			hasSerializationSupport,
		};
	}

	/**
	 * Get the React component for rendering a shape
	 *
	 * @param type - Shape type
	 * @returns React component or undefined if not found
	 *
	 * @example
	 * ```tsx
	 * const RectangleComponent = registry.getComponent('rectangle');
	 * if (RectangleComponent) {
	 *   return <RectangleComponent shape={shape} />;
	 * }
	 * ```
	 */
	getComponent(type: string) {
		const plugin = this.getPlugin(type);
		return plugin?.component;
	}

	/**
	 * Get the bounding box of a shape using its plugin
	 *
	 * @param shape - Shape object
	 * @returns Bounding box or null if plugin not found
	 *
	 * @example
	 * ```ts
	 * const bounds = registry.getBounds(rectangleShape);
	 * // => { x: 100, y: 100, width: 200, height: 150 }
	 * ```
	 */
	getBounds(shape: BaseShape) {
		const plugin = this.getPlugin(shape.type);
		if (!plugin) {
			console.warn(`No plugin registered for shape type: ${shape.type}`);
			return null;
		}

		return plugin.getBounds(shape);
	}

	/**
	 * Test if a point is inside a shape using its plugin
	 *
	 * @param shape - Shape object
	 * @param point - Point to test
	 * @returns True if point is inside the shape, false otherwise
	 *
	 * @example
	 * ```ts
	 * const isInside = registry.hitTest(rectangleShape, { x: 150, y: 150 });
	 * // => true
	 * ```
	 */
	hitTest(shape: BaseShape, point: Point): boolean {
		const plugin = this.getPlugin(shape.type);
		if (!plugin) {
			console.warn(`No plugin registered for shape type: ${shape.type}`);
			return false;
		}

		return plugin.hitTest(shape, point);
	}
}

// Create a singleton instance for global use
export const globalShapeRegistry = new ShapeRegistry();
