import type { CanvasPointerEvent, ToolContext } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseFreedrawConfig } from "../config.js";
import { createDrawController } from "../draw-tool.js";
import { nearestOnPolyline, snapEndpoints } from "../endpoint-snap.js";
import { createFreedrawSettingsStore } from "../settings-store.js";
import type { FreedrawShapeData, StrokePoint } from "../types.js";
import { createPointerStore } from "../ui/cursor-overlay.js";

const line = (id: string, points: StrokePoint[], pen = "ballpoint"): FreedrawShapeData => {
	const xs = points.map((p) => p.x);
	const ys = points.map((p) => p.y);
	return {
		id,
		type: "freedraw",
		x: Math.min(...xs) - 2,
		y: Math.min(...ys) - 2,
		width: Math.max(...xs) - Math.min(...xs) + 4,
		height: Math.max(...ys) - Math.min(...ys) + 4,
		style: { stroke: "#000", strokeWidth: 4, fill: "none", opacity: 1 },
		points,
		pen,
	} as FreedrawShapeData;
};

// 横に 0..100 の線。
const horizontal = line("h", [
	{ x: 0, y: 0 },
	{ x: 100, y: 0 },
]);

describe("nearestOnPolyline", () => {
	it("線分の途中に垂線を下ろした点", () => {
		expect(nearestOnPolyline({ x: 40, y: 7 }, horizontal.points)).toEqual({ x: 40, y: 0, dist: 7 });
	});
	it("線分の外なら端の点", () => {
		expect(nearestOnPolyline({ x: 103, y: 4 }, horizontal.points)).toEqual({
			x: 100,
			y: 0,
			dist: 5,
		});
	});
});

describe("snapEndpoints", () => {
	it("近い端だけ、相手の線のいちばん近い点まで伸ばす", () => {
		const r = snapEndpoints(
			[
				{ x: 50, y: 8 },
				{ x: 50, y: 80 },
			],
			[horizontal],
			10,
		);
		expect(r.points).toEqual([
			{ x: 50, y: 0, p: undefined },
			{ x: 50, y: 8 },
			{ x: 50, y: 80 },
		]);
		expect(r.joins).toEqual({ start: true });
	});

	it("両端が近ければ両方つなぐ", () => {
		const r = snapEndpoints(
			[
				{ x: 10, y: 5 },
				{ x: 50, y: 40 },
				{ x: 90, y: -5 },
			],
			[horizontal],
			10,
		);
		expect(r.joins).toEqual({ start: true, end: true });
		expect(r.points[0]).toMatchObject({ x: 10, y: 0 });
		expect(r.points.at(-1)).toMatchObject({ x: 90, y: 0 });
	});

	it("離れていればそのまま（joins なし）", () => {
		const pts = [
			{ x: 50, y: 30 },
			{ x: 50, y: 80 },
		];
		expect(snapEndpoints(pts, [horizontal], 10)).toEqual({ points: pts });
	});

	it("1 点だけの線はつながない", () => {
		expect(snapEndpoints([{ x: 50, y: 2 }], [horizontal], 10).joins).toBeUndefined();
	});
});

describe("描いた線の端をつなぐ（endpointSnap）", () => {
	beforeEach(() => {
		vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
			cb();
			return 1;
		});
		vi.stubGlobal("cancelAnimationFrame", () => {});
	});

	const setup = (enabled: boolean, others: FreedrawShapeData[]) => {
		const store = createBoardStore();
		for (const o of others) store.addShape(o);
		const toolCtx = {
			store,
			commands: { execute: (c: { execute(): void }) => c.execute() },
		} as unknown as ToolContext;
		const settings = createFreedrawSettingsStore(parseFreedrawConfig({ persistSettings: false }));
		const draw = createDrawController(settings, createPointerStore(), {
			endpointSnap: () => enabled,
		});
		const ev = (x: number, y: number, mod = false) =>
			({
				button: 0,
				worldPoint: { x, y },
				screenPoint: { x, y },
				ctrlKey: mod,
				metaKey: false,
			}) as unknown as CanvasPointerEvent;
		const drawLine = (mod = false) => {
			draw.onPointerDown(toolCtx, ev(50, 6));
			draw.onPointerMove(toolCtx, ev(50, 40));
			draw.onPointerMove(toolCtx, ev(50, 80));
			draw.onPointerUp(toolCtx, ev(50, 80, mod));
			return store.getShape(
				[...store.getShapes().keys()].find((k) => !others.some((o) => o.id === k)) ?? "",
			) as FreedrawShapeData;
		};
		return { drawLine };
	};

	it("有効なら、同じペンの線へつなぎ joins を残す", () => {
		const saved = setup(true, [horizontal]).drawLine();
		expect(saved.points[0]).toMatchObject({ x: 50, y: 0 });
		expect(saved.joins).toEqual({ start: true });
	});

	it("別のペンの線にはつながない", () => {
		const saved = setup(true, [{ ...horizontal, pen: "highlighter" }]).drawLine();
		expect(saved.points[0]).toMatchObject({ x: 50, y: 6 });
		expect(saved.joins).toBeUndefined();
	});

	it("無効なら、つながない", () => {
		expect(setup(false, [horizontal]).drawLine().joins).toBeUndefined();
	});

	it("Ctrl / ⌘ を押しながら離すと、その線だけ逆になる", () => {
		expect(setup(true, [horizontal]).drawLine(true).joins).toBeUndefined();
		expect(setup(false, [horizontal]).drawLine(true).joins).toEqual({ start: true });
	});
});
