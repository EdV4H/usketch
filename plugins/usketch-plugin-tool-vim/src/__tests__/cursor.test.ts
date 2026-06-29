import { describe, expect, it } from "vitest";
import { computeCandidates } from "../candidates.js";
import { parseVimConfig } from "../config/default-config.js";
import { findDirectionalNearest, findNearestShape, moveCursorBy, snapToGrid } from "../cursor.js";
import { addRect, makeDeps } from "./test-helpers.js";

describe("moveCursorBy / snapToGrid", () => {
	it("方向に応じてオフセット", () => {
		expect(moveCursorBy({ x: 0, y: 0 }, "right", 20)).toEqual({ x: 20, y: 0 });
		expect(moveCursorBy({ x: 0, y: 0 }, "up", 20)).toEqual({ x: 0, y: -20 });
	});
	it("グリッドスナップ", () => {
		expect(snapToGrid({ x: 23, y: 38 }, 20)).toEqual({ x: 20, y: 40 });
	});
});

describe("findNearestShape", () => {
	it("最も近い shape の中心を選ぶ", () => {
		const deps = makeDeps();
		addRect(deps, 0, 0); // center (50,40)
		const far = addRect(deps, 500, 500);
		expect(findNearestShape(deps, { x: 60, y: 50 })).toBe("s_0_0");
		expect(findNearestShape(deps, { x: 560, y: 560 })).toBe(far);
	});
});

describe("findDirectionalNearest", () => {
	it("指定方向の cone 内で最近傍を返す", () => {
		const deps = makeDeps();
		const center = addRect(deps, 0, 0); // center (50,40)
		const right = addRect(deps, 200, 0); // center (250,40)
		const left = addRect(deps, -200, 0); // center (-150,40)
		const from = { x: 50, y: 40 };
		const exclude = new Set([center]);
		expect(findDirectionalNearest(deps, from, "right", exclude)).toBe(right);
		expect(findDirectionalNearest(deps, from, "left", exclude)).toBe(left);
		// 上方向には何もない
		expect(findDirectionalNearest(deps, from, "up", exclude)).toBeNull();
	});
});

describe("computeCandidates", () => {
	const config = parseVimConfig();
	it("空バッファは空配列", () => {
		const deps = makeDeps();
		expect(computeCandidates(deps, config, "")).toEqual([]);
	});
	it("前方一致で別名を返す", () => {
		const deps = makeDeps(["rectangle", "sticky", "ellipse"]);
		const got = computeCandidates(deps, config, "re");
		expect(got.some((c) => c.spec.type === "rectangle")).toBe(true);
	});
	it("レジストリ型名を自動補完する（マップに無くても）", () => {
		const deps = makeDeps(["ellipse"]);
		const got = computeCandidates(deps, config, "ellip");
		expect(got[0]?.spec.type).toBe("ellipse");
	});
});
