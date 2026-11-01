import { describe, expect, it } from "vitest";
import { groundMarkup } from "../ground-markup.js";
import { renderConfigStore } from "../render-config.js";
import type { TileMapShapeData } from "../tilemap-shape.js";

const TILE = 40;
const area = (left: number, top: number, w: number, h: number) =>
	({ left, top, right: left + w, bottom: top + h, width: w, height: h }) as DOMRectReadOnly;
const tilemap = (cells: Record<string, string>, extra: Partial<TileMapShapeData> = {}) =>
	({ id: "tm", type: "tilemap", tile: TILE, cells, ...extra }) as unknown as TileMapShapeData;
const cfg = { ...renderConfigStore.get(), emptyTerrain: null, lineStyle: "straight" as const };

describe("groundMarkup", () => {
	it("draws a painted cell with its pattern and a strip on each exposed side", () => {
		const html = groundMarkup(
			[tilemap({ "0,0": "grass" })],
			cfg,
			TILE,
			1,
			undefined,
			area(0, 0, 80, 80),
		);
		expect(html).toContain(
			'<rect x="0" y="0" width="40" height="40" fill="url(#uskmap-pat-grass)"',
		);
		expect(html.match(/var\(--t-grass-d\)/g)).toHaveLength(4);
	});

	it("leaves out cells outside the area", () => {
		const html = groundMarkup(
			[tilemap({ "0,0": "grass", "5,5": "sand" })],
			cfg,
			TILE,
			1,
			undefined,
			area(0, 0, 80, 80),
		);
		expect(html).not.toContain("sand");
	});

	it("never writes out an unknown terrain or a non-numeric size from board data", () => {
		const evil = '"/><script>alert(1)</script><rect fill="';
		const html = groundMarkup(
			[tilemap({ "0,0": evil, "1,0": "grass" })],
			{ ...cfg, emptyTerrain: evil as never },
			TILE,
			1,
			undefined,
			area(0, 0, 80, 80),
		);
		expect(html).not.toContain("script");
		expect(html).toContain("grass");
		const bad = groundMarkup(
			[tilemap({ "0,0": "grass" }, { tile: '"><b>' as never })],
			cfg,
			TILE,
			1,
			undefined,
			area(0, 0, 80, 80),
		);
		expect(bad).not.toContain("<b>");
	});

	it("fills the whole area from the infinite base, wobbled when the line style is", () => {
		const html = groundMarkup(
			[tilemap({}, { baseSeed: 7 })],
			{ ...cfg, lineStyle: "wobble" },
			TILE,
			1,
			undefined,
			area(0, 0, 80, 80),
		);
		expect(html.startsWith('<g filter="url(#uskmap-wobble)">')).toBe(true);
		expect(html.match(/fill="url\(#uskmap-pat-/g)).toHaveLength(4);
	});
});
