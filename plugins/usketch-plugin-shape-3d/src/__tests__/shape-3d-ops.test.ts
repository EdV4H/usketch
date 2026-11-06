import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { clearShape3d, getShape3d, setShape3d } from "../shape-3d-ops.js";
import { DEFAULT_SHAPE_3D_TYPES, SHAPE_3D_KEY } from "../shape-3d-params.js";

function fakeStore(shapes: ShapeData[]): BoardStore {
	const map = new Map(shapes.map((s) => [s.id, s]));
	return {
		getShape: (id: string) => map.get(id),
		updateShape: (id: string, updates: Partial<ShapeData>) => {
			const s = map.get(id);
			if (s) map.set(id, { ...s, ...updates });
		},
	} as unknown as BoardStore;
}

const shape = (id: string, type = "rect", extra: Record<string, unknown> = {}): ShapeData =>
	({ id, type, x: 0, y: 0, width: 10, height: 10, style: {}, ...extra }) as ShapeData;

describe("setShape3d", () => {
	it("starts 3D with a mode and merges later patches", () => {
		const store = fakeStore([shape("a"), shape("b")]);
		expect(setShape3d(store, ["a", "b"], { mode: "stand" })).toEqual(["a", "b"]);
		expect(getShape3d(store, "a")).toMatchObject({ mode: "stand", facing: "camera" });
		setShape3d(store, ["a"], { facing: "fixed" });
		expect(getShape3d(store, "a")).toMatchObject({ mode: "stand", facing: "fixed" });
		expect(getShape3d(store, "b")?.facing).toBe("camera");
	});
	it("gives each mode its own default height unless one was set", () => {
		const store = fakeStore([shape("a", "rectangle")]);
		const types = DEFAULT_SHAPE_3D_TYPES;
		setShape3d(store, ["a"], { mode: "box" }, types);
		expect(getShape3d(store, "a")?.height).toBe(16);
		setShape3d(store, ["a"], { mode: "float" }, types);
		expect(getShape3d(store, "a")?.height).toBe(24);
		setShape3d(store, ["a"], { height: 40 }, types);
		setShape3d(store, ["a"], { mode: "box" }, types);
		expect(getShape3d(store, "a")?.height).toBe(40);
	});
	it("rejects box on a type that doesn't allow it", () => {
		const store = fakeStore([shape("e", "ellipse")]);
		expect(
			setShape3d(store, ["e"], { mode: "box" }, { ellipse: { modes: ["stand", "float"] } }),
		).toEqual([]);
	});
	it("skips a patch without a mode on a flat shape", () => {
		const store = fakeStore([shape("a")]);
		expect(setShape3d(store, ["a"], { facing: "fixed" })).toEqual([]);
		expect(getShape3d(store, "a")).toBeNull();
	});
	it("skips missing, locked and disallowed shapes", () => {
		const store = fakeStore([shape("a", "embed"), shape("b", "rect", { locked: true })]);
		const types = { embed: { modes: [] } };
		expect(setShape3d(store, ["a", "b", "nope"], { mode: "stand" }, types)).toEqual([]);
	});
});

describe("clearShape3d", () => {
	it("makes shapes flat again", () => {
		const store = fakeStore([
			shape("a", "rect", { [SHAPE_3D_KEY]: { mode: "stand" } }),
			shape("b"),
		]);
		expect(clearShape3d(store, ["a", "b"])).toEqual(["a"]);
		expect(getShape3d(store, "a")).toBeNull();
		expect(store.getShape("a")?.[SHAPE_3D_KEY]).toBeUndefined();
	});
});
