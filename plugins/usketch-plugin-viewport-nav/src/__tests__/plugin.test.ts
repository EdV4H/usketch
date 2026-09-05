import type { CanvasWheelEvent, PluginContext, Point } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { createViewportNavPlugin, type ViewportNavOptions } from "../plugin.js";

/** zoomTo / panBy の呼び出しを記録する最小限の PluginContext スタブ。 */
function makeCtx(initialZoom = 1) {
	const handlers = new Map<string, ((data: unknown) => void)[]>();
	const zoomCalls: { zoom: number; center: Point }[] = [];
	const panCalls: { dx: number; dy: number }[] = [];
	const ctx = {
		store: {
			getViewport: () => ({ x: 0, y: 0, zoom: initialZoom }),
			zoomTo: (zoom: number, center: Point) => {
				zoomCalls.push({ zoom, center });
			},
			panBy: (dx: number, dy: number) => {
				panCalls.push({ dx, dy });
			},
		},
		events: {
			on: (e: string, h: (data: unknown) => void) => {
				const list = handlers.get(e) ?? [];
				list.push(h);
				handlers.set(e, list);
				return () => {
					handlers.set(
						e,
						(handlers.get(e) ?? []).filter((x) => x !== h),
					);
				};
			},
			emit: (e: string, data: unknown) => {
				for (const h of handlers.get(e) ?? []) h(data);
			},
		},
	} as unknown as PluginContext;
	const wheel = (partial: Partial<CanvasWheelEvent>) =>
		ctx.events.emit("canvas:wheel", {
			deltaX: 0,
			deltaY: 0,
			screenPoint: { x: 200, y: 150 },
			ctrlKey: false,
			metaKey: false,
			...partial,
		});
	return { ctx, wheel, zoomCalls, panCalls };
}

function setup(options?: ViewportNavOptions, initialZoom = 1) {
	const h = makeCtx(initialZoom);
	createViewportNavPlugin(options).setup(h.ctx);
	return h;
}

describe("createViewportNavPlugin — wheel zoom", () => {
	it("既定感度: deltaY の大きさに比例し、従来の 0.9/1.1 相当になる（後方互換）", () => {
		const { wheel, zoomCalls } = setup();
		wheel({ deltaY: 100, ctrlKey: true }); // 縮小
		wheel({ deltaY: -100, ctrlKey: true }); // 拡大
		expect(zoomCalls[0].zoom).toBeCloseTo(Math.exp(-0.1), 5); // ≈0.9048
		expect(zoomCalls[1].zoom).toBeCloseTo(Math.exp(0.1), 5); // ≈1.1052
		expect(zoomCalls[0].zoom).toBeGreaterThan(0.89);
		expect(zoomCalls[0].zoom).toBeLessThan(0.91);
		expect(zoomCalls[1].zoom).toBeGreaterThan(1.09);
		expect(zoomCalls[1].zoom).toBeLessThan(1.11);
	});

	it("deltaY の大きさで倍率変化が変わる（符号だけでない）", () => {
		const { wheel, zoomCalls } = setup();
		wheel({ deltaY: 10, ctrlKey: true }); // 小さいピンチ
		wheel({ deltaY: 100, ctrlKey: true }); // 大きいホイール
		// 小 deltaY はほぼ等倍(1に近い)、大 deltaY は大きく縮小
		expect(zoomCalls[0].zoom).toBeGreaterThan(zoomCalls[1].zoom);
		expect(zoomCalls[0].zoom).toBeCloseTo(Math.exp(-0.01), 5);
	});

	it("zoomSensitivity を上げると 1 操作あたりの倍率変化が大きくなる", () => {
		const base = setup();
		base.wheel({ deltaY: -100, ctrlKey: true });
		const strong = setup({ zoomSensitivity: 2.5 });
		strong.wheel({ deltaY: -100, ctrlKey: true });
		expect(strong.zoomCalls[0].zoom).toBeGreaterThan(base.zoomCalls[0].zoom);
		expect(strong.zoomCalls[0].zoom).toBeCloseTo(Math.exp(0.1 * 2.5), 5);
	});

	it("zoomSensitivity は範囲外をクランプする（0.25〜3）", () => {
		const tooHigh = setup({ zoomSensitivity: 999 });
		tooHigh.wheel({ deltaY: -100, ctrlKey: true });
		expect(tooHigh.zoomCalls[0].zoom).toBeCloseTo(Math.exp(0.1 * 3), 5);
		const tooLow = setup({ zoomSensitivity: 0 });
		tooLow.wheel({ deltaY: -100, ctrlKey: true });
		expect(tooLow.zoomCalls[0].zoom).toBeCloseTo(Math.exp(0.1 * 0.25), 5);
	});

	it("getter 形式で毎イベント最新値を読む（ライブ反映）", () => {
		let s = 1;
		const { wheel, zoomCalls } = setup({ zoomSensitivity: () => s });
		wheel({ deltaY: -100, ctrlKey: true });
		s = 2.5;
		wheel({ deltaY: -100, ctrlKey: true });
		expect(zoomCalls[0].zoom).toBeCloseTo(Math.exp(0.1), 5);
		expect(zoomCalls[1].zoom).toBeCloseTo(Math.exp(0.1 * 2.5), 5);
	});

	it("不正な感度(NaN/undefined)は 1 にフォールバック", () => {
		const nan = setup({ zoomSensitivity: Number.NaN });
		nan.wheel({ deltaY: -100, ctrlKey: true });
		expect(nan.zoomCalls[0].zoom).toBeCloseTo(Math.exp(0.1), 5);
	});

	it("zoomTo にはカーソル位置を渡す", () => {
		const { wheel, zoomCalls } = setup();
		wheel({ deltaY: -100, ctrlKey: true, screenPoint: { x: 42, y: 7 } });
		expect(zoomCalls[0].center).toEqual({ x: 42, y: 7 });
	});

	it("metaKey でもズームする", () => {
		const { wheel, zoomCalls, panCalls } = setup();
		wheel({ deltaY: -100, metaKey: true });
		expect(zoomCalls).toHaveLength(1);
		expect(panCalls).toHaveLength(0);
	});

	it("修飾キー無しはパン（ズームしない）", () => {
		const { wheel, zoomCalls, panCalls } = setup();
		wheel({ deltaX: 30, deltaY: 20 });
		expect(zoomCalls).toHaveLength(0);
		expect(panCalls[0]).toEqual({ dx: -30, dy: -20 });
	});
});
