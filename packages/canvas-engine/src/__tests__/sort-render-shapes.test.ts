import type { ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { sortRenderShapes } from "../components/canvas.js";

const shape = (id: string, zIndex: string): ShapeData =>
	({ id, type: "rect", x: 0, y: 0, width: 1, height: 1, zIndex }) as ShapeData;

const a = shape("a", "a0");
const b = shape("b", "a1");
const c = shape("c", "a2");
const map = (...shapes: ShapeData[]) => new Map(shapes.map((s) => [s.id, s]));

describe("sortRenderShapes", () => {
	it("sorts by zIndex when there is no store order to reuse", () => {
		expect(sortRenderShapes(map(c, a, b), null).map((s) => s.id)).toEqual(["a", "b", "c"]);
	});

	it("reuses the store's sorted list when nothing was filtered out", () => {
		const storeSorted = [a, b, c];
		expect(sortRenderShapes(map(c, a, b), storeSorted)).toBe(storeSorted);
	});

	it("drops filtered-out shapes from the store's list, keeping its order", () => {
		expect(sortRenderShapes(map(c, a), [a, b, c]).map((s) => s.id)).toEqual(["a", "c"]);
	});
});
