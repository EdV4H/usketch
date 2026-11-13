import type { ShapeData, ShapeRegistry } from "@edv4h/usketch-shared";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { buildPagesSvg, exportPagesJson, scopeSatoriIds } from "./exporter.js";
import { buildRegionSvg } from "./region.js";

describe("scopeSatoriIds", () => {
	it("Satori の id と参照を名前空間に分ける", () => {
		const markup =
			'<clipPath id="satori_cp-id"><rect/></clipPath><mask id="satori_om-id-0"/>' +
			'<g clip-path="url(#satori_cp-id)" mask="url(#satori_om-id-0)"><use href="#satori_s-id-0"/></g>';
		expect(scopeSatoriIds(markup, "s1")).toBe(
			'<clipPath id="satori_s1_cp-id"><rect/></clipPath><mask id="satori_s1_om-id-0"/>' +
				'<g clip-path="url(#satori_s1_cp-id)" mask="url(#satori_s1_om-id-0)"><use href="#satori_s1_s-id-0"/></g>',
		);
	});

	it("satori_ で始まらない id、id 以外の属性、本文には触れない", () => {
		const markup = '<rect id="usketch-region" data-id="satori_x"/><text>satori_cp-id</text>';
		expect(scopeSatoriIds(markup, "s1")).toBe(markup);
	});
});

describe("buildRegionSvg の HTML シェイプ", () => {
	// 角丸 + overflow:hidden で Satori に clipPath を出させる (文字なしなのでフォント不要)。
	const registry = {
		get: () => ({
			renderTarget: "html",
			render: () =>
				createElement(
					"div",
					{
						style: {
							display: "flex",
							width: "100%",
							height: "100%",
							borderRadius: 8,
							overflow: "hidden",
							background: "#fc0",
						},
					},
					createElement("div", { style: { width: 20, height: 20, background: "#36c" } }),
				),
		}),
	} as unknown as ShapeRegistry;
	const mk = (id: string, x: number): ShapeData =>
		({ id, type: "t", x, y: 0, width: 40, height: 40, style: {}, zIndex: "a0" }) as ShapeData;

	it("同じ id 文字列になりうるシェイプでも、id が重複せず参照がすべて解決する", async () => {
		const shapes = new Map([
			["note:1", mk("note:1", 0)],
			["note.1", mk("note.1", 50)],
		]);
		const svg = await buildRegionSvg(shapes, registry, {
			rect: { x: 0, y: 0, width: 100, height: 40 },
			fonts: [],
		});
		const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
		expect(ids.some((id) => id.startsWith("satori_"))).toBe(true);
		expect(new Set(ids).size).toBe(ids.length);
		const refs = [...svg.matchAll(/(?:url\(#|href="#)([^)"]+)/g)].map((m) => m[1]);
		expect(refs.length).toBeGreaterThan(0);
		for (const ref of refs) expect(ids).toContain(ref);
	});
});

describe("全ページの書き出し", () => {
	const svgRegistry = {
		get: () => ({
			renderTarget: "svg",
			render: (s: ShapeData) =>
				createElement("rect", { x: s.x, y: s.y, width: s.width, height: s.height }),
		}),
	} as unknown as ShapeRegistry;
	const rect = (id: string, x: number, y: number) =>
		({ id, type: "rect", x, y, width: 100, height: 50 }) as ShapeData;
	const pages = [
		{ id: "p1", name: "ページ 1", shapes: new Map([["a", rect("a", 0, 0)]]) },
		{ id: "p2", name: "空", shapes: new Map<string, ShapeData>() },
		{ id: "p3", name: "<設計>", shapes: new Map([["b", rect("b", 500, 300)]]) },
	];

	it("ページを縦に並べて見出しを付け、空のページは飛ばす", async () => {
		const { svg, width, height } = await buildPagesSvg(pages, svgRegistry, { useSatori: false });
		expect(width).toBe(140);
		// 見出し 48 + 90、間 40、見出し 48 + 90
		expect(height).toBe(48 + 90 + 40 + 48 + 90);
		expect(svg).toContain(">ページ 1</text>");
		expect(svg).toContain(">&lt;設計&gt;</text>");
		expect(svg).not.toContain(">空</text>");
		// 2 枚目のページは見出しの下（y = 226）に余白 20 を空けて置く（300 - 20 = 280 を 226 へ）
		expect(svg).toContain('data-page-id="p3" transform="translate(-480, -54)"');
	});

	it("描くページが無ければ例外", async () => {
		await expect(buildPagesSvg([pages[1]], svgRegistry, { useSatori: false })).rejects.toThrow();
	});

	it("JSON はページごとにシェイプを並べる", async () => {
		const data = JSON.parse(await exportPagesJson(pages).text());
		expect(data.pages.map((p: { id: string }) => p.id)).toEqual(["p1", "p2", "p3"]);
		expect(data.pages[2].shapes.b).toMatchObject({ id: "b", x: 500 });
	});
});
