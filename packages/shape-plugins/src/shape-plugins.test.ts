import { describe, expect, it } from "vitest";
import { shapePlugins } from "./index";

describe("shapePlugins", () => {
	it("should export an array of shape plugins", () => {
		expect(Array.isArray(shapePlugins)).toBe(true);
	});

	it("should contain shape plugins with required properties", () => {
		for (const plugin of shapePlugins) {
			expect(plugin).toHaveProperty("type");
			expect(plugin).toHaveProperty("component");
			expect(plugin).toHaveProperty("createDefaultShape");
			expect(typeof plugin.type).toBe("string");
			expect(typeof plugin.component).toBe("function");
			expect(typeof plugin.createDefaultShape).toBe("function");
		}
	});

	it("should have unique plugin types", () => {
		const types = shapePlugins.map((plugin) => plugin.type);
		const uniqueTypes = new Set(types);
		expect(types.length).toBe(uniqueTypes.size);
	});
});
