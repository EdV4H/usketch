// HUD wiring for the dashboard. Per the plugin-system rules, the plugin exposes
// NO bespoke toolbar/panel — it contributes a declarative settings group and an
// "整列 (Arrange)" action to the shared HUD, both of which just call the service.
import type { PluginContext } from "@edv4h/usketch-shared";
import type { DashboardApi } from "./dashboard-service.js";
import { isGridOverlayVisible, setGridOverlayVisible } from "./grid-overlay.js";

/** Register the dashboard's HUD settings + arrange action. Returns a teardown. */
export function registerDashboardHud(ctx: PluginContext, api: DashboardApi): () => void {
	const unregisterSettings = ctx.hud.registerSettings({
		id: "usketch-plugin-dashboard:settings",
		label: "ダッシュボード",
		order: 10,
		fields: [
			{
				name: "mode",
				label: "配置",
				type: "enum",
				options: [
					{ value: "flow", label: "詰める(sortable)" },
					{ value: "absolute", label: "そのまま(自由)" },
				],
			},
			{ name: "columns", label: "列数", type: "number", min: 1, max: 12, step: 1 },
			{ name: "cellWidth", label: "セル幅(数値 / auto)", type: "string" },
			{ name: "cellHeight", label: "セル高", type: "number", min: 40, max: 800, step: 10 },
			{ name: "gap", label: "間隔", type: "number", min: 0, max: 100, step: 2 },
			{ name: "padding", label: "余白", type: "number", min: 0, max: 200, step: 4 },
			{ name: "fitToGrid", label: "セルに合わせる", type: "boolean" },
			{ name: "freeOutOfRange", label: "範囲外は自由", type: "boolean" },
			{ name: "viewportLock", label: "スクロール制限", type: "boolean" },
		],
		get(name) {
			if (name === "mode") return api.getMode();
			if (name === "fitToGrid") return api.getFitToGrid();
			if (name === "freeOutOfRange") return api.getFreeOutOfRange();
			if (name === "viewportLock") return api.getViewportLock();
			const spec = api.getGridSpec();
			if (!spec) return undefined;
			switch (name) {
				case "columns":
					return spec.columns;
				case "cellWidth":
					// String field: literal "auto", or the current width rounded.
					return api.getCellWidthAuto() ? "auto" : String(Math.round(spec.cellW));
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
			if (name === "mode") {
				if (value === "flow" || value === "absolute") api.setMode(value);
				return;
			}
			if (name === "fitToGrid") {
				api.setFitToGrid(value === true || value === "true");
				return;
			}
			if (name === "freeOutOfRange") {
				api.setFreeOutOfRange(value === true || value === "true");
				return;
			}
			if (name === "viewportLock") {
				api.setViewportLock(value === true || value === "true");
				return;
			}
			if (name === "cellWidth") {
				// "auto" (any case) → auto-fit width; otherwise a fixed numeric width.
				if (String(value).trim().toLowerCase() === "auto") {
					api.setCellWidthAuto(true);
					return;
				}
				const w = Number(value);
				const spec = api.getGridSpec();
				if (Number.isFinite(w) && spec) {
					api.setCellWidthAuto(false);
					api.setCellSize(w, spec.cellH);
				}
				return;
			}
			const n = Number(value);
			if (!Number.isFinite(n)) return;
			const spec = api.getGridSpec();
			switch (name) {
				case "columns":
					api.setColumns(n);
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
		// Only offered when the board isn't yet a dashboard (re-packing an active
		// one is what「整列」is for).
		isEnabled: () => !api.isDashboardBoard(),
		isActive: () => api.isDashboardBoard(),
	});

	const unregisterDisable = ctx.actions.register({
		id: "usketch-plugin-dashboard:disable",
		label: "ダッシュボード解除",
		group: "ダッシュボード",
		order: 1,
		run: () => api.disable(),
		// A no-op unless the board is a dashboard — disable it so the HUD doesn't
		// present a dead control.
		isEnabled: () => api.isDashboardBoard(),
	});

	const unregisterArrange = ctx.actions.register({
		id: "usketch-plugin-dashboard:arrange",
		label: "整列",
		group: "ダッシュボード",
		order: 2,
		run: () => api.repack(),
		isEnabled: () => api.isDashboardBoard(),
	});

	const unregisterToggleGrid = ctx.actions.register({
		id: "usketch-plugin-dashboard:toggle-grid",
		label: "グリッド表示",
		group: "ダッシュボード",
		order: 3,
		run: () => setGridOverlayVisible(!isGridOverlayVisible()),
		isActive: () => isGridOverlayVisible(),
		isEnabled: () => api.isDashboardBoard(),
	});

	return () => {
		unregisterSettings();
		unregisterEnable();
		unregisterDisable();
		unregisterArrange();
		unregisterToggleGrid();
	};
}
