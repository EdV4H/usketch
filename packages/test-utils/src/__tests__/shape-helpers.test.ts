import { describe, expect, it } from "vitest";
import {
	createMockEllipse,
	createMockPlugin,
	createMockRectangle,
	createMockRegistry,
	createMockShape,
	createMockShapes,
	createPoint,
	isPointInBounds,
} from "../shape-helpers";

describe("shape-helpers", () => {
	describe("createMockRegistry", () => {
		it("should create empty registry", () => {
			const registry = createMockRegistry();
			expect(registry.getRegisteredTypes()).toEqual([]);
		});

		it("should create registry with pre-registered plugins", () => {
			const plugin1 = createMockPlugin("shape1");
			const plugin2 = createMockPlugin("shape2");

			const registry = createMockRegistry([plugin1, plugin2]);

			expect(registry.getRegisteredTypes()).toEqual(["shape1", "shape2"]);
			expect(registry.getPlugin("shape1")).toBe(plugin1);
			expect(registry.getPlugin("shape2")).toBe(plugin2);
		});
	});

	describe("createMockShape", () => {
		it("should create shape with default properties", () => {
			const shape = createMockShape();

			expect(shape).toMatchObject({
				type: "rectangle",
				x: 0,
				y: 0,
			});
			expect(shape.id).toMatch(/^mock-shape-/);
		});

		it("should override default properties", () => {
			const shape = createMockShape({
				type: "ellipse",
				x: 100,
				y: 200,
			});

			expect(shape).toMatchObject({
				type: "ellipse",
				x: 100,
				y: 200,
			});
		});

		it("should generate unique IDs", () => {
			const shape1 = createMockShape();
			const shape2 = createMockShape();

			expect(shape1.id).not.toBe(shape2.id);
		});
	});

	describe("createMockShapes", () => {
		it("should create multiple shapes with same properties", () => {
			const shapes = createMockShapes(3, { type: "ellipse" });

			expect(shapes).toHaveLength(3);
			shapes.forEach((shape) => {
				expect(shape.type).toBe("ellipse");
			});
		});

		it("should create shapes with function overrides", () => {
			const shapes = createMockShapes(3, (index) => ({ x: index * 100 }));

			expect(shapes).toHaveLength(3);
			expect(shapes[0].x).toBe(0);
			expect(shapes[1].x).toBe(100);
			expect(shapes[2].x).toBe(200);
		});
	});

	describe("createMockRectangle", () => {
		it("should create rectangle with default dimensions", () => {
			const rect = createMockRectangle();

			expect(rect).toMatchObject({
				type: "rectangle",
				width: 100,
				height: 100,
			});
		});

		it("should override dimensions", () => {
			const rect = createMockRectangle({
				x: 50,
				y: 50,
				width: 200,
				height: 150,
			});

			expect(rect).toMatchObject({
				type: "rectangle",
				x: 50,
				y: 50,
				width: 200,
				height: 150,
			});
		});
	});

	describe("createMockEllipse", () => {
		it("should create ellipse with default radii", () => {
			const ellipse = createMockEllipse();

			expect(ellipse).toMatchObject({
				type: "ellipse",
				radiusX: 50,
				radiusY: 50,
			});
		});

		it("should override radii", () => {
			const ellipse = createMockEllipse({
				x: 100,
				y: 100,
				radiusX: 75,
				radiusY: 50,
			});

			expect(ellipse).toMatchObject({
				type: "ellipse",
				x: 100,
				y: 100,
				radiusX: 75,
				radiusY: 50,
			});
		});
	});

	describe("createMockPlugin", () => {
		it("should create plugin with default implementation", () => {
			const plugin = createMockPlugin("test-shape");

			expect(plugin.type).toBe("test-shape");
			expect(plugin.component).toBeDefined();
			expect(plugin.createDefaultShape).toBeDefined();
			expect(plugin.getBounds).toBeDefined();
			expect(plugin.hitTest).toBeDefined();
		});

		it("should override plugin methods", () => {
			const customGetBounds = () => ({ x: 0, y: 0, width: 200, height: 200 });
			const plugin = createMockPlugin("test-shape", {
				getBounds: customGetBounds,
			});

			expect(plugin.getBounds).toBe(customGetBounds);
		});

		it("should create default shape with correct type", () => {
			const plugin = createMockPlugin("custom-type");
			const shape = plugin.createDefaultShape({ id: "1", x: 0, y: 0 });

			expect(shape.type).toBe("custom-type");
		});

		it("should perform hit test correctly", () => {
			const plugin = createMockPlugin("test-shape");
			const shape = { id: "1", type: "test-shape", x: 100, y: 100 };

			// Inside
			expect(plugin.hitTest(shape, { x: 150, y: 150 })).toBe(true);

			// Outside
			expect(plugin.hitTest(shape, { x: 50, y: 50 })).toBe(false);
		});
	});

	describe("createPoint", () => {
		it("should create point with given coordinates", () => {
			const point = createPoint(123, 456);

			expect(point).toEqual({ x: 123, y: 456 });
		});
	});

	describe("isPointInBounds", () => {
		it("should return true for point inside bounds", () => {
			const point = { x: 150, y: 150 };
			const bounds = { x: 100, y: 100, width: 200, height: 200 };

			expect(isPointInBounds(point, bounds)).toBe(true);
		});

		it("should return false for point outside bounds", () => {
			const point = { x: 50, y: 50 };
			const bounds = { x: 100, y: 100, width: 200, height: 200 };

			expect(isPointInBounds(point, bounds)).toBe(false);
		});

		it("should return true for point on boundary", () => {
			const bounds = { x: 100, y: 100, width: 200, height: 200 };

			expect(isPointInBounds({ x: 100, y: 100 }, bounds)).toBe(true); // top-left
			expect(isPointInBounds({ x: 300, y: 300 }, bounds)).toBe(true); // bottom-right
		});
	});
});
