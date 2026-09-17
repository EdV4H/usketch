// HUD wiring for the window system. Per the plugin-system rules the plugin exposes
// NO bespoke toolbar/panel — it contributes a declarative settings group (mode /
// fixed-screen lock / gap / default split) to the shared HUD, all of which just
// call the service. The window OPERATIONS (focus/move/split/…) surface separately
// as actions (see register-window-actions.ts), auto-listed by the Debug HUD.
import type { PluginContext } from "@edv4h/usketch-shared";
import type { WindowSystemApi } from "./window-service.js";

/** Register the window system's HUD settings group. Returns a teardown. */
export function registerWindowHud(ctx: PluginContext, api: WindowSystemApi): () => void {
	return ctx.hud.registerSettings({
		id: "usketch-plugin-window-system:settings",
		label: "ウィンドウシステム",
		order: 12,
		fields: [
			{
				name: "mode",
				label: "配置",
				type: "enum",
				options: [
					{ value: "tile", label: "タイル(i3風)" },
					{ value: "free", label: "自由配置" },
				],
			},
			{ name: "viewportLock", label: "画角固定(固定スクリーン)", type: "boolean" },
			{ name: "gap", label: "間隔(窓間)", type: "number", min: 0, max: 80, step: 2 },
			{ name: "padding", label: "余白(外側)", type: "number", min: 0, max: 200, step: 4 },
			{
				name: "defaultSplit",
				label: "分割方向",
				type: "enum",
				options: [
					{ value: "h", label: "水平(右へ)" },
					{ value: "v", label: "垂直(下へ)" },
				],
			},
		],
		get(name) {
			switch (name) {
				case "mode":
					return api.getMode();
				case "viewportLock":
					return api.getLock();
				case "gap":
					return api.getGap();
				case "padding":
					return api.getPadding();
				case "defaultSplit":
					return api.getDefaultSplit();
				default:
					return undefined;
			}
		},
		set(name, value) {
			switch (name) {
				case "mode":
					if (value === "free" || value === "tile") api.setMode(value);
					return;
				case "viewportLock":
					api.setLock(value === true || value === "true");
					return;
				case "gap": {
					const n = Number(value);
					if (Number.isFinite(n)) api.setGap(n);
					return;
				}
				case "padding": {
					const n = Number(value);
					if (Number.isFinite(n)) api.setPadding(n);
					return;
				}
				case "defaultSplit":
					if (value === "h" || value === "v") api.setDefaultSplit(value);
					return;
			}
		},
		subscribe: (listener) => api.onChange(listener),
	});
}
