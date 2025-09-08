import { beforeEach, describe, expect, it } from "vitest";
import { ShapeRegistry } from "./shape-registry";
import type { ShapePlugin } from "./types";

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
		expect(registry.get("test-shape")).toBe(mockPlugin);
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

		const allPlugins = registry.getAll();
		expect(allPlugins).toHaveLength(2);
		expect(allPlugins).toContain(mockPlugin1);
		expect(allPlugins).toContain(mockPlugin2);
	});

	it("should return undefined for unregistered shape type", () => {
		expect(registry.get("non-existent")).toBeUndefined();
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

		expect(registry.get("test")).toBe(mockPlugin2);
		expect(registry.getAll()).toHaveLength(1);
	});
});
