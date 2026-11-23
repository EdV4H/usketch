import { describe, expect, it } from "vitest";
import type { ShapeData } from "../types/shape.js";
import {
	deltaToLocal,
	getRotatedAABB,
	getShapeWorldAABB,
	keepRotatedTopLeft,
	normalizeAngle,
	placeLocalBox,
	rectIntersectsShape,
	rotatePoint,
	safeRotation,
	shapeBoxContainsPoint,
	snapAngle,
	unrotatePoint,
	withRotation,
} from "../utils/rotation.js";

describe("rotatePoint", () => {
	it("0° 回転で同じ点を返す", () => {
		const result = rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, 0);
		expect(result.x).toBeCloseTo(10);
		expect(result.y).toBeCloseTo(0);
	});

	it("90° 回転で正しく回転する", () => {
		const result = rotatePoint({ x: 1, y: 0 }, { x: 0, y: 0 }, Math.PI / 2);
		expect(result.x).toBeCloseTo(0);
		expect(result.y).toBeCloseTo(1);
	});

	it("180° 回転で反転する", () => {
		const result = rotatePoint({ x: 1, y: 0 }, { x: 0, y: 0 }, Math.PI);
		expect(result.x).toBeCloseTo(-1);
		expect(result.y).toBeCloseTo(0);
	});

	it("中心がオフセットされた回転", () => {
		const result = rotatePoint({ x: 3, y: 2 }, { x: 2, y: 2 }, Math.PI / 2);
		expect(result.x).toBeCloseTo(2);
		expect(result.y).toBeCloseTo(3);
	});
});

describe("unrotatePoint", () => {
	it("rotatePoint の逆操作", () => {
		const center = { x: 5, y: 5 };
		const original = { x: 10, y: 3 };
		const angle = Math.PI / 3;
		const rotated = rotatePoint(original, center, angle);
		const restored = unrotatePoint(rotated, center, angle);
		expect(restored.x).toBeCloseTo(original.x);
		expect(restored.y).toBeCloseTo(original.y);
	});
});

describe("getRotatedAABB", () => {
	const bounds = { x: 0, y: 0, width: 100, height: 50 };

	it("0° でそのまま返す", () => {
		const result = getRotatedAABB(bounds, 0);
		expect(result).toEqual(bounds);
	});

	it("90° 回転で幅と高さが入れ替わる", () => {
		const result = getRotatedAABB(bounds, 90);
		expect(result.width).toBeCloseTo(50);
		expect(result.height).toBeCloseTo(100);
	});

	it("180° 回転でサイズが同じ", () => {
		const result = getRotatedAABB(bounds, 180);
		expect(result.width).toBeCloseTo(100);
		expect(result.height).toBeCloseTo(50);
	});

	it("45° 回転で AABB が拡大する", () => {
		const result = getRotatedAABB(bounds, 45);
		// 対角線が水平/垂直になるため、AABB は元より大きい
		expect(result.width).toBeGreaterThan(100);
		expect(result.height).toBeGreaterThan(50);
	});

	it("中心が保持される", () => {
		const b = { x: 10, y: 20, width: 100, height: 50 };
		const result = getRotatedAABB(b, 45);
		const originalCx = b.x + b.width / 2;
		const originalCy = b.y + b.height / 2;
		const resultCx = result.x + result.width / 2;
		const resultCy = result.y + result.height / 2;
		expect(resultCx).toBeCloseTo(originalCx);
		expect(resultCy).toBeCloseTo(originalCy);
	});
});

describe("normalizeAngle", () => {
	it("正の角度をそのまま返す", () => {
		expect(normalizeAngle(45)).toBe(45);
	});

	it("360° を 0° にする", () => {
		expect(normalizeAngle(360)).toBe(0);
	});

	it("負の角度を正に変換する", () => {
		expect(normalizeAngle(-90)).toBe(270);
	});

	it("720° を 0° にする", () => {
		expect(normalizeAngle(720)).toBe(0);
	});

	it("-450° を 270° にする", () => {
		expect(normalizeAngle(-450)).toBe(270);
	});
});

describe("snapAngle", () => {
	it("15° スナップで 7° → 0°", () => {
		expect(snapAngle(7, 15)).toBe(0);
	});

	it("15° スナップで 8° → 15°", () => {
		expect(snapAngle(8, 15)).toBe(15);
	});

	it("15° スナップで 45° → 45°", () => {
		expect(snapAngle(45, 15)).toBe(45);
	});

	it("90° スナップで 50° → 90°", () => {
		expect(snapAngle(50, 90)).toBe(90);
	});
});

describe("deltaToLocal", () => {
	it("0° で同じデルタを返す", () => {
		const result = deltaToLocal({ x: 10, y: 5 }, 0);
		expect(result.x).toBe(10);
		expect(result.y).toBe(5);
	});

	it("90° 回転でデルタが変換される", () => {
		const result = deltaToLocal({ x: 10, y: 0 }, 90);
		expect(result.x).toBeCloseTo(0);
		expect(result.y).toBeCloseTo(-10);
	});

	it("180° 回転でデルタが反転する", () => {
		const result = deltaToLocal({ x: 10, y: 5 }, 180);
		expect(result.x).toBeCloseTo(-10);
		expect(result.y).toBeCloseTo(-5);
	});
});

describe("safeRotation", () => {
	it("有限数をそのまま返す", () => {
		expect(safeRotation(45)).toBe(45);
	});

	it("undefined → 0", () => {
		expect(safeRotation(undefined)).toBe(0);
	});

	it("NaN → 0", () => {
		expect(safeRotation(Number.NaN)).toBe(0);
	});

	it("Infinity → 0", () => {
		expect(safeRotation(Number.POSITIVE_INFINITY)).toBe(0);
	});

	it("文字列 → 0", () => {
		expect(safeRotation("45")).toBe(0);
	});
});

describe("withRotation", () => {
	function makeShape(rotation?: number): ShapeData {
		return {
			id: "s1",
			type: "rectangle",
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			rotation,
			style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
		};
	}

	const alwaysTrue = () => true;
	const aabbHit = (data: ShapeData, point: { x: number; y: number }) =>
		point.x >= data.x &&
		point.x <= data.x + data.width &&
		point.y >= data.y &&
		point.y <= data.y + data.height;

	it("rotation=0 で元の関数をそのまま呼ぶ", () => {
		const wrapped = withRotation(aabbHit);
		expect(wrapped(makeShape(0), { x: 50, y: 50 })).toBe(true);
		expect(wrapped(makeShape(0), { x: 150, y: 50 })).toBe(false);
	});

	it("rotation=undefined で元の関数をそのまま呼ぶ", () => {
		const wrapped = withRotation(aabbHit);
		expect(wrapped(makeShape(), { x: 50, y: 50 })).toBe(true);
	});

	it("rotation=90 でポイントを逆回転してからテスト", () => {
		const wrapped = withRotation(aabbHit);
		// 100x100 の正方形を90°回転しても同じ正方形なので、中心付近は当たる
		expect(wrapped(makeShape(90), { x: 50, y: 50 })).toBe(true);
		// AABB の外は当たらない
		expect(wrapped(makeShape(90), { x: 150, y: 50 })).toBe(false);
	});

	it("NaN rotation で元の関数にフォールバック", () => {
		const wrapped = withRotation(alwaysTrue);
		expect(wrapped(makeShape(Number.NaN), { x: 0, y: 0 })).toBe(true);
	});
});

describe("placeLocalBox", () => {
	it("回転 0 ならローカルの x/y をそのまま返す", () => {
		expect(placeLocalBox({ x: 5, y: 6, width: 10, height: 10 }, { x: 0, y: 0 }, 0)).toEqual({
			x: 5,
			y: 6,
		});
	});

	it("箱の中心を pivot まわりに回した位置に置く", () => {
		// 中心 (150, 50) を (50, 50) まわりに 90° → (50, 150)
		const p = placeLocalBox({ x: 100, y: 0, width: 100, height: 100 }, { x: 50, y: 50 }, 90);
		expect(p.x).toBeCloseTo(0);
		expect(p.y).toBeCloseTo(100);
	});
});

describe("keepRotatedTopLeft", () => {
	it("回転していなければ null", () => {
		expect(keepRotatedTopLeft({ x: 0, y: 0, width: 10, height: 10 }, 20, 20)).toBeNull();
	});

	it("大きさを変えても画面上の左上の角が動かない", () => {
		const shape = { x: 0, y: 0, width: 200, height: 100, rotation: 30 };
		const corner = (s: { x: number; y: number; width: number; height: number }) =>
			rotatePoint(
				{ x: s.x, y: s.y },
				{ x: s.x + s.width / 2, y: s.y + s.height / 2 },
				(30 * Math.PI) / 180,
			);
		const pos = keepRotatedTopLeft(shape, 260, 180);
		expect(pos).not.toBeNull();
		const before = corner(shape);
		const after = corner({ x: pos?.x ?? 0, y: pos?.y ?? 0, width: 260, height: 180 });
		expect(after.x).toBeCloseTo(before.x);
		expect(after.y).toBeCloseTo(before.y);
	});
});

describe("getShapeWorldAABB / rectIntersectsShape / shapeBoxContainsPoint", () => {
	// 200x20 bar turned 90° about (100, 10): drawn over x 90..110, y -90..110.
	const bar = { x: 0, y: 0, width: 200, height: 20, rotation: 90 };

	it("外接矩形は描かれた範囲", () => {
		const b = getShapeWorldAABB(bar);
		expect(b.x).toBeCloseTo(90);
		expect(b.y).toBeCloseTo(-90);
		expect(b.width).toBeCloseTo(20);
		expect(b.height).toBeCloseTo(200);
	});

	it("回転前の箱にだけかかる矩形とは重ならない", () => {
		expect(rectIntersectsShape({ x: 0, y: 0, width: 50, height: 20 }, bar)).toBe(false);
		expect(rectIntersectsShape({ x: 95, y: -80, width: 5, height: 5 }, bar)).toBe(true);
	});

	it("ひし形の外接矩形の空いた隅には重ならない", () => {
		const diamond = { x: 0, y: 0, width: 100, height: 100, rotation: 45 };
		// The AABB's top-left corner region, outside the diamond.
		expect(rectIntersectsShape({ x: -20, y: -20, width: 15, height: 15 }, diamond)).toBe(false);
		expect(rectIntersectsShape({ x: 45, y: 45, width: 10, height: 10 }, diamond)).toBe(true);
	});

	it("点の内外を回転込みで判定する", () => {
		expect(shapeBoxContainsPoint(bar, { x: 100, y: -80 })).toBe(true);
		expect(shapeBoxContainsPoint(bar, { x: 20, y: 10 })).toBe(false);
	});
});
