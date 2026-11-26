import type {
	CanvasPointerEvent,
	CanvasWheelEvent,
	PluginContext,
	Point,
	UsketchPlugin,
} from "@edv4h/usketch-shared";
import { registerViewportNavHud } from "./register-viewport-nav-hud.js";
import { type ViewportNavApi, viewportNavService } from "./viewport-nav-service.js";
import {
	createSettingsResolver,
	localStorageViewportNavStorage,
	mergeSettingsPatch,
	sanitizeSettingsPatch,
	type ViewportNavOptions,
	type ViewportNavSettingsPatch,
} from "./viewport-nav-settings.js";
import { createWheelDeviceDetector, type WheelDevice } from "./wheel-device.js";
import { applyWheelToViewport } from "./wheel-ops.js";

export type { ViewportNavOptions } from "./viewport-nav-settings.js";

export function createViewportNavPlugin(options?: ViewportNavOptions): UsketchPlugin {
	return {
		id: "usketch-plugin-viewport-nav",
		name: "ビューポートナビゲーション",

		setup(ctx: PluginContext) {
			// ── Local pan state (scoped to this setup closure) ──
			let middlePanState: { lastPoint: Point } | null = null;

			// ── Sensitivity settings: host options + the viewer's overrides (HUD / service) ──
			const storage =
				options?.storage === false ? null : (options?.storage ?? localStorageViewportNavStorage());
			let overrides: ViewportNavSettingsPatch = sanitizeSettingsPatch(storage?.load());
			const { resolve, panRange, zoomRange } = createSettingsResolver(options, () => overrides);
			const detector = createWheelDeviceDetector();
			let lastDevice: WheelDevice | null = null;

			const listeners = new Set<() => void>();
			const notify = () => {
				for (const listener of listeners) listener();
			};
			const saveOverrides = (next: ViewportNavSettingsPatch) => {
				overrides = next;
				storage?.save(overrides);
				notify();
			};

			const api: ViewportNavApi = {
				getSettings: resolve,
				setSettings: (patch) =>
					saveOverrides(mergeSettingsPatch(overrides, sanitizeSettingsPatch(patch))),
				resetSettings: () => saveOverrides({}),
				getLastDevice: () => lastDevice,
				subscribe: (listener) => {
					listeners.add(listener);
					return () => listeners.delete(listener);
				},
			};
			const unprovide = viewportNavService.provide(ctx.services, api);
			const offHud =
				options?.hud === false
					? null
					: registerViewportNavHud(ctx, api, { pan: panRange, zoom: zoomRange });

			// ── Wheel: zoom & pan, with the sensitivity of the device it came from ──
			const offWheel = ctx.events.on<CanvasWheelEvent>("canvas:wheel", (event) => {
				const settings = resolve();
				// Always feed the detector so a switch to "auto" starts from a fresh guess.
				const detected = detector.classify(event);
				const device = settings.deviceMode === "auto" ? detected : settings.deviceMode;
				if (device !== lastDevice) {
					lastDevice = device;
					notify();
				}
				applyWheelToViewport(ctx.store, event, settings[device]);
			});

			// ── Middle-click pan ──
			const offMiddleDown = ctx.events.on<CanvasPointerEvent>("canvas:middle-down", (event) => {
				middlePanState = {
					lastPoint: { x: event.screenPoint.x, y: event.screenPoint.y },
				};
			});

			const offPointerMove = ctx.events.on<CanvasPointerEvent>("canvas:pointermove", (event) => {
				if (!middlePanState) return;

				const dx = event.screenPoint.x - middlePanState.lastPoint.x;
				const dy = event.screenPoint.y - middlePanState.lastPoint.y;

				ctx.store.panBy(dx, dy);

				middlePanState.lastPoint = {
					x: event.screenPoint.x,
					y: event.screenPoint.y,
				};
			});

			const offPointerUp = ctx.events.on<CanvasPointerEvent>("canvas:pointerup", (_event) => {
				middlePanState = null;
			});

			return () => {
				offWheel();
				offMiddleDown();
				offPointerMove();
				offPointerUp();
				offHud?.();
				unprovide();
				listeners.clear();
				middlePanState = null;
			};
		},
	};
}
