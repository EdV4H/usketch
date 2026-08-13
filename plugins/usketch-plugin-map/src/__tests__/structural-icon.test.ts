import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import { isEffectivelyLocked } from "@edv4h/usketch-store";
import { describe, expect, it } from "vitest";
import { isStructuralIcon, type MapIconShapeData, makeMapIcon } from "../map-icon-shape.js";
import { isIconStructural, isMapIconEditable, setIconStructural } from "../structural-icon.js";

/** Minimal in-memory BoardStore covering the methods these ops use (shallow-merge). */
function fakeStore(initial: ShapeData[] = []): BoardStore {
	const shapes = new Map<string, ShapeData>(initial.map((s) => [s.id, s]));
	return {
		getShapes: () => shapes,
		getShape: (id: string) => shapes.get(id),
		addShape: (s: ShapeData) => shapes.set(s.id, s),
		updateShape: (id: string, patch: Partial<ShapeData>) => {
			const s = shapes.get(id);
			if (s) shapes.set(id, { ...s, ...patch });
		},
		deleteShape: (id: string) => shapes.delete(id),
	} as unknown as BoardStore;
}

const icon = (id: string): MapIconShapeData => ({ ...makeMapIcon("castle", "landmark", 0, 0), id });

describe("structural map-icons (#955)", () => {
	it("setIconStructural(true) sets locked + meta.structural together", () => {
		const store = fakeStore([icon("a")]);
		setIconStructural(store, "a", true);
		const s = store.getShape("a") as MapIconShapeData;
		expect(s.locked).toBe(true);
		expect(s.meta.structural).toBe(true);
		// meta.iconKey (and other fields) survive the shallow-merge update.
		expect(s.meta.iconKey).toBe("castle");
		expect(isIconStructural(store, "a")).toBe(true);
		expect(isStructuralIcon(s)).toBe(true);
	});

	it("setIconStructural(false) clears both the flag and the lock", () => {
		const store = fakeStore([icon("a")]);
		setIconStructural(store, "a", true);
		setIconStructural(store, "a", false);
		const s = store.getShape("a") as MapIconShapeData;
		expect(s.locked).toBeUndefined();
		expect(s.meta.structural).toBeUndefined();
		expect(s.meta.iconKey).toBe("castle");
		expect(isIconStructural(store, "a")).toBe(false);
	});

	it("structural icons are Select-protected (locked) yet Map-editable", () => {
		const store = fakeStore([icon("a")]);
		setIconStructural(store, "a", true);
		const s = store.getShape("a") as ShapeData;
		// Generic Select skips any effectively-locked shape → structural stays untouchable.
		expect(isEffectivelyLocked(store, s)).toBe(true);
		// The Map tool's editability predicate keeps editing it despite the lock.
		expect(isMapIconEditable(store, s)).toBe(true);
	});

	it("a plain locked (non-structural) icon is frozen for the Map tool too", () => {
		const store = fakeStore([{ ...icon("a"), locked: true }]);
		const s = store.getShape("a") as ShapeData;
		expect(isEffectivelyLocked(store, s)).toBe(true);
		expect(isMapIconEditable(store, s)).toBe(false);
	});

	it("a normal (unlocked) icon is both Selectable and Map-editable", () => {
		const store = fakeStore([icon("a")]);
		const s = store.getShape("a") as ShapeData;
		expect(isEffectivelyLocked(store, s)).toBe(false);
		expect(isMapIconEditable(store, s)).toBe(true);
		expect(isIconStructural(store, "a")).toBe(false);
	});

	it("a hidden structural icon is not Map-editable (hidden beats structural)", () => {
		const store = fakeStore([icon("a")]);
		setIconStructural(store, "a", true);
		store.updateShape("a", { hidden: true });
		const s = store.getShape("a") as ShapeData;
		expect(isMapIconEditable(store, s)).toBe(false);
	});

	it("setIconStructural is a no-op on missing / non-map-icon shapes", () => {
		const store = fakeStore([{ ...icon("a"), type: "rectangle" } as ShapeData]);
		setIconStructural(store, "a", true);
		setIconStructural(store, "missing", true);
		expect(store.getShape("a")?.locked).toBeUndefined();
		expect(isIconStructural(store, "a")).toBe(false);
	});
});
