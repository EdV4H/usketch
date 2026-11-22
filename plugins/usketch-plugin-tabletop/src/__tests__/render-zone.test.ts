import type { ShapeData, StoreEvent } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { mayChangeZoneContents } from "../render-zone.js";

const s = (o: Partial<ShapeData> = {}): ShapeData =>
	({ id: "c", type: "card", x: 0, y: 0, width: 10, height: 10, ...o }) as ShapeData;

describe("mayChangeZoneContents", () => {
	it("is true for added / removed shapes and a change of parent", () => {
		expect(mayChangeZoneContents({ type: "shape:added", payload: { id: "c", ids: ["c"] } })).toBe(
			true,
		);
		expect(mayChangeZoneContents({ type: "shape:removed", payload: { id: "c", ids: ["c"] } })).toBe(
			true,
		);
		expect(
			mayChangeZoneContents({
				type: "shape:updated",
				payload: { id: "c", ids: ["c"], before: s(), after: s({ parentId: "z" }) },
			}),
		).toBe(true);
	});

	it("is true for a batch, false for a single move or anything else", () => {
		const move: StoreEvent = {
			type: "shape:updated",
			payload: { id: "c", ids: ["c"], before: s(), after: s({ x: 5 }) },
		};
		expect(mayChangeZoneContents(move)).toBe(false);
		expect(mayChangeZoneContents({ ...move, payload: { ...move.payload, ids: ["c", "d"] } })).toBe(
			true,
		);
		expect(mayChangeZoneContents({ type: "selection:changed", payload: { ids: [] } })).toBe(false);
	});
});
