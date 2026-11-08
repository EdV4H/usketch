import { describe, expect, it } from "vitest";
import { decodeChunk, encodeChunk, isEmptyChunk } from "../elevation-codec.js";

describe("chunk codec", () => {
	it("round-trips Int16 deltas, negative and large values included", () => {
		const values = new Int16Array([0, 1, -1, 32767, -32768, 1234, -4321, 0]);
		const text = encodeChunk(values);
		expect(decodeChunk(text, values.length)).toEqual(values);
	});

	it("is little-endian, whatever the CPU", () => {
		expect(encodeChunk(new Int16Array([1]))).toBe(btoa("\u0001\u0000"));
		expect(encodeChunk(new Int16Array([-2]))).toBe(btoa("þÿ"));
	});

	it("round-trips a full 32×32 chunk", () => {
		const values = new Int16Array(1024).map((_, i) => ((i * 37) % 4000) - 2000);
		expect(decodeChunk(encodeChunk(values), 1024)).toEqual(values);
	});

	it("rejects data of the wrong length or not base64", () => {
		const text = encodeChunk(new Int16Array(4));
		expect(decodeChunk(text, 5)).toBeNull();
		expect(decodeChunk("@@@not base64@@@", 4)).toBeNull();
		expect(decodeChunk(42, 4)).toBeNull();
		expect(decodeChunk(undefined, 4)).toBeNull();
	});

	it("tells an all-zero chunk", () => {
		expect(isEmptyChunk(new Int16Array(16))).toBe(true);
		const v = new Int16Array(16);
		v[9] = -1;
		expect(isEmptyChunk(v)).toBe(false);
	});
});
