import { createBoardStore } from "@edv4h/usketch-store";
import { describe, expect, it } from "vitest";
import {
	createSeatShape,
	isSeat,
	listSeatShapes,
	nextSeatLabel,
	readSeatMeta,
	SEAT_TYPE,
	setSeatLabel,
} from "../seat.js";
import {
	createTableShape,
	findSeat,
	isOnTable,
	isTable,
	layoutTable,
	listSeats,
	listTables,
	nearestOnOutline,
	readTableMeta,
	seatPlacement,
	seatsAtTable,
	seatViewRect,
	setTableCamera,
	setTableForm,
	spreadPlacements,
	spreadSeatUpdates,
	TABLE_TYPE,
	tableOutline,
	tableOutlineLocal,
	tableViewRect,
	updateTableMeta,
} from "../table.js";
import { fitViewToScreen, viewCameraRotation } from "../view-camera.js";
import { createZoneShape } from "../zone.js";

/** Rounded to 3 places, with -0 folded into 0. */
const r = (v: number) => Math.round(v * 1000) / 1000 + 0;
const rounded = <T extends object>(o: T): T =>
	Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "number" ? r(v) : v])) as T;

const SEAT = { width: 40, height: 20 };

const table = (extra: Partial<Parameters<typeof createTableShape>[0]> = {}) =>
	createTableShape({ id: "t", x: 100, y: 200, width: 400, height: 200, ...extra });

const seatAt = (id: string, x: number, y: number) =>
	createSeatShape({ id, x, y, ...SEAT, parentId: "t", label: id });

describe("table shape", () => {
	it("fills defaults and drops unknown values", () => {
		expect(readTableMeta({})).toEqual({ form: "rect", sides: 6, camera: "zoom" });
		expect(readTableMeta({ meta: { form: "star", sides: 12, camera: "orbit" } as never })).toEqual({
			form: "rect",
			sides: 6,
			camera: "zoom",
		});
		expect(readTableMeta({ meta: { form: "polygon", sides: 5 } as never })).toMatchObject({
			form: "polygon",
			sides: 5,
		});
		const t = createTableShape({ x: 1, y: 2, form: "round" });
		expect(t).toMatchObject({ type: TABLE_TYPE, x: 1, y: 2, width: 1600, height: 1000 });
		expect(isTable(t)).toBe(true);
		expect(readTableMeta(t).form).toBe("round");
	});

	it("changes form and camera, keeping host fields on the meta", () => {
		const store = createBoardStore();
		store.addShape(table());
		store.addShape(createZoneShape({ id: "z", x: 0, y: 0 }));
		store.updateShape("t", { meta: { ...store.getShape("t")?.meta, hostTilt: "steep" } });
		expect(setTableForm(store, "t", "polygon", 5)).toBe(true);
		expect(setTableCamera(store, "t", "fixed")).toBe(true);
		// A bad corner count keeps the old one; an unknown form is refused.
		expect(setTableForm(store, "t", "polygon", 20)).toBe(true);
		expect(setTableForm(store, "t", "star" as never)).toBe(false);
		expect(setTableCamera(store, "t", "orbit" as never)).toBe(false);
		expect(store.getShape("t")?.meta).toMatchObject({
			hostTilt: "steep",
			form: "polygon",
			sides: 5,
			camera: "fixed",
		});
		expect(updateTableMeta(store, "z", { camera: "free" })).toBe(false);
	});

	it("fits each outline to the box", () => {
		const box = { width: 400, height: 200 };
		expect(tableOutlineLocal({ ...box, meta: {} })).toEqual([
			{ x: 0, y: 0 },
			{ x: 400, y: 0 },
			{ x: 400, y: 200 },
			{ x: 0, y: 200 },
		]);
		const triangle = tableOutlineLocal({ ...box, meta: { form: "polygon", sides: 3 } as never });
		expect(triangle.map(rounded)).toEqual([
			{ x: 200, y: 0 },
			{ x: 400, y: 200 },
			{ x: 0, y: 200 },
		]);
		const round = tableOutlineLocal({ ...box, meta: { form: "round" } as never });
		const xs = round.map((p) => p.x);
		const ys = round.map((p) => p.y);
		expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)].map(r)).toEqual([
			0, 400, 0, 200,
		]);
		// On the board, turned with the table.
		expect(tableOutline({ ...table(), rotation: 90 }).map(rounded)).toEqual([
			{ x: 400, y: 100 },
			{ x: 400, y: 500 },
			{ x: 200, y: 500 },
			{ x: 200, y: 100 },
		]);
	});

	it("knows what is on the table by its outline", () => {
		const round = table({ form: "round" });
		expect(isOnTable(round, { x: 300, y: 300 })).toBe(true);
		// The box's corner is off a round table.
		expect(isOnTable(round, { x: 105, y: 205 })).toBe(false);
		expect(isOnTable(table(), { x: 105, y: 205 })).toBe(true);
		expect(isOnTable(table(), { x: 50, y: 300 })).toBe(false);
	});

	it("faces the table from the nearest point of its outline", () => {
		const t = table();
		expect(rounded(nearestOnOutline(t, { x: 300, y: 450 }))).toEqual({
			x: 300,
			y: 400,
			rotation: 0,
		});
		expect(rounded(nearestOnOutline(t, { x: 300, y: 150 }))).toEqual({
			x: 300,
			y: 200,
			rotation: 180,
		});
		expect(rounded(nearestOnOutline(t, { x: 600, y: 300 }))).toEqual({
			x: 500,
			y: 300,
			rotation: -90,
		});
		expect(rounded(nearestOnOutline(t, { x: 50, y: 300 }))).toEqual({
			x: 100,
			y: 300,
			rotation: 90,
		});
		// Turned a quarter, the table's bottom edge faces left.
		expect(rounded(nearestOnOutline({ ...t, rotation: 90 }, { x: 150, y: 300 }))).toEqual({
			x: 200,
			y: 300,
			rotation: 90,
		});
		const round = table({ form: "round" });
		expect(rounded(nearestOnOutline(round, { x: 600, y: 300 }))).toEqual({
			x: 500,
			y: 300,
			rotation: -90,
		});
	});

	it("puts a seat just inside the outline, facing the table", () => {
		const t = table();
		expect(rounded(seatPlacement(t, { x: 300, y: 450 }, SEAT))).toEqual({
			x: 280,
			y: 380,
			rotation: 0,
		});
		const right = seatPlacement(t, { x: 600, y: 300 }, SEAT);
		// Its centre is half its height in from the right edge.
		expect([r(right.x + 20), r(right.y + 10), right.rotation]).toEqual([490, 300, -90]);
		expect(isOnTable(t, { x: right.x + 20, y: right.y + 10 })).toBe(true);
	});

	it("lays out only the seats among its children", () => {
		const t = table();
		const off = seatAt("off", 280, 500);
		const placed = seatAt("placed", 280, 380);
		const card = { ...createZoneShape({ id: "z", x: 0, y: 0 }), parentId: "t" };
		expect(
			layoutTable({ container: t, children: [off, placed, card] }).map((p) => ({
				id: p.id,
				patch: rounded(p.patch),
			})),
		).toEqual([{ id: "off", patch: { x: 280, y: 380, rotation: 0 } }]);
	});

	it("spreads seats evenly round the table, clockwise from the bottom", () => {
		const square = createTableShape({ x: 0, y: 0, width: 200, height: 200 });
		const centres = spreadPlacements(square, 4, { width: 20, height: 20 }).map((p) => [
			r(p.x + 10),
			r(p.y + 10),
			p.rotation,
		]);
		expect(centres).toEqual([
			[100, 190, 0],
			[10, 100, 90],
			[100, 10, 180],
			[190, 100, -90],
		]);
		expect(spreadPlacements(square, 0, SEAT)).toEqual([]);
	});

	it("lists seats by table, clockwise from the bottom", () => {
		const store = createBoardStore();
		store.addShape(table());
		store.addShape(createTableShape({ id: "u", x: 900, y: 0 }));
		store.addShape(seatAt("top", 280, 200));
		store.addShape(seatAt("bottom", 280, 380));
		store.addShape(seatAt("right", 460, 290));
		store.addShape(seatAt("left", 100, 290));
		store.addShape(createSeatShape({ id: "loose", x: 0, y: 0 }));
		expect(seatsAtTable(store, "t").map((s) => s.id)).toEqual(["bottom", "left", "top", "right"]);
		expect(seatsAtTable(store, "nope")).toEqual([]);
		expect(listTables(store).map((t) => t.id)).toEqual(["t", "u"]);
		expect(listSeats(store).map((s) => `${s.table.id}/${s.seat.id}`)).toEqual([
			"t/bottom",
			"t/left",
			"t/top",
			"t/right",
		]);
		expect(findSeat(store, "top")?.table.id).toBe("t");
		expect(findSeat(store, "loose")).toBeUndefined();
		expect(findSeat(store, "t")).toBeUndefined();
		expect(listSeatShapes(store).map((s) => s.id)).toEqual([
			"top",
			"bottom",
			"right",
			"left",
			"loose",
		]);
	});

	it("works out the moves that spread a table's seats", () => {
		const store = createBoardStore();
		store.addShape(table());
		store.addShape(seatAt("a", 100, 290));
		store.addShape(seatAt("b", 460, 290));
		const moves = spreadSeatUpdates(store, "t").map((m) => ({ id: m.id, to: rounded(m.to) }));
		// "a" (left) comes first clockwise from the bottom, so it takes the bottom.
		expect(moves).toEqual([
			{ id: "a", to: { x: 280, y: 380, rotation: 0 } },
			{ id: "b", to: { x: 280, y: 200, rotation: 180 } },
		]);
		expect(spreadSeatUpdates(store, "nope")).toEqual([]);
	});

	it("shows the whole table with the seat at the bottom", () => {
		const t = table();
		expect(seatViewRect(t, seatAt("b", 280, 380))).toEqual({
			x: 100,
			y: 200,
			width: 400,
			height: 200,
		});
		expect(rounded(seatViewRect(t, seatAt("t", 280, 200)))).toEqual({
			x: 100,
			y: 200,
			width: 400,
			height: 200,
			rotation: 180,
		});
		// A side seat sees the table on end: the box's sides swap about its centre.
		expect(rounded(seatViewRect(t, seatAt("r", 460, 290), 10))).toEqual({
			x: 190,
			y: 90,
			width: 220,
			height: 420,
			rotation: -90,
		});
		expect(rounded(tableViewRect({ ...t, rotation: 90 }))).toEqual({
			x: 100,
			y: 200,
			width: 400,
			height: 200,
			rotation: 90,
		});
	});

	it("frames a side seat with the camera turned so its side is at the bottom", () => {
		const rect = seatViewRect(table(), seatAt("r", 460, 290));
		// Seen from the right, the camera turns a quarter the other way.
		expect(r(viewCameraRotation(rect))).toBe(90);
		const vp = fitViewToScreen(rect, { width: 800, height: 600 }, 0);
		// On screen the table stands on end (200 wide, 400 tall): 600 / 400 = 1.5 is the fit.
		expect(vp.zoom).toBeCloseTo(1.5);
	});
});

describe("seat shape", () => {
	it("is created with a label and renamed, keeping host fields", () => {
		const seat = createSeatShape({ id: "s", x: 1, y: 2, label: "P1", rotation: 90, parentId: "t" });
		expect(seat).toMatchObject({
			type: SEAT_TYPE,
			width: 160,
			height: 64,
			rotation: 90,
			parentId: "t",
		});
		expect(isSeat(seat)).toBe(true);
		expect(readSeatMeta(seat)).toEqual({ label: "P1" });
		expect(readSeatMeta({ meta: { label: 3 } as never })).toEqual({ label: "" });
		const store = createBoardStore();
		store.addShape({ ...seat, meta: { ...seat.meta, hostColor: "red" } });
		store.addShape(table());
		expect(setSeatLabel(store, "s", "Dealer")).toBe(true);
		expect(setSeatLabel(store, "t", "x")).toBe(false);
		expect(store.getShape("s")?.meta).toEqual({ label: "Dealer", hostColor: "red" });
	});

	it("picks the lowest free number", () => {
		const seats = ["Player 1", "Player 3", "Dealer"].map((label) => ({ meta: { label } }));
		expect(nextSeatLabel(seats, "Player")).toBe("Player 2");
		expect(nextSeatLabel([], "Seat")).toBe("Seat 1");
	});
});
