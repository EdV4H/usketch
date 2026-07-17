import type { MarkdownConverter, MarkdownNode } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { createMarkdownConverterRegistry } from "../converter-registry.js";

const conv = (id: string, over: Partial<MarkdownConverter> = {}): MarkdownConverter => ({
	id,
	convert: () => [],
	...over,
});
const node = (type: string): MarkdownNode => ({ type });

describe("createMarkdownConverterRegistry", () => {
	it("filters by nodeTypes and match", () => {
		const reg = createMarkdownConverterRegistry();
		reg.register(conv("heading", { nodeTypes: ["heading"] }));
		expect(reg.resolve(node("heading"))?.id).toBe("heading");
		expect(reg.resolve(node("paragraph"))).toBeUndefined();

		reg.register(conv("mermaid", { nodeTypes: ["code"], match: (n) => n.lang === "mermaid" }));
		expect(reg.resolve({ type: "code", lang: "mermaid" })?.id).toBe("mermaid");
		expect(reg.resolve({ type: "code", lang: "ts" })).toBeUndefined();
	});

	it("resolves highest order, ties to most-recently-registered", () => {
		const reg = createMarkdownConverterRegistry();
		reg.register(conv("low", { nodeTypes: ["heading"], order: 1 }));
		reg.register(conv("high", { nodeTypes: ["heading"], order: 10 }));
		expect(reg.resolve(node("heading"))?.id).toBe("high");

		reg.register(conv("a", { nodeTypes: ["paragraph"], order: 5 }));
		reg.register(conv("b", { nodeTypes: ["paragraph"], order: 5 }));
		expect(reg.resolve(node("paragraph"))?.id).toBe("b"); // tie → last wins
	});

	it("re-registering an id replaces (and bumps to last)", () => {
		const reg = createMarkdownConverterRegistry();
		reg.register(conv("x", { nodeTypes: ["heading"], order: 5 }));
		reg.register(conv("y", { nodeTypes: ["heading"], order: 5 }));
		reg.register(conv("x", { nodeTypes: ["heading"], order: 5 })); // re-register x → now last
		expect(reg.getAll().map((c) => c.id)).toEqual(["y", "x"]);
		expect(reg.resolve(node("heading"))?.id).toBe("x");
	});

	it("unregister (via id and returned fn) removes the converter", () => {
		const reg = createMarkdownConverterRegistry();
		const off = reg.register(conv("a", { nodeTypes: ["heading"] }));
		reg.register(conv("b", { nodeTypes: ["heading"], order: -1 }));
		off();
		expect(reg.resolve(node("heading"))?.id).toBe("b");
		reg.unregister("b");
		expect(reg.resolve(node("heading"))).toBeUndefined();
	});
});
