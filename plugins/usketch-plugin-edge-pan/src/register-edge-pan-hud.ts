import type { PluginContext } from "@edv4h/usketch-shared";
import type { EdgePanAxes, ResolvedEdgePan } from "./edge-pan-config.js";

/** HUD が読み書きするための最小 API（plugin.ts が overrides を土台に提供）。 */
export interface EdgePanHudApi {
	/** 現在の実効設定（options + overrides）を返す。 */
	resolve: () => ResolvedEdgePan;
	/** end-user による上書き値を設定（options より優先）。 */
	setOverride: (name: "enabled" | "edgeSize" | "maxSpeed" | "axes", value: unknown) => void;
	/** 設定変更の購読。 */
	subscribe: (listener: () => void) => () => void;
}

/**
 * edge-pan の HUD 設定を登録する（独自 UI は作らず、共有 HUD に宣言的に寄せる）。返り値は teardown。
 */
export function registerEdgePanHud(ctx: PluginContext, api: EdgePanHudApi): () => void {
	return ctx.hud.registerSettings({
		id: "usketch-plugin-edge-pan:settings",
		label: "端で画角スライド",
		order: 15,
		fields: [
			{ name: "enabled", label: "有効", type: "boolean" },
			{ name: "edgeSize", label: "端の帯(px)", type: "number", min: 8, max: 200, step: 4 },
			{ name: "maxSpeed", label: "最大速度(px/frame)", type: "number", min: 1, max: 60, step: 1 },
			{
				name: "axes",
				label: "対象軸",
				type: "enum",
				options: [
					{ value: "both", label: "上下左右" },
					{ value: "horizontal", label: "左右のみ" },
					{ value: "vertical", label: "上下のみ" },
				],
			},
		],
		get(name) {
			const s = api.resolve();
			switch (name) {
				case "enabled":
					return s.enabled;
				case "edgeSize":
					return s.edgeSize;
				case "maxSpeed":
					return s.maxSpeed;
				case "axes":
					return s.axes;
				default:
					return undefined;
			}
		},
		set(name, value) {
			if (name === "enabled") {
				api.setOverride("enabled", value === true || value === "true");
				return;
			}
			if (name === "axes") {
				if (value === "both" || value === "horizontal" || value === "vertical") {
					api.setOverride("axes", value as EdgePanAxes);
				}
				return;
			}
			if (name === "edgeSize" || name === "maxSpeed") {
				const n = Number(value);
				if (Number.isFinite(n)) api.setOverride(name, n);
			}
		},
		subscribe: (listener) => api.subscribe(listener),
	});
}
