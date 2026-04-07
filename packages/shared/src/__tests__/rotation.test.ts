import { describe, expect, it } from "vitest";
import {
	deltaToLocal,
	getRotatedAABB,
	normalizeAngle,
	rotatePoint,
	snapAngle,
	unrotatePoint,
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
