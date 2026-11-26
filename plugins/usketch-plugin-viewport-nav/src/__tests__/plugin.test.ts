import type {
	CanvasWheelEvent,
	HudSettingsDescriptor,
	PluginContext,
	Point,
} from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { createViewportNavPlugin, type ViewportNavOptions } from "../plugin.js";
import { getViewportNavApi } from "../viewport-nav-service.js";
import type { ViewportNavStorage } from "../viewport-nav-settings.js";

/** zoomTo / panBy の呼び出しを記録する最小限の PluginContext スタブ。 */
function makeCtx(initialZoom = 1) {
	const handlers = new Map<string, ((data: unknown) => void)[]>();
	const zoomCalls: { zoom: number; center: Point }[] = [];
	const panCalls: { dx: number; dy: number }[] = [];
	const hudSettings: HudSettingsDescriptor[] = [];
	const services = new Map<string, unknown>();
	const ctx = {
		hud: {
			registerSettings: (d: HudSettingsDescriptor) => {
				hudSettings.push(d);
				return () => hudSettings.splice(hudSettings.indexOf(d), 1);
			},
		},
		services: {
			provide: (key: string, api: unknown) => {
				services.set(key, api);
				return () => services.delete(key);
			},
			get: (key: string) => services.get(key),
			has: (key: string) => services.has(key),
		},
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
	return { ctx, wheel, zoomCalls, panCalls, hudSettings, services };
}

function setup(options?: ViewportNavOptions, initialZoom = 1) {
	const h = makeCtx(initialZoom);
	// 既定では localStorage に保存しないテストにする（テスト間で設定が漏れないように）。
	createViewportNavPlugin({ storage: false, ...options }).setup(h.ctx);
	const api = getViewportNavApi(h.ctx.services);
	if (!api) throw new Error("service not provided");
	return { ...h, api };
}

/** トラックパッドらしいイベント（Chrome: wheelDelta = -3 × delta）。 */
const trackpad = (deltaY: number, extra: Partial<CanvasWheelEvent> = {}) => ({
	deltaY,
	wheelDeltaY: -3 * deltaY,
	...extra,
});
/** マウスホイールらしいイベント（Chrome: wheelDelta = ±120 刻み）。 */
const mouse = (deltaY: number, extra: Partial<CanvasWheelEvent> = {}) => ({
	deltaY,
	wheelDeltaY: deltaY > 0 ? -120 : 120,
	...extra,
});

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

	it("zoomSensitivity は既定範囲外をクランプする（0.25〜6）", () => {
		const tooHigh = setup({ zoomSensitivity: 999 });
		tooHigh.wheel({ deltaY: -100, ctrlKey: true });
		expect(tooHigh.zoomCalls[0].zoom).toBeCloseTo(Math.exp(0.1 * 6), 5);
		const tooLow = setup({ zoomSensitivity: 0 });
		tooLow.wheel({ deltaY: -100, ctrlKey: true });
		expect(tooLow.zoomCalls[0].zoom).toBeCloseTo(Math.exp(0.1 * 0.25), 5);
	});

	it("zoomSensitivity=6 は s=3 より明確に速い（#1087）", () => {
		const s3 = setup({ zoomSensitivity: 3 });
		s3.wheel({ deltaY: -100, ctrlKey: true });
		const s6 = setup({ zoomSensitivity: 6 });
		s6.wheel({ deltaY: -100, ctrlKey: true });
		expect(s6.zoomCalls[0].zoom).toBeGreaterThan(s3.zoomCalls[0].zoom);
		expect(s6.zoomCalls[0].zoom).toBeCloseTo(Math.exp(0.1 * 6), 5);
	});

	it("zoomSensitivityRange でホストがクランプ上限を上書きできる", () => {
		const wide = setup({ zoomSensitivity: 100, zoomSensitivityRange: { max: 10 } });
		wide.wheel({ deltaY: -100, ctrlKey: true });
		expect(wide.zoomCalls[0].zoom).toBeCloseTo(Math.exp(0.1 * 10), 5);
		// 下限も上書きできる
		const narrow = setup({ zoomSensitivity: 0.01, zoomSensitivityRange: { min: 0.5 } });
		narrow.wheel({ deltaY: -100, ctrlKey: true });
		expect(narrow.zoomCalls[0].zoom).toBeCloseTo(Math.exp(0.1 * 0.5), 5);
	});

	it("破綻した range（min > max）は既定にフォールバック", () => {
		const bad = setup({ zoomSensitivity: 999, zoomSensitivityRange: { min: 8, max: 2 } });
		bad.wheel({ deltaY: -100, ctrlKey: true });
		expect(bad.zoomCalls[0].zoom).toBeCloseTo(Math.exp(0.1 * 6), 5); // 既定 max=6
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

describe("createViewportNavPlugin — mouse / trackpad sensitivity", () => {
	it("既定ではマウスもトラックパッドも従来どおり（感度 1）", () => {
		const { wheel, panCalls, zoomCalls } = setup();
		wheel(mouse(100));
		wheel(trackpad(-2.5, { deltaX: 0 }));
		expect(panCalls[0]).toEqual({ dx: -0, dy: -100 });
		expect(panCalls[1]).toEqual({ dx: -0, dy: 2.5 });
		expect(zoomCalls).toHaveLength(0);
	});

	it("マウスとトラックパッドで別々のスクロール速度を使う", () => {
		let t = 0;
		const h = setup({ mouse: { panSensitivity: 2 }, trackpad: { panSensitivity: 0.5 } });
		// 判定は時間で区切るので、別の操作として十分空ける
		const realNow = performance.now;
		performance.now = () => t;
		try {
			h.wheel(mouse(100));
			t += 1000;
			h.wheel(trackpad(10));
		} finally {
			performance.now = realNow;
		}
		expect(h.panCalls[0].dy).toBe(-200);
		expect(h.panCalls[1].dy).toBe(-5);
	});

	it("マウスとトラックパッドで別々のズーム速度を使う", () => {
		let t = 0;
		const realNow = performance.now;
		performance.now = () => t;
		try {
			const h = setup({ mouse: { zoomSensitivity: 0.5 }, trackpad: { zoomSensitivity: 3 } });
			h.wheel(mouse(-100, { ctrlKey: true }));
			t += 1000;
			h.wheel(trackpad(-10, { ctrlKey: true }));
			expect(h.zoomCalls[0].zoom).toBeCloseTo(Math.exp(0.1 * 0.5), 5);
			expect(h.zoomCalls[1].zoom).toBeCloseTo(Math.exp(0.01 * 3), 5);
		} finally {
			performance.now = realNow;
		}
	});

	it("デバイス別の指定が無い項目は共通の zoomSensitivity / panSensitivity を使う", () => {
		const h = setup({ zoomSensitivity: 2, panSensitivity: 3, trackpad: { panSensitivity: 1 } });
		expect(h.api.getSettings().mouse).toEqual({ pan: 3, zoom: 2 });
		expect(h.api.getSettings().trackpad).toEqual({ pan: 1, zoom: 2 });
	});

	it("panSensitivity は既定 0.1〜5 にクランプ、panSensitivityRange で上書きできる", () => {
		expect(setup({ panSensitivity: 99 }).api.getSettings().mouse.pan).toBe(5);
		expect(setup({ panSensitivity: 0 }).api.getSettings().mouse.pan).toBe(0.1);
		expect(
			setup({ panSensitivity: 99, panSensitivityRange: { max: 8 } }).api.getSettings().mouse.pan,
		).toBe(8);
	});

	it("deviceMode で判定を固定できる", () => {
		const h = setup({ deviceMode: "trackpad", trackpad: { panSensitivity: 0.5 } });
		h.wheel(mouse(100));
		expect(h.panCalls[0].dy).toBe(-50);
		expect(h.api.getLastDevice()).toBe("trackpad");
	});

	it("利用者の上書き（サービス / HUD）は options より優先し、reset で戻る", () => {
		const h = setup({ mouse: { panSensitivity: 2 } });
		h.api.setSettings({ mouse: { pan: 4 } });
		h.wheel(mouse(100));
		expect(h.panCalls[0].dy).toBe(-400);
		h.api.resetSettings();
		expect(h.api.getSettings().mouse.pan).toBe(2);
	});

	it("HUD に入力デバイス・マウス・トラックパッドの設定を登録し、get / set が設定に繋がる", () => {
		const h = setup();
		expect(h.hudSettings.map((d) => [d.label, d.fields.map((f) => f.name)])).toEqual([
			["スクロールとズームの感度", ["deviceMode"]],
			["マウス", ["mousePan", "mouseZoom"]],
			["トラックパッド", ["trackpadPan", "trackpadZoom"]],
		]);
		const [device, mouseHud, trackpadHud] = h.hudSettings;
		let notified = 0;
		trackpadHud.subscribe(() => notified++);
		trackpadHud.set("trackpadZoom", "2.5");
		device.set("deviceMode", "mouse");
		mouseHud.set("mousePan", "abc"); // 不正値は無視
		expect(trackpadHud.get("trackpadZoom")).toBe(2.5);
		expect(device.get("deviceMode")).toBe("mouse");
		expect(mouseHud.get("mousePan")).toBe(1);
		expect(notified).toBe(2);
	});

	it("hud: false なら HUD に登録しない（サービスは使える）", () => {
		const h = setup({ hud: false });
		expect(h.hudSettings).toHaveLength(0);
		expect(h.api.getSettings().deviceMode).toBe("auto");
	});

	it("上書きは storage に保存され、次の setup で読み戻される（壊れた値は捨てる）", () => {
		let saved: unknown = { mouse: { pan: 3, zoom: "x" }, deviceMode: "nope" };
		const storage: ViewportNavStorage = {
			load: () => saved,
			save: (patch) => {
				saved = patch;
			},
		};
		const first = setup({ storage });
		expect(first.api.getSettings().mouse).toEqual({ pan: 3, zoom: 1 });
		expect(first.api.getSettings().deviceMode).toBe("auto");
		first.api.setSettings({ trackpad: { zoom: 2 } });
		expect(saved).toEqual({ mouse: { pan: 3 }, trackpad: { zoom: 2 } });
		const second = setup({ storage });
		expect(second.api.getSettings().trackpad.zoom).toBe(2);
	});

	it("teardown でサービスと HUD を外す", () => {
		const h = makeCtx();
		const teardown = createViewportNavPlugin({ storage: false }).setup(h.ctx);
		expect(h.services.size).toBe(1);
		expect(h.hudSettings).toHaveLength(3);
		if (typeof teardown === "function") teardown();
		expect(h.services.size).toBe(0);
		expect(h.hudSettings).toHaveLength(0);
	});
});
