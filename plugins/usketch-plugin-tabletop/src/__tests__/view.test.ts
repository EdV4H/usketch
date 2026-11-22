import { createBoardStore } from "@edv4h/usketch-store";
import { describe, expect, it } from "vitest";
import {
	createViewShape,
	isView,
	listViews,
	readViewMeta,
	setViewCamera,
	setViewLabel,
	VIEW_TYPE,
	viewEdgeHit,
} from "../view.js";
import { createZoneShape } from "../zone.js";

describe("view shape", () => {
	it("fills defaults (camera: zoom) and drops unknown values", () => {
		expect(readViewMeta({})).toEqual({ label: "", camera: "zoom" });
		expect(readViewMeta({ meta: { label: 3, camera: "orbit" } })).toEqual({
			label: "",
			camera: "zoom",
		});
		const view = createViewShape({ x: 10, y: 20, label: "Seat 1", camera: "fixed" });
		expect(view).toMatchObject({ type: VIEW_TYPE, x: 10, y: 20, width: 960, height: 540 });
		expect(readViewMeta(view)).toEqual({ label: "Seat 1", camera: "fixed" });
		expect(isView(view)).toBe(true);
	});

	it("lists only views and edits their meta", () => {
		const store = createBoardStore();
		store.addShape(createViewShape({ id: "v1", x: 0, y: 0 }));
		store.addShape(createZoneShape({ id: "z1", x: 0, y: 0 }));
		store.addShape(createViewShape({ id: "v2", x: 0, y: 0 }));
		expect(listViews(store).map((v) => v.id)).toEqual(["v1", "v2"]);
		expect(setViewLabel(store, "v1", "North")).toBe(true);
		expect(setViewCamera(store, "v1", "free")).toBe(true);
		expect(readViewMeta(store.getShape("v1") ?? {})).toEqual({ label: "North", camera: "free" });
		expect(setViewLabel(store, "z1", "nope")).toBe(false);
	});

	it("is hit on its edge only", () => {
		const b = { x: 0, y: 0, width: 200, height: 100 };
		expect(viewEdgeHit(b, { x: 2, y: 50 })).toBe(true);
		expect(viewEdgeHit(b, { x: 100, y: 99 })).toBe(true);
		expect(viewEdgeHit(b, { x: 100, y: 50 })).toBe(false);
		expect(viewEdgeHit(b, { x: 300, y: 50 })).toBe(false);
	});
});
