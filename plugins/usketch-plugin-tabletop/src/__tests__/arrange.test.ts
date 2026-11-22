import type { ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { arrangeZone } from "../arrange.js";
import { createZoneShape, readZoneMeta, storedZoneMeta, zoneAcceptsType } from "../zone.js";

const card = (id: string, zIndex: string, o: Partial<ShapeData> = {}): ShapeData =>
	({ id, type: "card", x: 0, y: 0, width: 100, height: 140, zIndex, ...o }) as ShapeData;

const zone = (arrange: string, o: Partial<ShapeData> = {}, align?: string) =>
	({
		...createZoneShape({ id: "z", x: 0, y: 0, width: 300, height: 200 }),
		meta: align ? { arrange, align } : { arrange },
		...o,
	}) as ShapeData;

describe("readZoneMeta", () => {
	it("fills defaults and drops unknown values", () => {
		expect(readZoneMeta({})).toEqual({
			label: "",
			arrange: "pile",
			align: "center",
			face: "keep",
			accepts: [],
		});
		expect(
			readZoneMeta({
				meta: { arrange: "bogus", align: "up", face: "down", accepts: ["card", 3] } as never,
			}),
		).toEqual({ label: "", arrange: "pile", align: "center", face: "down", accepts: ["card"] });
	});

	it("align follows the layout until the zone has its own", () => {
		expect(readZoneMeta({ meta: { arrange: "grid" } as never }).align).toBe("start");
		expect(readZoneMeta({ meta: { arrange: "grid", align: "end" } as never }).align).toBe("end");
		expect(storedZoneMeta({ meta: { arrange: "grid" } as never })).not.toHaveProperty("align");
		expect(storedZoneMeta({ meta: { arrange: "grid", align: "end" } as never }).align).toBe("end");
		expect(createZoneShape({ x: 0, y: 0 }).meta).not.toHaveProperty("align");
		expect((createZoneShape({ x: 0, y: 0, align: "start" }).meta as { align: string }).align).toBe(
			"start",
		);
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

	it("pile leans to the left or right edge", () => {
		expect(arrangeZone(zone("pile", {}, "start"), [card("a", "a1")])).toEqual([
			{ id: "a", patch: { x: 8, y: 30 } },
		]);
		// 300 - 8 - 100
		expect(arrangeZone(zone("pile", {}, "end"), [card("a", "a1")])).toEqual([
			{ id: "a", patch: { x: 192, y: 30 } },
		]);
	});

	it("spread starts at the left edge or ends at the right edge", () => {
		const cards = () => [card("a", "a1"), card("b", "a2"), card("c", "a3")];
		// total 170 (see above)
		expect(arrangeZone(zone("spread", {}, "start"), cards()).map((p) => p.patch.x)).toEqual([
			8, 43, 78,
		]);
		// 300 - 8 - 170 = 122
		expect(arrangeZone(zone("spread", {}, "end"), cards()).map((p) => p.patch.x)).toEqual([
			122, 157, 192,
		]);
	});

	it("grid aligns each row on its own", () => {
		const cards = [card("a", "a1"), card("b", "a2"), card("c", "a3")];
		// rows: 2 cards (208 wide), 1 card (100 wide)
		expect(arrangeZone(zone("grid", {}, "center"), cards)).toEqual([
			{ id: "a", patch: { x: 46, y: 8 } },
			{ id: "b", patch: { x: 154, y: 8 } },
			{ id: "c", patch: { x: 100, y: 156 } },
		]);
		expect(arrangeZone(zone("grid", {}, "end"), cards)).toEqual([
			{ id: "a", patch: { x: 84, y: 8 } },
			{ id: "b", patch: { x: 192, y: 8 } },
			{ id: "c", patch: { x: 192, y: 156 } },
		]);
	});

	it("free leaves children where they are", () => {
		expect(arrangeZone(zone("free"), [card("a", "a1", { x: 3 })])).toEqual([]);
	});
});
