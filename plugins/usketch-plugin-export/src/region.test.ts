import type { ShapeData, ShapeRegistry } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { buildRegionSvg } from "./region.js";

const mk = (id: string, x: number, zIndex: string, rotation?: number): ShapeData =>
	({ id, type: "t", x, y: 0, width: 10, height: 10, style: {}, zIndex, rotation }) as ShapeData;

const registry = {
	get: () => ({ renderTarget: "svg", render: (s: ShapeData) => `<rect data-id="${s.id}"/>` }),
} as unknown as ShapeRegistry;

// renderToStaticMarkup は文字列を受け付けないため react 要素を返す
import { createElement } from "react";

const reg = {
	get: () => ({
		renderTarget: "svg",
		render: (s: ShapeData) => createElement("rect", { "data-id": s.id }),
	}),
} as unknown as ShapeRegistry;

describe("buildRegionSvg", () => {
	it("矩形外を除外し zIndex 順に並べる", async () => {
		const shapes = new Map([
			["a", mk("a", 0, "b")],
			["b", mk("b", 5, "a")],
			["c", mk("c", 500, "c")],
		]);
		const svg = await buildRegionSvg(shapes, reg, { rect: { x: 0, y: 0, width: 50, height: 50 } });
		expect(svg.indexOf('data-id="b"')).toBeLessThan(svg.indexOf('data-id="a"'));
		expect(svg).not.toContain('data-id="c"');
	});

	it("filter と回転が反映される", async () => {
		const shapes = new Map([
			["a", mk("a", 0, "a", 45)],
			["b", mk("b", 5, "b")],
		]);
		const svg = await buildRegionSvg(shapes, reg, {
			rect: { x: 0, y: 0, width: 50, height: 50 },
			filter: (s) => s.id !== "b",
		});
		expect(svg).toContain("rotate(45 5 5)");
		expect(svg).not.toContain('data-id="b"');
	});

	it("不正な rect はエラー", async () => {
		await expect(
			buildRegionSvg(new Map(), registry, { rect: { x: 0, y: 0, width: 0, height: 5 } }),
		).rejects.toThrow();
	});
});
