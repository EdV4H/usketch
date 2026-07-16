import type { MarkdownConverter, MarkdownNode } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { createMarkdownConverterRegistry } from "../markdown-converter-registry.js";

function conv(id: string, nodeTypes: string[], order?: number): MarkdownConverter {
	return { id, nodeTypes, order, convert: () => [{ type: "text", meta: { id } }] };
}

const heading: MarkdownNode = { type: "heading" };
const paragraph: MarkdownNode = { type: "paragraph" };

describe("createMarkdownConverterRegistry", () => {
	it("resolves by node type", () => {
		const r = createMarkdownConverterRegistry();
		r.register(conv("h", ["heading"]));
		expect(r.resolve(heading)?.id).toBe("h");
		expect(r.resolve(paragraph)).toBeUndefined();
	});

	it("highest order wins; ties resolve to last registered", () => {
		const r = createMarkdownConverterRegistry();
		r.register(conv("low", ["heading"], 0));
		r.register(conv("high", ["heading"], 10));
		expect(r.resolve(heading)?.id).toBe("high");

		const r2 = createMarkdownConverterRegistry();
		r2.register(conv("a", ["heading"], 5));
		r2.register(conv("b", ["heading"], 5));
		expect(r2.resolve(heading)?.id).toBe("b"); // tie → last
	});

	it("honors match predicate in addition to nodeTypes", () => {
		const r = createMarkdownConverterRegistry();
		r.register({
			id: "deep",
			nodeTypes: ["heading"],
			match: (n) => n.depth === 1,
			convert: () => [{ type: "text" }],
		});
		expect(r.resolve({ type: "heading", depth: 1 })?.id).toBe("deep");
		expect(r.resolve({ type: "heading", depth: 2 })).toBeUndefined();
	});

	it("unregister removes a converter; the returned fn also unregisters", () => {
		const r = createMarkdownConverterRegistry();
		const off = r.register(conv("h", ["heading"]));
		off();
		expect(r.resolve(heading)).toBeUndefined();
		r.register(conv("h2", ["heading"]));
		r.unregister("h2");
		expect(r.getAll()).toHaveLength(0);
	});

	it("re-registering the same id replaces (no duplicates)", () => {
		const r = createMarkdownConverterRegistry();
		r.register(conv("h", ["heading"], 1));
		r.register(conv("h", ["heading"], 9));
		expect(r.getAll()).toHaveLength(1);
		expect(r.resolve(heading)?.order).toBe(9);
	});
});
