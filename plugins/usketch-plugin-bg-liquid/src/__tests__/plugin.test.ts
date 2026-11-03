import type {
	ActionRegistry,
	HudSettingsDescriptor,
	Layer,
	PluginContext,
} from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { liquidBgService } from "../liquid-service.js";
import { createLiquidBgPlugin } from "../plugin.js";

function setup(options?: Parameters<typeof createLiquidBgPlugin>[0]) {
	let layer: Layer | undefined;
	let settings: HudSettingsDescriptor | undefined;
	const handlers = new Map<string, Set<(p: unknown) => void>>();
	const services = new Map<string, unknown>();
	const emitted: [string, unknown][] = [];
	const events = {
		on: (name: string, fn: (p: unknown) => void) => {
			if (!handlers.has(name)) handlers.set(name, new Set());
			handlers.get(name)?.add(fn);
			return () => handlers.get(name)?.delete(fn);
		},
		emit: (name: string, data: unknown) => {
			emitted.push([name, data]);
			for (const fn of handlers.get(name) ?? []) fn(data);
		},
	};
	const ctx = {
		store: { getSelection: () => new Set<string>(), getShape: () => undefined },
		layers: { register: (l: Layer) => (layer = l), unregister: () => {} },
		events,
		services: {
			provide: (key: string, api: unknown) => {
				services.set(key, api);
				return () => services.delete(key);
			},
			get: (key: string) => services.get(key),
			has: (key: string) => services.has(key),
		},
		hud: {
			registerSettings: (d: HudSettingsDescriptor) => {
				settings = d;
				return () => {};
			},
		},
		actions: { register: () => () => {} } as unknown as ActionRegistry,
	} as unknown as PluginContext;
	const teardown = createLiquidBgPlugin(options).setup(ctx);
	return {
		ctx,
		events,
		emitted,
		get layer() {
			return layer;
		},
		get settings() {
			return settings;
		},
		teardown,
	};
}

const exportCtx = { rect: { x: 0, y: 0, width: 10, height: 10 }, zoom: 1, idPrefix: "p" };

describe("createLiquidBgPlugin", () => {
	it("bg:set liquid で表示、それ以外で非表示（既定は非表示）", () => {
		const t = setup();
		expect(t.layer?.renderExportBackground?.(exportCtx)).toBeNull();
		t.events.emit("bg:set", { type: "liquid" });
		expect(t.layer?.renderExportBackground?.(exportCtx)).not.toBeNull();
		expect(t.settings?.get("visible")).toBe(true);
		t.events.emit("bg:set", { type: "dots" });
		expect(t.settings?.get("visible")).toBe(false);
	});

	it("HUD で OFF にすると、直前の背景に戻す", () => {
		const t = setup();
		t.events.emit("bg:set", { type: "dots" });
		t.settings?.set("visible", true);
		expect(t.emitted.at(-1)).toEqual(["bg:set", { type: "liquid" }]);
		t.settings?.set("visible", false);
		expect(t.emitted.at(-1)).toEqual(["bg:set", { type: "dots" }]);
	});

	it("サービスを公開し、設定は HUD とサービスで共有される", () => {
		const t = setup({ visible: true, settings: { viscosity: 0.2 } });
		const api = liquidBgService.get(t.ctx.services);
		expect(api?.isVisible()).toBe(true);
		expect(t.settings?.get("viscosity")).toBe(0.2);
		api?.setSettings({ mode: "all", viscosity: 5 });
		expect(t.settings?.get("mode")).toBe("all");
		expect(t.settings?.get("viscosity")).toBe(1);
	});
});
