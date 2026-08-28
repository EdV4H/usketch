// HUD wiring for the dashboard. Per the plugin-system rules, the plugin exposes
// NO bespoke toolbar/panel — it contributes a declarative settings group and an
// "整列 (Arrange)" action to the shared HUD, both of which just call the service.
import type { PluginContext } from "@edv4h/usketch-shared";
import type { DashboardApi } from "./dashboard-service.js";

/** Register the dashboard's HUD settings + arrange action. Returns a teardown. */
export function registerDashboardHud(ctx: PluginContext, api: DashboardApi): () => void {
	const unregisterSettings = ctx.hud.registerSettings({
		id: "usketch-plugin-dashboard:settings",
		label: "ダッシュボード",
		order: 10,
		fields: [
			{ name: "columns", label: "列数", type: "number", min: 1, max: 12, step: 1 },
			{ name: "cellWidth", label: "セル幅", type: "number", min: 40, max: 800, step: 10 },
			{ name: "cellHeight", label: "セル高", type: "number", min: 40, max: 800, step: 10 },
			{ name: "gap", label: "間隔", type: "number", min: 0, max: 100, step: 2 },
			{ name: "padding", label: "余白", type: "number", min: 0, max: 200, step: 4 },
		],
		get(name) {
			const spec = api.getGridSpec();
			if (!spec) return undefined;
			switch (name) {
				case "columns":
					return spec.columns;
				case "cellWidth":
					return spec.cellW;
				case "cellHeight":
					return spec.cellH;
				case "gap":
					return spec.gap;
				case "padding":
					return spec.padding;
				default:
					return undefined;
			}
		},
		set(name, value) {
			const n = Number(value);
			if (!Number.isFinite(n)) return;
			const spec = api.getGridSpec();
			switch (name) {
				case "columns":
					api.setColumns(n);
					break;
				case "cellWidth":
					if (spec) api.setCellSize(n, spec.cellH);
					break;
				case "cellHeight":
					if (spec) api.setCellSize(spec.cellW, n);
					break;
				case "gap":
					api.setGap(n);
					break;
				case "padding":
					api.setPadding(n);
					break;
			}
		},
		subscribe: (listener) => api.onChange(listener),
	});

	const unregisterEnable = ctx.actions.register({
		id: "usketch-plugin-dashboard:enable",
		label: "ダッシュボード化",
		group: "ダッシュボード",
		order: 0,
		run: () => api.enable(),
		isActive: () => api.isDashboardBoard(),
	});

	const unregisterDisable = ctx.actions.register({
		id: "usketch-plugin-dashboard:disable",
		label: "ダッシュボード解除",
		group: "ダッシュボード",
		order: 1,
		run: () => api.disable(),
	});

	const unregisterArrange = ctx.actions.register({
		id: "usketch-plugin-dashboard:arrange",
		label: "整列",
		group: "ダッシュボード",
		order: 2,
		run: () => api.repack(),
	});

	return () => {
		unregisterSettings();
		unregisterEnable();
		unregisterDisable();
		unregisterArrange();
	};
}
