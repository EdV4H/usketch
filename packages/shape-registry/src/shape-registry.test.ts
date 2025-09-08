import { beforeEach, describe, expect, it } from "vitest";
import { ShapeRegistry } from "./ShapeRegistry";
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
});
