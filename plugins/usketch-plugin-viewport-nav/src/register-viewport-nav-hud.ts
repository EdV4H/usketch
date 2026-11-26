import type { PluginContext } from "@edv4h/usketch-shared";
import type { ViewportNavApi } from "./viewport-nav-service.js";
import type { SensitivityRange, WheelDeviceMode } from "./viewport-nav-settings.js";

type SensitivityField = "mousePan" | "mouseZoom" | "trackpadPan" | "trackpadZoom";

const FIELD_TO_SETTING: Record<SensitivityField, ["mouse" | "trackpad", "pan" | "zoom"]> = {
	mousePan: ["mouse", "pan"],
	mouseZoom: ["mouse", "zoom"],
	trackpadPan: ["trackpad", "pan"],
	trackpadZoom: ["trackpad", "zoom"],
};

function isSensitivityField(name: string): name is SensitivityField {
	return name in FIELD_TO_SETTING;
}

function isDeviceMode(value: unknown): value is WheelDeviceMode {
	return value === "auto" || value === "mouse" || value === "trackpad";
}

/**
 * マウス / トラックパッド別の感度を HUD の設定として登録する（独自 UI は作らない）。
 * 「入力デバイス」「マウス」「トラックパッド」の 3 つの設定グループに分けて並べる。
 * 読み書きはすべてサービスの API 経由。返り値は teardown。
 */
export function registerViewportNavHud(
	ctx: PluginContext,
	api: ViewportNavApi,
	ranges: { pan: SensitivityRange; zoom: SensitivityRange },
): () => void {
	const pan = { type: "number" as const, min: ranges.pan.min, max: ranges.pan.max, step: 0.1 };
	const zoom = { type: "number" as const, min: ranges.zoom.min, max: ranges.zoom.max, step: 0.25 };

	const offDevice = ctx.hud.registerSettings({
		id: "usketch-plugin-viewport-nav:device",
		label: "スクロールとズームの感度",
		order: 10,
		fields: [
			{
				name: "deviceMode",
				label: "入力デバイス",
				type: "enum",
				options: [
					{ value: "auto", label: "自動で見分ける" },
					{ value: "mouse", label: "いつもマウス" },
					{ value: "trackpad", label: "いつもトラックパッド" },
				],
			},
		],
		get: (name) => (name === "deviceMode" ? api.getSettings().deviceMode : undefined),
		set(name, value) {
			if (name === "deviceMode" && isDeviceMode(value)) api.setSettings({ deviceMode: value });
		},
		subscribe: (listener) => api.subscribe(listener),
	});

	const registerDevice = (device: "mouse" | "trackpad", label: string, order: number) => {
		const fields: Record<string, SensitivityField> =
			device === "mouse"
				? { pan: "mousePan", zoom: "mouseZoom" }
				: { pan: "trackpadPan", zoom: "trackpadZoom" };
		return ctx.hud.registerSettings({
			id: `usketch-plugin-viewport-nav:${device}`,
			label,
			order,
			fields: [
				{ name: fields.pan, label: "スクロール速度", ...pan },
				{ name: fields.zoom, label: "ズーム速度", ...zoom },
			],
			get(name) {
				if (!isSensitivityField(name)) return undefined;
				const [d, key] = FIELD_TO_SETTING[name];
				return api.getSettings()[d][key];
			},
			set(name, value) {
				if (!isSensitivityField(name)) return;
				const n = Number(value);
				if (!Number.isFinite(n)) return;
				const [d, key] = FIELD_TO_SETTING[name];
				api.setSettings({ [d]: { [key]: n } });
			},
			subscribe: (listener) => api.subscribe(listener),
		});
	};
	const offMouse = registerDevice("mouse", "マウス", 11);
	const offTrackpad = registerDevice("trackpad", "トラックパッド", 12);

	return () => {
		offDevice();
		offMouse();
		offTrackpad();
	};
}
