import type { ShapeStyle } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { eraserHits, hitStroke, maxHalfWidth, strokeBounds } from "../geometry/hit.js";
import { createFreedrawShapeDefinition } from "../shape.js";
import type { FreedrawShapeData, PenKind, StrokePoint } from "../types.js";

const style = (strokeWidth: number): ShapeStyle => ({
	fill: "#fff",
	stroke: "#000",
	strokeWidth,
	opacity: 1,
});

function fd(points: StrokePoint[], strokeWidth = 4, pen?: PenKind): FreedrawShapeData {
	return {
		id: "s",
		type: "freedraw",
		x: 0,
		y: 0,
		width: 0,
		height: 0,
		style: style(strokeWidth),
		points,
		pen,
	};
}

describe("hitStroke", () => {
	const shape = fd([
		{ x: 0, y: 0 },
		{ x: 100, y: 0 },
	]);
	it("線の近くは true", () => {
		expect(hitStroke(shape, { x: 50, y: 1 })).toBe(true);
	});
	it("線から遠いと false", () => {
		expect(hitStroke(shape, { x: 50, y: 40 })).toBe(false);
	});
	it("1点は円判定", () => {
		const dot = fd([{ x: 10, y: 10 }], 20);
		expect(hitStroke(dot, { x: 12, y: 12 })).toBe(true);
		expect(hitStroke(dot, { x: 40, y: 40 })).toBe(false);
	});
	it("半幅 + tolerance ちょうどの点（線の横・端の先）は true のまま", () => {
		// size 4 → 半幅 2、tolerance 2 → 判定半径 4
		expect(hitStroke(shape, { x: 50, y: 4 })).toBe(true);
		expect(hitStroke(shape, { x: 50, y: -4 })).toBe(true);
		expect(hitStroke(shape, { x: -4, y: 0 })).toBe(true);
		expect(hitStroke(shape, { x: 104, y: 0 })).toBe(true);
		expect(hitStroke(shape, { x: 50, y: 4.01 })).toBe(false);
		expect(hitStroke(shape, { x: 104.01, y: 0 })).toBe(false);
	});
	it("筆ペンは筆圧の高い点の太さまで届く", () => {
		// size 10: 半幅 = (min + (max - min) * p) / 2, min = 2.2, max = 15.5
		const brush = fd(
			[
				{ x: 0, y: 0, p: 0 },
				{ x: 100, y: 0, p: 1 },
			],
			10,
			"brush",
		);
		expect(hitStroke(brush, { x: 50, y: 15.5 / 2 + 2 })).toBe(true);
		expect(hitStroke(brush, { x: 50, y: 15.5 / 2 + 2.1 })).toBe(false);
	});
	it("同じ shape で何度呼んでも、点から遠い・近いの結果は変わらない", () => {
		for (let i = 0; i < 3; i++) {
			expect(hitStroke(shape, { x: 500, y: 500 })).toBe(false);
			expect(hitStroke(shape, { x: 50, y: 1 })).toBe(true);
		}
	});
});

describe("strokeBounds", () => {
	it("最大半幅ぶん padding する", () => {
		const b = strokeBounds(
			fd(
				[
					{ x: 0, y: 0 },
					{ x: 10, y: 0 },
				],
				4,
			),
		);
		expect(b.x).toBe(-2);
		expect(b.width).toBe(14);
	});
});

describe("maxHalfWidth", () => {
	it("筆ペンは size×1.55/2", () => {
		expect(maxHalfWidth(fd([{ x: 0, y: 0 }], 10, "brush"))).toBeCloseTo((10 * 1.55) / 2);
	});
	it("一定幅は size/2", () => {
		expect(maxHalfWidth(fd([{ x: 0, y: 0 }], 10, "felt"))).toBe(5);
	});
});

describe("eraserHits", () => {
	const shape = fd(
		[
			{ x: 0, y: 0 },
			{ x: 50, y: 0 },
		],
		4,
	);
	it("点が消しゴム円内なら true", () => {
		expect(eraserHits(shape, { x: 50, y: 3 }, 6)).toBe(true);
	});
	it("どの点も外なら false", () => {
		expect(eraserHits(shape, { x: 25, y: 100 }, 6)).toBe(false);
	});
	it("点が無ければ false", () => {
		expect(eraserHits(fd([]), { x: 0, y: 0 }, 6)).toBe(false);
	});
	it("筆ペンは太い点の半幅ぶんまで届く（範囲の事前判定で取りこぼさない）", () => {
		// size 10: p=1 の点の半幅は 7.75、p=0 の点は 1.1。
		const brush = fd(
			[
				{ x: 0, y: 0, p: 0 },
				{ x: 100, y: 0, p: 1 },
			],
			10,
			"brush",
		);
		expect(eraserHits(brush, { x: 100, y: 7.7 + 3 }, 3)).toBe(true);
		expect(eraserHits(brush, { x: 100, y: 7.8 + 3 }, 3)).toBe(false);
	});
	it("全点を調べる素朴な判定と結果が一致する", () => {
		let seed = 7;
		const rand = () => {
			seed = (seed * 1664525 + 1013904223) >>> 0;
			return seed / 2 ** 32;
		};
		const pens: PenKind[] = ["ballpoint", "felt", "brush", "highlighter"];
		const naive = (data: FreedrawShapeData, c: StrokePoint, r: number) => {
			const size = data.style.strokeWidth;
			return data.points.some((pt) => {
				const half =
					data.pen === "brush"
						? (Math.max(0.6, size * 0.22) +
								(size * 1.55 - Math.max(0.6, size * 0.22)) * (pt.p ?? 0.5)) /
							2
						: size / 2;
				return Math.hypot(pt.x - c.x, pt.y - c.y) <= r + half;
			});
		};
		for (let i = 0; i < 40; i++) {
			const pen = pens[i % pens.length];
			const points: StrokePoint[] = Array.from({ length: 1 + Math.floor(rand() * 20) }, () => ({
				x: rand() * 200,
				y: rand() * 200,
				p: pen === "brush" ? rand() : undefined,
			}));
			const data = fd(points, 1 + rand() * 20, pen);
			for (let k = 0; k < 50; k++) {
				const c = { x: rand() * 300 - 50, y: rand() * 300 - 50 };
				const r = 1 + rand() * 15;
				expect(eraserHits(data, c, r)).toBe(naive(data, c, r));
			}
		}
	});
	it("更新後の shape（新しいオブジェクト）は新しい点で判定する", () => {
		const before = fd([{ x: 0, y: 0 }], 4);
		expect(eraserHits(before, { x: 500, y: 500 }, 6)).toBe(false);
		const after = { ...before, points: [{ x: 500, y: 500 }] };
		expect(eraserHits(after, { x: 500, y: 500 }, 6)).toBe(true);
		expect(eraserHits(before, { x: 500, y: 500 }, 6)).toBe(false);
	});
});

describe("createFreedrawShapeDefinition hitTest mode", () => {
	const shape = fd([
		{ x: 0, y: 0 },
		{ x: 100, y: 0 },
		{ x: 100, y: 100 },
	]);
	const gap = { x: 20, y: 80 };

	it("stroke モードではストロークの隙間は当たらない", () => {
		const def = createFreedrawShapeDefinition(() => "stroke");
		expect(def.hitTest(shape, gap)).toBe(false);
		expect(def.hitTest(shape, { x: 50, y: 0 })).toBe(true);
	});

	it("bounds モードでは外接矩形内なら当たる", () => {
		const def = createFreedrawShapeDefinition(() => "bounds");
		expect(def.hitTest(shape, gap)).toBe(true);
		expect(def.hitTest(shape, { x: 300, y: 300 })).toBe(false);
	});

	it("モードは判定ごとに評価される", () => {
		let mode: "stroke" | "bounds" = "stroke";
		const def = createFreedrawShapeDefinition(() => mode);
		expect(def.hitTest(shape, gap)).toBe(false);
		mode = "bounds";
		expect(def.hitTest(shape, gap)).toBe(true);
	});
});
