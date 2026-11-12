import { describe, expect, it } from "vitest";
import {
	decodeDocFrame,
	encodeDocFrame,
	isValidDocId,
	MSG_DOC_SUBSCRIBE,
	MSG_DOC_SYNC,
	MSG_DOC_UNSUBSCRIBE,
} from "../protocol.js";

describe("doc frame", () => {
	it("round-trips the type, id and parts", () => {
		const a = new Uint8Array([1, 2, 3]);
		const b = new Uint8Array([]);
		const c = new Uint8Array(300).fill(7);
		const frame = decodeDocFrame(encodeDocFrame(MSG_DOC_SYNC, "page_1-a", [a, b, c]));
		expect(frame).not.toBeNull();
		expect(frame?.type).toBe(MSG_DOC_SYNC);
		expect(frame?.docId).toBe("page_1-a");
		expect(frame?.parts.map((p) => [...p])).toEqual([[1, 2, 3], [], [...c]]);
	});

	it("encodes a frame without parts", () => {
		const frame = decodeDocFrame(encodeDocFrame(MSG_DOC_UNSUBSCRIBE, "p"));
		expect(frame).toEqual({ type: MSG_DOC_UNSUBSCRIBE, docId: "p", parts: [] });
	});

	it("decodes a frame that sits inside a larger buffer", () => {
		const encoded = encodeDocFrame(MSG_DOC_SUBSCRIBE, "p2", [new Uint8Array([9, 8])]);
		const buffer = new Uint8Array(encoded.length + 10);
		buffer.set(encoded, 5);
		const frame = decodeDocFrame(buffer.subarray(5, 5 + encoded.length));
		expect(frame?.docId).toBe("p2");
		expect([...(frame?.parts[0] ?? [])]).toEqual([9, 8]);
	});

	it("rejects invalid ids when encoding", () => {
		expect(() => encodeDocFrame(MSG_DOC_SUBSCRIBE, "")).toThrow();
		expect(() => encodeDocFrame(MSG_DOC_SUBSCRIBE, "a:b")).toThrow();
		expect(() => encodeDocFrame(MSG_DOC_SUBSCRIBE, "x".repeat(65))).toThrow();
	});

	it("returns null for truncated or malformed frames", () => {
		const good = encodeDocFrame(MSG_DOC_SYNC, "p", [new Uint8Array([1, 2, 3, 4])]);
		expect(decodeDocFrame(new Uint8Array([MSG_DOC_SYNC]))).toBeNull();
		expect(decodeDocFrame(good.subarray(0, good.length - 1))).toBeNull();
		expect(decodeDocFrame(good.subarray(0, 5))).toBeNull();
		// id 長が本体より長い
		expect(decodeDocFrame(new Uint8Array([MSG_DOC_SYNC, 10, 97]))).toBeNull();
		// id に使えない文字
		expect(decodeDocFrame(new Uint8Array([MSG_DOC_SYNC, 3, 97, 58, 98]))).toBeNull();
	});

	it("validates doc ids", () => {
		expect(isValidDocId("default")).toBe(true);
		expect(isValidDocId("01J9ZK-abc_def")).toBe(true);
		expect(isValidDocId("")).toBe(false);
		expect(isValidDocId("page/1")).toBe(false);
		expect(isValidDocId("ページ")).toBe(false);
	});
});
