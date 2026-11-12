import type { CanvasPointerEvent, ShapeStyle, ToolContext } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseFreedrawConfig } from "../config.js";
import { clampPenSize, type FreedrawPenDefinition, registerPen } from "../custom-pens.js";
import { createDrawController } from "../draw-tool.js";
import { findErasedStrokes } from "../eraser.js";
import { listPens } from "../freedraw-service.js";
import { hitStroke, maxHalfWidth, strokeBounds } from "../geometry/hit.js";
import { isKnownPen, penMeta } from "../pen-meta.js";
import { createFreedrawPlugin } from "../plugin.js";
import { createFreedrawSettingsStore } from "../settings-store.js";
import { freedrawShapeDefinition } from "../shape.js";
import type { FreedrawShapeData, StrokePoint } from "../types.js";
import { createPointerStore } from "../ui/cursor-overlay.js";

const style = (strokeWidth: number): ShapeStyle => ({
	fill: "#fff",
	stroke: "#000",
	strokeWidth,
	opacity: 1,
});

function fd(points: StrokePoint[], strokeWidth: number, pen?: string): FreedrawShapeData {
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

const line: StrokePoint[] = [
	{ x: 0, y: 0 },
	{ x: 100, y: 0 },
];

// 道路のように「太さ / 2 + 10」まで描くペン。確定時に点を 2 倍にし、点の数を penData に残す。
const road: FreedrawPenDefinition = {
	id: "road",
	label: "道路",
	defaultSize: 40,
	sizeRange: { min: 20, max: 200 },
	usesColor: false,
	render: () => createElement("g", { "data-pen": "road" }),
	renderDraft: () => createElement("g", { "data-pen": "road-draft" }),
	finalize: (points, { size }) => ({
		points: points.map((p) => ({ x: p.x * 2, y: p.y * 2 })),
		penData: { count: points.length, size },
	}),
	halfWidth: (size) => size / 2 + 10,
};

let off: (() => void) | null = null;
beforeEach(() => {
	off = registerPen(road);
});
afterEach(() => {
	off?.();
	off = null;
	vi.unstubAllGlobals();
});

describe("registerPen", () => {
	it("登録したペンが一覧・既知のペンに入り、外すと消える", () => {
		expect(isKnownPen("road")).toBe(true);
		expect(listPens().map((p) => p.id)).toEqual([
			"ballpoint",
			"felt",
			"brush",
			"highlighter",
			"road",
		]);
		expect(listPens().at(-1)).toMatchObject({ usesColor: false, builtIn: false });
		off?.();
		off = null;
		expect(isKnownPen("road")).toBe(false);
		expect(listPens().map((p) => p.id)).not.toContain("road");
	});

	it("組み込みのペンの id は登録できない", () => {
		expect(() => registerPen({ ...road, id: "felt" })).toThrow();
	});

	it("プラグインに組み込みの id を渡すと、何も登録しないうちに弾く", () => {
		const other = { ...road, id: "other" };
		expect(() =>
			createFreedrawPlugin(undefined, { pens: [other, { ...road, id: "felt" }] }),
		).toThrow();
		expect(isKnownPen("other")).toBe(false);
	});

	it("同じ定義は登録した数だけ外すまで残る（複数ボードで共有）", () => {
		const offSecond = registerPen(road);
		off?.();
		off = null;
		expect(isKnownPen("road")).toBe(true);
		offSecond();
		offSecond(); // 2 回呼んでも 1 回ぶん
		expect(isKnownPen("road")).toBe(false);
	});

	it("置き換えたあとで古い登録を外しても、新しい定義は残る", () => {
		const next = { ...road, label: "新しい道路" };
		const offNext = registerPen(next);
		off?.();
		off = offNext;
		expect(listPens().at(-1)?.label).toBe("新しい道路");
	});

	it("penMeta は一定幅・不透明・通常合成", () => {
		expect(penMeta("road")).toMatchObject({
			label: "道路",
			defaultSize: 40,
			variable: false,
			alpha: 1,
			blend: "normal",
		});
	});

	it("太さは範囲に丸める", () => {
		expect(clampPenSize(road, 5)).toBe(20);
		expect(clampPenSize(road, 500)).toBe(200);
		expect(clampPenSize(road, 80)).toBe(80);
		expect(clampPenSize(undefined, 500)).toBe(500);
	});
});

describe("外から足したペンの当たり判定", () => {
	it("halfWidth が外接矩形・当たり判定・消しゴムに効く", () => {
		const shape = fd(line, 40, "road");
		expect(maxHalfWidth(shape)).toBe(30);
		expect(strokeBounds(shape)).toEqual({ x: -30, y: -30, width: 160, height: 60 });
		expect(hitStroke(shape, { x: 50, y: 29 })).toBe(true);
		expect(hitStroke(shape, { x: 50, y: 40 })).toBe(false);

		const store = createBoardStore();
		store.addShape({ ...shape, id: "r" });
		expect(findErasedStrokes(store, { x: 100, y: 35 }, 10).map((s) => s.id)).toEqual(["r"]);
	});

	it("登録していないペンはボールペン扱い（太さ / 2）", () => {
		const shape = fd(line, 40, "unknown");
		expect(maxHalfWidth(shape)).toBe(20);
	});
});

describe("外から足したペンの描画", () => {
	it("確定は render、描画中は renderDraft", () => {
		const done = freedrawShapeDefinition.render(fd(line, 40, "road"));
		expect(done.props).toMatchObject({ "data-pen": "road" });
		const draft = freedrawShapeDefinition.render({ ...fd(line, 40, "road"), draft: true });
		expect(draft.props).toMatchObject({ "data-pen": "road-draft" });
	});

	it("GPU には回さない", () => {
		expect(freedrawShapeDefinition.gpuPrimitive?.(fd(line, 40, "road"))).toBeNull();
	});

	it("登録していないペンはボールペンの線で描く", () => {
		const el = freedrawShapeDefinition.render(fd(line, 40, "unknown"));
		expect(el.type).toBe("path");
		expect(el.props).toMatchObject({ stroke: "#000", strokeWidth: 40 });
	});
});

describe("外から足したペンの設定", () => {
	it("知らない defaultPen は ballpoint にする", () => {
		const s = createFreedrawSettingsStore(
			parseFreedrawConfig({ persistSettings: false, defaultPen: "pencil" }),
		);
		expect(s.getSnapshot().pen).toBe("ballpoint");
		const r = createFreedrawSettingsStore(
			parseFreedrawConfig({ persistSettings: false, defaultPen: "road" }),
		);
		expect(r.getSnapshot().pen).toBe("road");
	});

	it("足したペンの太さは範囲に丸める（保存値が範囲外でも）", () => {
		const s = createFreedrawSettingsStore(parseFreedrawConfig({ persistSettings: false }));
		s.update({ pen: "road", sizes: { ...s.getSnapshot().sizes, road: 500 } });
		expect(s.currentSize()).toBe(200);
	});

	it("太さが無ければ既定の太さを使う", () => {
		const s = createFreedrawSettingsStore(parseFreedrawConfig({ persistSettings: false }));
		s.update({ pen: "road" });
		expect(s.currentSize()).toBe(40);
	});

	it("保存したペンが登録されていなければ既定のペンに戻す", () => {
		const map = new Map<string, string>();
		vi.stubGlobal("localStorage", {
			getItem: (k: string) => map.get(k) ?? null,
			setItem: (k: string, v: string) => void map.set(k, v),
		});
		const a = createFreedrawSettingsStore(parseFreedrawConfig({}));
		a.update({ pen: "road" });
		expect(createFreedrawSettingsStore(parseFreedrawConfig({})).getSnapshot().pen).toBe("road");
		off?.();
		off = null;
		expect(createFreedrawSettingsStore(parseFreedrawConfig({})).getSnapshot().pen).toBe(
			"ballpoint",
		);
	});
});

describe("外から足したペンで描く", () => {
	it("描画中は draft、確定で finalize の点と penData を保存する", () => {
		vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
			cb();
			return 1;
		});
		vi.stubGlobal("cancelAnimationFrame", () => {});
		const store = createBoardStore();
		const toolCtx = {
			store,
			commands: { execute: (c: { execute(): void }) => c.execute() },
		} as unknown as ToolContext;
		const settings = createFreedrawSettingsStore(parseFreedrawConfig({ persistSettings: false }));
		settings.update({ pen: "road" });
		const draw = createDrawController(settings, createPointerStore());
		const ev = (x: number, y: number) =>
			({
				button: 0,
				worldPoint: { x, y },
				screenPoint: { x, y },
			}) as unknown as CanvasPointerEvent;

		draw.onPointerDown(toolCtx, ev(0, 0));
		draw.onPointerMove(toolCtx, ev(50, 0));
		const drafts = [...store.getShapes().values()] as FreedrawShapeData[];
		expect(drafts).toHaveLength(1);
		expect(drafts[0]).toMatchObject({ pen: "road", draft: true });

		draw.onPointerMove(toolCtx, ev(100, 0));
		draw.onPointerUp(toolCtx, ev(100, 0));
		const shapes = [...store.getShapes().values()] as FreedrawShapeData[];
		expect(shapes).toHaveLength(1);
		const saved = shapes[0];
		expect(saved.draft).toBeUndefined();
		expect(saved.style.strokeWidth).toBe(40);
		expect(saved.points.at(-1)).toMatchObject({ x: 200, y: 0 });
		expect(saved.penData).toEqual({ count: 2, size: 40 });
		// 外接矩形は finalize 後の点 + halfWidth（40 / 2 + 10）。
		expect(saved).toMatchObject({ x: -30, y: -30, width: 260, height: 60 });
	});
});
