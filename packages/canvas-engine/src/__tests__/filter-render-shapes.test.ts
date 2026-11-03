import type { ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { filterRenderShapes } from "../components/canvas.js";

const shape = (id: string, extra: Partial<ShapeData> = {}): ShapeData =>
	({ id, type: "rect", x: 0, y: 0, width: 1, height: 1, zIndex: "a0", ...extra }) as ShapeData;
const map = (...shapes: ShapeData[]) => new Map(shapes.map((s) => [s.id, s]));
const ids = (m: ReadonlyMap<string, ShapeData>) => [...m.keys()];

describe("filterRenderShapes", () => {
	it("returns the source map itself when nothing is dropped", () => {
		const source = map(shape("a"), shape("frame"), shape("b", { parentId: "frame" }));
		expect(filterRenderShapes(source, null)).toBe(source);
		expect(filterRenderShapes(source, () => true)).toBe(source);
	});

	it("drops hidden shapes and keeps the rest in map order", () => {
		const source = map(shape("a"), shape("b", { hidden: true }), shape("c"), shape("d"));
		const out = filterRenderShapes(source, null);
		expect(out).not.toBe(source);
		expect(ids(out)).toEqual(["a", "c", "d"]);
	});

	it("drops the first shape correctly (nothing kept before it)", () => {
		const source = map(shape("a", { hidden: true }), shape("b"));
		expect(ids(filterRenderShapes(source, null))).toEqual(["b"]);
	});

	it("drops descendants of a hidden ancestor", () => {
		const source = map(
			shape("child", { parentId: "group" }),
			shape("group", { parentId: "frame" }),
			shape("frame", { hidden: true }),
			shape("other"),
		);
		expect(ids(filterRenderShapes(source, null))).toEqual(["other"]);
	});

	it("keeps shapes whose parent is missing or forms a cycle", () => {
		const source = map(
			shape("orphan", { parentId: "gone" }),
			shape("x", { parentId: "y" }),
			shape("y", { parentId: "x" }),
		);
		expect(filterRenderShapes(source, null)).toBe(source);
	});

	it("applies the feature predicate together with hidden", () => {
		const source = map(shape("a"), shape("b"), shape("c", { hidden: true }), shape("d"));
		expect(ids(filterRenderShapes(source, (s) => s.id !== "b"))).toEqual(["a", "d"]);
	});
});
