import { describe, expect, it } from "vitest";
import { baseIconFor, effectiveBaseIcon } from "../base/base-icon.js";

describe("base icon (radius tier + override)", () => {
	it("derives the settlement tier from radius (tent → town → castle)", () => {
		expect(baseIconFor(1)).toBe("tent");
		expect(baseIconFor(4)).toBe("tent");
		expect(baseIconFor(5)).toBe("town");
		expect(baseIconFor(9)).toBe("town");
		expect(baseIconFor(10)).toBe("castle");
		expect(baseIconFor(64)).toBe("castle");
	});

	it("uses the radius tier when a base has no override", () => {
		expect(effectiveBaseIcon({ radius: 1 })).toBe("tent");
		expect(effectiveBaseIcon({ radius: 7 })).toBe("town");
		expect(effectiveBaseIcon({ radius: 20 })).toBe("castle");
	});

	it("prefers an explicit icon override over the tier", () => {
		expect(effectiveBaseIcon({ radius: 12, icon: "port" })).toBe("port");
		expect(effectiveBaseIcon({ radius: 1, icon: "castle" })).toBe("castle");
	});
});
