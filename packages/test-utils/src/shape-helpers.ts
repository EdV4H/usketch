import type { ShapePlugin } from "@usketch/shape-registry";
import { ShapeRegistry } from "@usketch/shape-registry";
import type { BaseShape, Point } from "@usketch/shared-types";

/**
 * Create a mock ShapeRegistry with optional pre-registered plugins
 *
 * @param plugins - Optional array of plugins to pre-register
 * @returns A new ShapeRegistry instance
 *
 * @example
 * ```ts
 * const registry = createMockRegistry([rectanglePlugin, ellipsePlugin]);
 * ```
 */
export function createMockRegistry(plugins: ShapePlugin[] = []): ShapeRegistry {
	const registry = new ShapeRegistry();
	plugins.forEach((plugin) => {
		registry.register(plugin);
	});
	return registry;
}

/**
 * Create a mock shape with default properties
 *
 * @param overrides - Properties to override in the default shape
 * @returns A mock shape object
 *
 * @example
 * ```ts
 * const shape = createMockShape({ x: 100, y: 200, width: 50 });
 * // => { id: 'mock-shape-1', type: 'rectangle', x: 100, y: 200, ... }
 * ```
 */
export function createMockShape<T extends BaseShape = BaseShape>(overrides: Partial<T> = {}): T {
	const defaultShape = {
		id: `mock-shape-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
		type: "rectangle",
		x: 0,
		y: 0,
	};

	return { ...defaultShape, ...overrides } as T;
}

/**
 * Create multiple mock shapes
 *
 * @param count - Number of shapes to create
 * @param overrides - Properties to override (can be a function for each shape)
 * @returns Array of mock shapes
 *
 * @example
 * ```ts
 * const shapes = createMockShapes(3, (index) => ({ x: index * 100 }));
 * // => [{ x: 0 }, { x: 100 }, { x: 200 }]
 * ```
 */
export function createMockShapes<T extends BaseShape = BaseShape>(
	count: number,
	overrides: Partial<T> | ((index: number) => Partial<T>) = {},
): T[] {
	return Array.from({ length: count }, (_, index) => {
		const override = typeof overrides === "function" ? overrides(index) : overrides;
		return createMockShape<T>(override);
	});
}

/**
 * Create a mock rectangle shape with width and height
 *
 * @param overrides - Properties to override
 * @returns A mock rectangle shape
 *
 * @example
 * ```ts
 * const rect = createMockRectangle({ x: 100, y: 100, width: 200, height: 150 });
 * ```
 */
export function createMockRectangle(
	overrides: Partial<BaseShape & { width: number; height: number }> = {},
) {
	return createMockShape({
		type: "rectangle",
		width: 100,
		height: 100,
		...overrides,
	});
}

/**
 * Create a mock ellipse shape with width and height (radii)
 *
 * @param overrides - Properties to override
 * @returns A mock ellipse shape
 *
 * @example
 * ```ts
 * const ellipse = createMockEllipse({ x: 100, y: 100, radiusX: 50, radiusY: 30 });
 * ```
 */
export function createMockEllipse(
	overrides: Partial<BaseShape & { radiusX: number; radiusY: number }> = {},
) {
	return createMockShape({
		type: "ellipse",
		radiusX: 50,
		radiusY: 50,
		...overrides,
	});
}

/**
 * Create a mock plugin for testing
 *
 * @param type - Shape type
 * @param overrides - Properties to override
 * @returns A mock plugin
 *
 * @example
 * ```ts
 * const plugin = createMockPlugin('custom-shape', {
 *   getBounds: (shape) => ({ x: shape.x, y: shape.y, width: 100, height: 100 }),
 * });
 * ```
 */
export function createMockPlugin<T extends BaseShape = BaseShape>(
	type: string,
	overrides: Partial<ShapePlugin<T>> = {},
): ShapePlugin<T> {
	const defaultPlugin: ShapePlugin<T> = {
		type,
		component: () => null,
		createDefaultShape: (props) => ({ ...props, type }) as T,
		getBounds: (shape) => ({
			x: shape.x,
			y: shape.y,
			width: 100,
			height: 100,
		}),
		hitTest: (shape, point) => {
			const bounds = {
				x: shape.x,
				y: shape.y,
				width: 100,
				height: 100,
			};
			return (
				point.x >= bounds.x &&
				point.x <= bounds.x + bounds.width &&
				point.y >= bounds.y &&
				point.y <= bounds.y + bounds.height
			);
		},
	};

	return { ...defaultPlugin, ...overrides };
}

/**
 * Create a point for testing
 *
 * @param x - X coordinate
 * @param y - Y coordinate
 * @returns A point object
 *
 * @example
 * ```ts
 * const point = createPoint(100, 200);
 * // => { x: 100, y: 200 }
 * ```
 */
export function createPoint(x: number, y: number): Point {
	return { x, y };
}

/**
 * Check if a point is inside a rectangular bounds
 *
 * @param point - Point to test
 * @param bounds - Rectangular bounds
 * @returns True if point is inside bounds
 *
 * @example
 * ```ts
 * const isInside = isPointInBounds({ x: 150, y: 150 }, {
 *   x: 100, y: 100, width: 200, height: 200
 * });
 * // => true
 * ```
 */
export function isPointInBounds(
	point: Point,
	bounds: { x: number; y: number; width: number; height: number },
): boolean {
	return (
		point.x >= bounds.x &&
		point.x <= bounds.x + bounds.width &&
		point.y >= bounds.y &&
		point.y <= bounds.y + bounds.height
	);
}
