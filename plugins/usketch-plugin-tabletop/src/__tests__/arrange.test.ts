import type { ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { arrangeZone } from "../arrange.js";
import { createZoneShape, readZoneMeta, zoneAcceptsType } from "../zone.js";

const card = (id: string, zIndex: string, o: Partial<ShapeData> = {}): ShapeData =>
	({ id, type: "card", x: 0, y: 0, width: 100, height: 140, zIndex, ...o }) as ShapeData;

const zone = (arrange: string, o: Partial<ShapeData> = {}) =>
	({
		...createZoneShape({ id: "z", x: 0, y: 0, width: 300, height: 200 }),
		meta: { arrange },
		...o,
	}) as ShapeData;

describe("readZoneMeta", () => {
	it("fills defaults and drops unknown values", () => {
		expect(readZoneMeta({})).toEqual({ label: "", arrange: "pile", face: "keep", accepts: [] });
		expect(
			readZoneMeta({ meta: { arrange: "bogus", face: "down", accepts: ["card", 3] } as never }),
		).toEqual({ label: "", arrange: "pile", face: "down", accepts: ["card"] });
	});

	it("zoneAcceptsType takes any type when the list is empty", () => {
		expect(zoneAcceptsType(zone("pile"), { type: "rect" })).toBe(true);
		const only = createZoneShape({ x: 0, y: 0, accepts: ["card"] });
		expect(zoneAcceptsType(only, { type: "card" })).toBe(true);
		expect(zoneAcceptsType(only, { type: "rect" })).toBe(false);
	});
});

describe("arrangeZone", () => {
	it("pile centers every child and skips ones already in place", () => {
		const patches = arrangeZone(zone("pile"), [
			card("a", "a1"),
			card("b", "a2", { x: 100, y: 30 }),
		]);
		expect(patches).toEqual([{ id: "a", patch: { x: 100, y: 30 } }]);
	});

	it("spread lays children left to right by zIndex, centered", () => {
		// inner 284; step = min(100*0.35, (284-100)/2) = 35; total = 35*2 + 100 = 170
		const patches = arrangeZone(zone("spread"), [
			card("c", "a3"),
			card("a", "a1"),
			card("b", "a2"),
		]);
		expect(patches).toEqual([
			{ id: "a", patch: { x: 65, y: 30 } },
			{ id: "b", patch: { x: 100, y: 30 } },
			{ id: "c", patch: { x: 135, y: 30 } },
		]);
	});

	it("spread overlaps more when the zone runs out of room", () => {
		const narrow = zone("spread", { width: 136 }); // inner 120 → room (120-100)/2 = 10
		const xs = arrangeZone(narrow, [card("a", "a1"), card("b", "a2"), card("c", "a3")]).map(
			(p) => p.patch.x,
		);
		expect(xs).toEqual([8, 18, 28]);
	});

	it("grid fills rows from the top left", () => {
		// inner 284 → floor((284+8)/108) = 2 columns
		const patches = arrangeZone(zone("grid"), [card("a", "a1"), card("b", "a2"), card("c", "a3")]);
		expect(patches).toEqual([
			{ id: "a", patch: { x: 8, y: 8 } },
			{ id: "b", patch: { x: 116, y: 8 } },
			{ id: "c", patch: { x: 8, y: 156 } },
		]);
	});

	it("free leaves children where they are", () => {
		expect(arrangeZone(zone("free"), [card("a", "a1", { x: 3 })])).toEqual([]);
	});
});
