import { describe, expect, it } from "vitest";
import { isRecognitionImage, isRecognitionStroke } from "../contract.js";

describe("isRecognitionStroke", () => {
	it("accepts well-formed stroke payload", () => {
		expect(
			isRecognitionStroke({
				kind: "stroke",
				points: [
					{ x: 0, y: 0 },
					{ x: 1, y: 2 },
				],
			}),
		).toBe(true);
	});

	it("accepts empty points array (caller decides whether to skip)", () => {
		expect(isRecognitionStroke({ kind: "stroke", points: [] })).toBe(true);
	});

	it("rejects null / undefined / primitives (text shape's `null` return)", () => {
		expect(isRecognitionStroke(null)).toBe(false);
		expect(isRecognitionStroke(undefined)).toBe(false);
		expect(isRecognitionStroke("stroke")).toBe(false);
		expect(isRecognitionStroke(42)).toBe(false);
	});

	it("rejects payload with wrong kind (image)", () => {
		expect(isRecognitionStroke({ kind: "image", src: "x" })).toBe(false);
	});

	it("rejects payload with non-array points", () => {
		expect(isRecognitionStroke({ kind: "stroke", points: "abc" })).toBe(false);
	});

	it("rejects points whose x/y are not numbers", () => {
		expect(
			isRecognitionStroke({
				kind: "stroke",
				points: [{ x: "0", y: 0 }],
			}),
		).toBe(false);
	});

	it("rejects points with non-finite x/y (NaN, Infinity)", () => {
		expect(
			isRecognitionStroke({
				kind: "stroke",
				points: [{ x: Number.NaN, y: 0 }],
			}),
		).toBe(false);
		expect(
			isRecognitionStroke({
				kind: "stroke",
				points: [{ x: 0, y: Number.POSITIVE_INFINITY }],
			}),
		).toBe(false);
	});
});

describe("isRecognitionImage", () => {
	it("accepts well-formed image payload", () => {
		expect(isRecognitionImage({ kind: "image", src: "data:image/png;base64,..." })).toBe(true);
	});

	it("rejects null / non-object", () => {
		expect(isRecognitionImage(null)).toBe(false);
		expect(isRecognitionImage("image")).toBe(false);
	});

	it("rejects payload missing src or with non-string src", () => {
		expect(isRecognitionImage({ kind: "image" })).toBe(false);
		expect(isRecognitionImage({ kind: "image", src: 123 })).toBe(false);
	});

	it("rejects payload with wrong kind (stroke)", () => {
		expect(isRecognitionImage({ kind: "stroke", points: [] })).toBe(false);
	});
});
