import type {
	Layer,
	LayerExportBackgroundContext,
	LayerManager,
	ShapeData,
	ShapeRegistry,
} from "@edv4h/usketch-shared";
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

	describe("includeBackgroundLayers", () => {
		const rect = { x: 10, y: -5, width: 50, height: 50 };
		const seen: LayerExportBackgroundContext[] = [];
		const bgLayer = (id: string, order: number, visible = true): Layer => ({
			id,
			order,
			render: () => null,
			renderExportBackground: (ctx) => {
				seen.push(ctx);
				return visible ? createElement("rect", { "data-bg": id }) : null;
			},
		});
		const layers: Layer[] = [
			bgLayer("dots", 20),
			bgLayer("hidden", 15, false),
			{ id: "overlay", order: 5, render: () => null },
			bgLayer("grid", 10),
		];
		const shapes = new Map([["a", mk("a", 20, "a")]]);

		it("既定 (false) では layers を渡しても出力が変わらない", async () => {
			const base = await buildRegionSvg(shapes, reg, { rect, background: "#fff" });
			seen.length = 0;
			const withLayers = await buildRegionSvg(shapes, reg, { rect, background: "#fff", layers });
			expect(withLayers).toBe(base);
			expect(seen).toHaveLength(0);
		});

		it("background の上・シェイプの下に order 昇順で描き、null は省く", async () => {
			seen.length = 0;
			const svg = await buildRegionSvg(shapes, reg, {
				rect,
				background: "#fff",
				includeBackgroundLayers: true,
				layers,
			});
			const iBg = svg.indexOf('fill="#fff"');
			const iGrid = svg.indexOf('data-bg="grid"');
			const iDots = svg.indexOf('data-bg="dots"');
			const iShape = svg.indexOf('data-id="a"');
			expect(iBg).toBeGreaterThan(-1);
			expect(iBg).toBeLessThan(iGrid);
			expect(iGrid).toBeLessThan(iDots);
			expect(iDots).toBeLessThan(iShape);
			expect(svg).not.toContain('data-bg="hidden"');
			// 背景もクリップ内に入る
			expect(svg.indexOf("clip-path=")).toBeLessThan(iGrid);
			expect(seen.map((c) => c.idPrefix)).toEqual([
				"usketch-bg-grid",
				"usketch-bg-hidden",
				"usketch-bg-dots",
			]);
			expect(seen.every((c) => c.zoom === 1 && c.rect === rect)).toBe(true);
		});

		it("LayerManager と backgroundZoom を受け付ける", async () => {
			seen.length = 0;
			const manager: LayerManager = {
				register: () => {},
				unregister: () => {},
				getLayers: () => layers,
			};
			await buildRegionSvg(shapes, reg, {
				rect,
				includeBackgroundLayers: true,
				layers: manager,
				backgroundZoom: 2.5,
			});
			expect(seen.every((c) => c.zoom === 2.5)).toBe(true);
		});

		it("layers 無し・不正な backgroundZoom はエラー", async () => {
			await expect(
				buildRegionSvg(shapes, reg, { rect, includeBackgroundLayers: true }),
			).rejects.toThrow(/layers/);
			await expect(
				buildRegionSvg(shapes, reg, {
					rect,
					includeBackgroundLayers: true,
					layers,
					backgroundZoom: 0,
				}),
			).rejects.toThrow(/backgroundZoom/);
		});
	});

	it("不正な rect はエラー", async () => {
		await expect(
			buildRegionSvg(new Map(), registry, { rect: { x: 0, y: 0, width: 0, height: 5 } }),
		).rejects.toThrow();
	});
});
