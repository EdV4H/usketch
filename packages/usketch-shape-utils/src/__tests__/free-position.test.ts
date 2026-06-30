import type { BoundingBox } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { findFreePosition, overlapsAny } from "../free-position.js";

const box = (x: number, y: number, w = 100, h = 80): BoundingBox => ({ x, y, width: w, height: h });

describe("overlapsAny", () => {
	it("重なり/非重なりを判定（境界接触は非重なり）", () => {
		expect(overlapsAny(box(0, 0), [box(50, 0)])).toBe(true);
		expect(overlapsAny(box(0, 0), [box(100, 0)])).toBe(false); // 接触のみ
		expect(overlapsAny(box(0, 0), [box(500, 500)])).toBe(false);
		expect(overlapsAny(box(0, 0), [])).toBe(false);
	});
});

describe("findFreePosition", () => {
	it("空きならそのまま（occupied 空）", () => {
		const d = box(10, 20);
		expect(findFreePosition({ desired: d, occupied: [] })).toEqual(d);
	});

	it("desired が空いていればそのまま", () => {
		const d = box(0, 0);
		expect(findFreePosition({ desired: d, occupied: [box(500, 500)] })).toEqual(d);
	});

	it("ring: 塞がれていたら重ならない位置を返す", () => {
		const d = box(0, 0, 100, 80);
		const occupied = [box(0, 0)]; // desired と完全重なり
		const r = findFreePosition({ desired: d, occupied, strategy: "ring", step: 20 });
		expect(r.width).toBe(100);
		expect(r.height).toBe(80);
		expect(overlapsAny(r, occupied)).toBe(false);
	});

	it("push: 重なりを解消し、最小軸方向へ押し出す", () => {
		// occupied(0,0,100,80) と x に 20・y に 80 重なる → 最小軸 x へ押し出す。
		const d = box(80, 0, 100, 80);
		const occupied = [box(0, 0, 100, 80)];
		const r = findFreePosition({ desired: d, occupied, strategy: "push" });
		expect(overlapsAny(r, occupied)).toBe(false);
		// y は不変、x のみ移動
		expect(r.y).toBe(0);
		expect(r.x).toBeGreaterThanOrEqual(100);
	});

	it("push: 複数の重なりも反復で解消", () => {
		const d = box(0, 0, 100, 80);
		const occupied = [box(0, 0, 100, 80), box(60, 0, 100, 80)];
		const r = findFreePosition({ desired: d, occupied, strategy: "push" });
		expect(overlapsAny(r, occupied)).toBe(false);
	});

	it("ring: 近い空きを優先（すぐ右が空いていれば遠くへ飛ばない）", () => {
		// desired(0,0) は occupied と重なるが、右(120,0)は空き → だいたい右側へ
		const d = box(0, 0, 100, 80);
		const occupied = [box(0, 0, 100, 80)];
		const r = findFreePosition({
			desired: d,
			occupied,
			strategy: "ring",
			step: 20,
			maxDistance: 600,
		});
		const dist = Math.hypot(r.x, r.y);
		expect(dist).toBeLessThan(300); // 近傍に収まる
	});
});
