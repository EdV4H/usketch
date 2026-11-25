import type { ShapeData, ShapeRegistry } from "@edv4h/usketch-shared";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { buildPagesSvg, exportCanvas, exportPagesJson, scopeSatoriIds } from "./exporter.js";
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

describe("全体の書き出し（exportCanvas）", () => {
	const registry = {
		get: () => ({
			renderTarget: "svg",
			render: (s: ShapeData) => createElement("rect", { "data-id": s.id }),
			renderForExport: (s: ShapeData) =>
				createElement("rect", { "data-id": s.id, "data-export": "" }),
		}),
	} as unknown as ShapeRegistry;
	const mk = (id: string, x: number, zIndex: string, extra: Partial<ShapeData> = {}): ShapeData =>
		({ id, type: "t", x, y: 0, width: 10, height: 10, style: {}, zIndex, ...extra }) as ShapeData;
	const svgOf = async (shapes: ShapeData[]) =>
		(await exportCanvas(new Map(shapes.map((s) => [s.id, s])), registry, { format: "svg" })).text();

	it("範囲の書き出しと同じく zIndex 順・回転・renderForExport で描き、hidden を除く", async () => {
		const svg = await svgOf([
			mk("a", 0, "b", { rotation: 45 }),
			mk("b", 20, "a"),
			mk("h", 40, "c", { hidden: true }),
		]);
		expect(svg.indexOf('data-id="b"')).toBeLessThan(svg.indexOf('data-id="a"'));
		expect(svg).toContain("rotate(45 5 5)");
		expect(svg).toContain("data-export");
		expect(svg).not.toContain('data-id="h"');
		// 外接矩形は hidden を含まない（x: 0〜30 + 余白 20）。回転した a は外接矩形で測る。
		const half = Math.SQRT2 * 5;
		expect(svg).toContain(`viewBox="${5 - half - 20} ${5 - half - 20} `);
	});

	it("すべて hidden なら例外", async () => {
		await expect(svgOf([mk("h", 0, "a", { hidden: true })])).rejects.toThrow(/No shapes/);
	});

	it("全ページでも hidden だけのページは飛ばす", async () => {
		const { svg } = await buildPagesSvg(
			[
				{ id: "p1", name: "見える", shapes: new Map([["a", mk("a", 0, "a")]]) },
				{ id: "p2", name: "隠れ", shapes: new Map([["h", mk("h", 0, "a", { hidden: true })]]) },
			],
			registry,
			{ useSatori: false },
		);
		expect(svg).toContain(">見える</text>");
		expect(svg).not.toContain(">隠れ</text>");
	});
});
