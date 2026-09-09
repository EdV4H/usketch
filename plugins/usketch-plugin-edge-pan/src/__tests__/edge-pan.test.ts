import { describe, expect, it } from "vitest";
import { edgePanDelta, type ResolvedEdgePan } from "../edge-pan-config.js";

const SIZE = { width: 1000, height: 800 };

function resolved(overrides: Partial<ResolvedEdgePan> = {}): ResolvedEdgePan {
	return {
		enabled: true,
		edgeSize: 50,
		maxSpeed: 20,
		axes: "both",
		curve: (d) => d,
		...overrides,
	};
}

describe("edgePanDelta", () => {
	it("中央（帯の外）ではパンしない", () => {
		expect(edgePanDelta({ x: 500, y: 400 }, SIZE, resolved())).toEqual({ dx: 0, dy: 0 });
	});

	it("左端 → dx>0（中身を右へ＝左の先を見せる）、右端 → dx<0", () => {
		expect(edgePanDelta({ x: 0, y: 400 }, SIZE, resolved()).dx).toBe(20); // 最奥＝最大速度
		expect(edgePanDelta({ x: 1000, y: 400 }, SIZE, resolved()).dx).toBe(-20);
	});

	it("上端 → dy>0、下端 → dy<0", () => {
		expect(edgePanDelta({ x: 500, y: 0 }, SIZE, resolved()).dy).toBe(20);
		expect(edgePanDelta({ x: 500, y: 800 }, SIZE, resolved()).dy).toBe(-20);
	});

	it("帯の奥ほど速い（線形比例）", () => {
		// x=25 は帯(50)の半分の食い込み → 半速
		expect(edgePanDelta({ x: 25, y: 400 }, SIZE, resolved()).dx).toBeCloseTo(10, 5);
		// x=49（境界の内側1px）→ ほぼ0
		expect(edgePanDelta({ x: 49, y: 400 }, SIZE, resolved()).dx).toBeCloseTo(0.4, 5);
		// x=50（境界ちょうど）→ 帯の外 → 0
		expect(edgePanDelta({ x: 50, y: 400 }, SIZE, resolved()).dx).toBe(0);
	});

	it("角では上下左右が合成される（斜めパン）", () => {
		const d = edgePanDelta({ x: 0, y: 0 }, SIZE, resolved());
		expect(d).toEqual({ dx: 20, dy: 20 });
	});

	it("canvas の外へ出ても最大速度でクランプ", () => {
		expect(edgePanDelta({ x: -200, y: 400 }, SIZE, resolved()).dx).toBe(20);
		expect(edgePanDelta({ x: 1200, y: 400 }, SIZE, resolved()).dx).toBe(-20);
	});

	it("axes=horizontal は縦を無効化、vertical は横を無効化", () => {
		const corner = { x: 0, y: 0 };
		expect(edgePanDelta(corner, SIZE, resolved({ axes: "horizontal" }))).toEqual({ dx: 20, dy: 0 });
		expect(edgePanDelta(corner, SIZE, resolved({ axes: "vertical" }))).toEqual({ dx: 0, dy: 20 });
	});

	it("maxSpeed=0 / edgeSize=0 ではパンしない", () => {
		expect(edgePanDelta({ x: 0, y: 0 }, SIZE, resolved({ maxSpeed: 0 }))).toEqual({ dx: 0, dy: 0 });
		expect(edgePanDelta({ x: 0, y: 0 }, SIZE, resolved({ edgeSize: 0 }))).toEqual({ dx: 0, dy: 0 });
	});

	it("curve で速度カーブを変えられる（d=>d*d は端に近づくほど急加速）", () => {
		const d = edgePanDelta({ x: 25, y: 400 }, SIZE, resolved({ curve: (x) => x * x }));
		// 食い込み0.5 → 0.25 * maxSpeed = 5
		expect(d.dx).toBeCloseTo(5, 5);
	});
});
