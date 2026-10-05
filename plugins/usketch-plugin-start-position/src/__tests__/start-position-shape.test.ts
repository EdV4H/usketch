import type { ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import {
	findStartPosition,
	isStartPosition,
	makeStartPosition,
	START_POSITION_TYPE,
	type StartPositionShapeData,
} from "../start-position-shape.js";

const other = (id: string): ShapeData =>
	({ ...makeStartPosition(), id, type: "rect" }) as unknown as ShapeData;
const sp = (id: string, start?: StartPositionShapeData["start"]): StartPositionShapeData => ({
	...makeStartPosition(),
	id,
	start,
});

describe("start-position shape", () => {
	it("makeStartPosition is a locked, invisible singleton with autoApply on", () => {
		const s = makeStartPosition();
		expect(s.type).toBe(START_POSITION_TYPE);
		expect(s.locked).toBe(true);
		expect(s.autoApply).toBe(true);
		expect(s.width).toBe(0);
		expect(s.height).toBe(0);
	});

	it("isStartPosition discriminates by type", () => {
		expect(isStartPosition(sp("a"))).toBe(true);
		expect(isStartPosition(other("b"))).toBe(false);
	});

	it("findStartPosition picks the lowest-id shape, ignoring others", () => {
		expect(findStartPosition([other("aaa"), sp("mmm"), sp("bbb")])?.id).toBe("bbb");
		// Order-independent.
		expect(findStartPosition([sp("zzz"), sp("bbb"), other("aaa")])?.id).toBe("bbb");
	});

	it("findStartPosition returns null when there is none", () => {
		expect(findStartPosition([other("a")])).toBeNull();
		expect(findStartPosition([])).toBeNull();
	});
});
