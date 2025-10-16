import { beforeEach, describe, expect, it } from "vitest";
import { ShapeRegistry } from "./shape-registry";
import type { ShapePlugin } from "./types";

// Helper function for rectangle hit test
const createRectangleHitTest = () => {
	return (shape: any, point: any) => {
		const bounds = {
			x: shape.x,
			y: shape.y,
			width: shape.width,
			height: shape.height,
		};
		return (
			point.x >= bounds.x &&
			point.x <= bounds.x + bounds.width &&
			point.y >= bounds.y &&
			point.y <= bounds.y + bounds.height
		);
	};
};

describe("ShapeRegistry", () => {
	let registry: ShapeRegistry;

	beforeEach(() => {
		registry = new ShapeRegistry();
	});

	it("should register a shape plugin", () => {
		const mockPlugin: ShapePlugin<any> = {
			type: "test-shape",
			component: () => null,
			createDefaultShape: (props) => ({ ...props, type: "test-shape" }),
		};

		registry.register(mockPlugin);
		expect(registry.getPlugin("test-shape")).toBe(mockPlugin);
	});

	it("should get all registered plugins", () => {
		const mockPlugin1: ShapePlugin<any> = {
			type: "shape1",
			component: () => null,
			createDefaultShape: (props) => ({ ...props, type: "shape1" }),
		};

		const mockPlugin2: ShapePlugin<any> = {
			type: "shape2",
			component: () => null,
			createDefaultShape: (props) => ({ ...props, type: "shape2" }),
		};

		registry.register(mockPlugin1);
		registry.register(mockPlugin2);

		const allPlugins = registry.getAllPlugins();
		expect(allPlugins).toHaveLength(2);
		expect(allPlugins).toContain(mockPlugin1);
		expect(allPlugins).toContain(mockPlugin2);
	});

	it("should return undefined for unregistered shape type", () => {
		expect(registry.getPlugin("non-existent")).toBeUndefined();
	});

	it("should override existing plugin when registering with same type", () => {
		const mockPlugin1: ShapePlugin<any> = {
			type: "test",
			component: () => null,
			createDefaultShape: (props) => ({ ...props, type: "test", version: 1 }),
		};

		const mockPlugin2: ShapePlugin<any> = {
			type: "test",
			component: () => null,
			createDefaultShape: (props) => ({ ...props, type: "test", version: 2 }),
		};

		registry.register(mockPlugin1);
		registry.register(mockPlugin2);

		expect(registry.getPlugin("test")).toBe(mockPlugin2);
		expect(registry.getAllPlugins()).toHaveLength(1);
	});

	describe("getComponent", () => {
		it("should return component for registered plugin", () => {
			const TestComponent = () => null;
			const mockPlugin: ShapePlugin<any> = {
				type: "test-shape",
				component: TestComponent,
				createDefaultShape: (props) => ({ ...props, type: "test-shape" }),
				getBounds: (shape) => ({ x: shape.x, y: shape.y, width: 100, height: 100 }),
				hitTest: () => true,
			};

			registry.register(mockPlugin);
			expect(registry.getComponent("test-shape")).toBe(TestComponent);
		});

		it("should return undefined for unregistered plugin", () => {
			expect(registry.getComponent("non-existent")).toBeUndefined();
		});
	});

	describe("getBounds", () => {
		it("should return bounds from plugin", () => {
			const mockPlugin: ShapePlugin<any> = {
				type: "rectangle",
				component: () => null,
				createDefaultShape: (props) => ({ ...props, type: "rectangle" }),
				getBounds: (shape) => ({
					x: shape.x,
					y: shape.y,
					width: shape.width,
					height: shape.height,
				}),
				hitTest: () => true,
			};

			registry.register(mockPlugin);

			const shape = {
				id: "1",
				type: "rectangle",
				x: 100,
				y: 200,
				width: 300,
				height: 400,
			};

			const bounds = registry.getBounds(shape);
			expect(bounds).toEqual({
				x: 100,
				y: 200,
				width: 300,
				height: 400,
			});
		});

		it("should return null for unregistered shape type", () => {
			const shape = {
				id: "1",
				type: "unknown",
				x: 0,
				y: 0,
			};

			expect(registry.getBounds(shape)).toBeNull();
		});
	});

	describe("hitTest", () => {
		it("should return true when point is inside shape", () => {
			const mockPlugin: ShapePlugin<any> = {
				type: "rectangle",
				component: () => null,
				createDefaultShape: (props) => ({ ...props, type: "rectangle" }),
				getBounds: (shape) => ({ x: shape.x, y: shape.y, width: 100, height: 100 }),
				hitTest: createRectangleHitTest(),
			};

			registry.register(mockPlugin);

			const shape = {
				id: "1",
				type: "rectangle",
				x: 100,
				y: 100,
				width: 200,
				height: 200,
			};

			expect(registry.hitTest(shape, { x: 150, y: 150 })).toBe(true);
			expect(registry.hitTest(shape, { x: 250, y: 250 })).toBe(true);
		});

		it("should return false when point is outside shape", () => {
			const mockPlugin: ShapePlugin<any> = {
				type: "rectangle",
				component: () => null,
				createDefaultShape: (props) => ({ ...props, type: "rectangle" }),
				getBounds: (shape) => ({ x: shape.x, y: shape.y, width: 100, height: 100 }),
				hitTest: createRectangleHitTest(),
			};

			registry.register(mockPlugin);

			const shape = {
				id: "1",
				type: "rectangle",
				x: 100,
				y: 100,
				width: 200,
				height: 200,
			};

			expect(registry.hitTest(shape, { x: 50, y: 50 })).toBe(false);
			expect(registry.hitTest(shape, { x: 350, y: 350 })).toBe(false);
		});

		it("should return false for unregistered shape type", () => {
			const shape = {
				id: "1",
				type: "unknown",
				x: 0,
				y: 0,
			};

			expect(registry.hitTest(shape, { x: 10, y: 10 })).toBe(false);
		});
	});
});
