import type { ShapeData, ShapeRegistry } from "@edv4h/usketch-shared";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { scopeSatoriIds } from "./exporter.js";
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
