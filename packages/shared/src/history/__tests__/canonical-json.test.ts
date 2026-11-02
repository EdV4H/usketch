import { describe, expect, it } from "vitest";
import { canonicalJson } from "../canonical-json.js";

describe("canonicalJson", () => {
	it("sorts keys at every depth so insertion order does not matter", () => {
		const a = { b: 1, a: { d: [1, { y: 2, x: 1 }], c: "s" } };
		const b = { a: { c: "s", d: [1, { x: 1, y: 2 }] }, b: 1 };
		expect(canonicalJson(a)).toBe(canonicalJson(b));
		expect(canonicalJson(a)).toBe('{"a":{"c":"s","d":[1,{"x":1,"y":2}]},"b":1}');
	});

	it("follows JSON.stringify for undefined, non-finite numbers and toJSON", () => {
		expect(canonicalJson({ a: undefined, b: Number.NaN, c: [undefined] })).toBe(
			'{"b":null,"c":[null]}',
		);
		expect(canonicalJson({ d: new Date(0) })).toBe('{"d":"1970-01-01T00:00:00.000Z"}');
		expect(canonicalJson(undefined)).toBe("null");
		expect(canonicalJson(-0)).toBe("0");
	});

	it("rejects BigInt", () => {
		expect(() => canonicalJson({ n: 1n })).toThrow(TypeError);
	});
});
