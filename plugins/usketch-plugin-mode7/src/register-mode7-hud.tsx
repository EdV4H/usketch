// HUD wiring — all UI is contributed to the shared HUD (per the plugin-system
// rules): a declarative settings group (camera / look) that drives the service, plus
// a small panel for picking which layers render in 3D. The camera OPERATIONS
// (toggle / pitch / yaw / …) surface separately as actions (register-mode7-actions).
import type { PluginContext } from "@edv4h/usketch-shared";
import { CAMERA_LIMITS } from "./mode7-camera.js";
import { LayerPicker } from "./mode7-layers.js";
import type { Mode7Api } from "./mode7-service.js";
import type { Mode7Store } from "./mode7-store.js";

/** Register the Mode 7 settings group + the layer picker panel. Returns a teardown. */
export function registerMode7Hud(
	ctx: PluginContext,
	api: Mode7Api,
	store: Mode7Store,
	excludedLayerIds: readonly string[],
): () => void {
	const unregisterSettings = ctx.hud.registerSettings({
		id: "usketch-plugin-mode7:settings",
		label: "Mode 7 (3D ビュー)",
		order: 14,
		fields: [
			{ name: "enabled", label: "3Dビュー", type: "boolean" },
			{ name: "captureFrame", label: "取り込み範囲", type: "boolean" },
			{
				name: "pitch",
				label: "傾き(°)",
				type: "number",
				min: CAMERA_LIMITS.pitch.min,
				max: CAMERA_LIMITS.pitch.max,
				step: 1,
			},
			{ name: "yaw", label: "旋回(°)", type: "number", min: -180, max: 180, step: 5 },
			{
				name: "fov",
				label: "遠近(px)",
				type: "number",
				min: CAMERA_LIMITS.fov.min,
				max: CAMERA_LIMITS.fov.max,
				step: 50,
			},
			{ name: "horizon", label: "地平線(%)", type: "number", min: 10, max: 90, step: 5 },
			{ name: "fog", label: "フォグ(%)", type: "number", min: 0, max: 100, step: 5 },
			{ name: "sky", label: "空色", type: "color" },
			{ name: "fogColor", label: "フォグ色", type: "color" },
		],
		get(name) {
			const cam = api.getCamera();
			const look = api.getLook();
			switch (name) {
				case "enabled":
					return api.isActive();
				case "captureFrame":
					return api.isCaptureFrameVisible();
				case "pitch":
					return cam.pitch;
				case "yaw":
					return cam.yaw;
				case "fov":
					return cam.fov;
				case "horizon":
					return Math.round(cam.horizon * 100);
				case "fog":
					return Math.round(look.fog * 100);
				case "sky":
					return look.sky;
				case "fogColor":
					return look.fogColor;
				default:
					return undefined;
			}
		},
		set(name, value) {
			if (name === "enabled") {
				if (value === true || value === "true") api.enable();
				else api.disable();
				return;
			}
			if (name === "captureFrame") {
				api.setCaptureFrameVisible(value === true || value === "true");
				return;
			}
			if (name === "sky") {
				if (typeof value === "string") api.setSky(value);
				return;
			}
			if (name === "fogColor") {
				if (typeof value === "string") api.setFogColor(value);
				return;
			}
			const n = Number(value);
			if (!Number.isFinite(n)) return;
			switch (name) {
				case "pitch":
					api.setPitch(n);
					break;
				case "yaw":
					api.setYaw(n);
					break;
				case "fov":
					api.setFov(n);
					break;
				case "horizon":
					api.setHorizon(n / 100);
					break;
				case "fog":
					api.setFog(n / 100);
					break;
			}
		},
		subscribe: (listener) => api.onChange(listener),
	});

	const unregisterPanel = ctx.hud.registerPanel({
		id: "usketch-plugin-mode7:layer-picker",
		title: "Mode 7 レイヤー",
		order: 15,
		render: () => <LayerPicker ctx={ctx} store={store} excluded={excludedLayerIds} />,
	});

	return () => {
		unregisterPanel();
		unregisterSettings();
	};
}
