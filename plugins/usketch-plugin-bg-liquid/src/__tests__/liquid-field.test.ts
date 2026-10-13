import { describe, expect, it } from "vitest";
import { chooseCellSize, LiquidField, type LiquidObstacle } from "../liquid-field.js";

const bounds = { x: 0, y: 0, width: 200, height: 200 };
const params = { diffusion: 800, relaxation: 0.5 };

function total(f: LiquidField): number {
	return f.h.reduce((a, b) => a + b, 0);
}

function square(cx: number, cy: number, half: number): LiquidObstacle {
	return { cx, cy, hw: half, hh: half, rotation: 0, kind: "rect" };
}

describe("LiquidField", () => {
	it("新しいウィンドウは静止水位 1 で満たされる", () => {
		const f = new LiquidField();
		f.setWindow(bounds, 10, 2);
		expect(f.cols).toBe(24);
		expect(f.rows).toBe(24);
		expect(f.col0).toBe(-2);
		expect([...f.h].every((v) => v === 1)).toBe(true);
	});

	it("押しのけた液体は覆われたセルから外周へ移り、体積は保存される", () => {
		const f = new LiquidField();
		f.setWindow(bounds, 10, 2);
		const before = total(f);
		f.applyObstacles([square(100, 100, 30)]);

		const at = (wx: number, wy: number) =>
			f.h[(Math.floor(wy / 10) - f.row0) * f.cols + (Math.floor(wx / 10) - f.col0)];
		expect(at(100, 100)).toBe(0);
		expect(f.solid[(10 - f.row0) * f.cols + (10 - f.col0)]).toBe(1);
		// The rim just outside the square is raised above rest.
		expect(at(135, 100)).toBeGreaterThan(1);
		expect(total(f)).toBeCloseTo(before, 3);
	});

	it("障害物が去ると溝はゆっくり埋まり、静止水位へ戻る", () => {
		const f = new LiquidField();
		f.setWindow(bounds, 10, 2);
		f.applyObstacles([square(100, 100, 30)]);
		f.applyObstacles([]);
		const center = (10 - f.row0) * f.cols + (10 - f.col0);
		expect(f.h[center]).toBe(0);

		f.step(1 / 60, params);
		const early = f.h[center];
		expect(early).toBeGreaterThanOrEqual(0);
		expect(early).toBeLessThan(0.5);

		for (let i = 0; i < 600; i++) f.step(1 / 60, params);
		for (const v of f.h) expect(v).toBeCloseTo(1, 1);
	});

	it("固体セルへは流れ込まない（障害物がある間は 0 のまま）", () => {
		const f = new LiquidField();
		f.setWindow(bounds, 10, 2);
		for (let i = 0; i < 30; i++) {
			f.applyObstacles([square(100, 100, 30)]);
			f.step(1 / 60, params);
		}
		const center = (10 - f.row0) * f.cols + (10 - f.col0);
		expect(f.h[center]).toBe(0);
	});

	it("楕円は角を押しのけない", () => {
		const f = new LiquidField();
		f.setWindow(bounds, 10, 2);
		f.applyObstacles([{ cx: 100, cy: 100, hw: 50, hh: 50, rotation: 0, kind: "ellipse" }]);
		const corner = (Math.floor(140 / 10) - f.row0) * f.cols + (Math.floor(140 / 10) - f.col0);
		expect(f.solid[corner]).toBe(0);
	});

	it("回転した矩形はローカル座標で判定される", () => {
		const f = new LiquidField();
		f.setWindow(bounds, 10, 2);
		// A thin bar along x, rotated 90° → covers a vertical strip.
		f.applyObstacles([{ cx: 100, cy: 100, hw: 60, hh: 8, rotation: Math.PI / 2, kind: "rect" }]);
		const idx = (wx: number, wy: number) =>
			(Math.floor(wy / 10) - f.row0) * f.cols + (Math.floor(wx / 10) - f.col0);
		expect(f.solid[idx(100, 50)]).toBe(1);
		expect(f.solid[idx(50, 100)]).toBe(0);
	});

	it("パンでウィンドウが動いても、重なり部分の値はワールドに固定されたまま", () => {
		const f = new LiquidField();
		f.setWindow(bounds, 10, 2);
		f.applyObstacles([square(100, 100, 30)]);
		const rim = f.sample(135, 105);
		f.setWindow({ ...bounds, x: 40, y: -20 }, 10, 2);
		expect(f.sample(135, 105)).toBeCloseTo(rim, 5);
		// Newly exposed area is at rest.
		expect(f.sample(250, 150)).toBe(1);
	});

	it("セルサイズ変更時は再サンプリングされる", () => {
		const f = new LiquidField();
		f.setWindow(bounds, 10, 2);
		f.applyObstacles([square(100, 100, 30)]);
		f.setWindow(bounds, 20, 2);
		expect(f.cell).toBe(20);
		expect(f.sample(100, 100)).toBeLessThan(0.5);
		expect(f.sample(10, 10)).toBeCloseTo(1, 5);
	});
});

describe("chooseCellSize", () => {
	it("画面上のセルが目標サイズ付近になる 2 の冪を返す", () => {
		expect(chooseCellSize(1, 8)).toBe(8);
		expect(chooseCellSize(2, 8)).toBe(4);
		expect(chooseCellSize(0.25, 8)).toBe(32);
		expect(chooseCellSize(Number.NaN, 8)).toBe(8);
	});
});
