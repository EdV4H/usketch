import { describe, expect, it } from "vitest";
import { defaultShapePlugins } from "./index";

describe("defaultShapePlugins", () => {
	it("should export an array of shape plugins", () => {
		expect(Array.isArray(defaultShapePlugins)).toBe(true);
	});

	it("should contain shape plugins with required properties", () => {
		for (const plugin of defaultShapePlugins) {
			expect(plugin).toHaveProperty("type");
			expect(plugin).toHaveProperty("component");
			expect(plugin).toHaveProperty("createDefaultShape");
			expect(typeof plugin.type).toBe("string");
			expect(typeof plugin.component).toBe("function");
			expect(typeof plugin.createDefaultShape).toBe("function");
		}
	});

	it("should have unique plugin types", () => {
		const types = defaultShapePlugins.map((plugin) => plugin.type);
		const uniqueTypes = new Set(types);
		expect(types.length).toBe(uniqueTypes.size);
	});
});
