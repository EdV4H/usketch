// HUD wiring (all UI lives in the shared HUD): a settings group for the selected
// shapes' 3D look, and one for the draw limits. They only call the service.
import type { PluginContext } from "@edv4h/usketch-shared";
import { MAX_SHAPE_3D_HEIGHT } from "./shape-3d-params.js";
import type { Shape3dApi } from "./shape-3d-service.js";
import type { Shape3dSettings } from "./shape-3d-settings.js";

const MODE_LABELS: Record<string, string> = {
	none: "なし",
	stand: "立てる",
	box: "箱",
	float: "浮かせる",
};

/** Register the HUD settings. Returns a teardown. */
export function registerShape3dHud(
	ctx: PluginContext,
	api: Shape3dApi,
	settings: Shape3dSettings,
): () => void {
	const selection = () => [...ctx.store.getSelection()];
	// The first selected shape that is 3D (else the first selected) shows the values.
	const shown = () => {
		const ids = selection();
		for (const id of ids) {
			const p = api.get(id);
			if (p) return p;
		}
		return null;
	};
	const modeOptions = () => {
		const modes = new Set<string>();
		for (const id of selection()) {
			const shape = ctx.store.getShape(id);
			if (shape) for (const m of api.modesFor(shape.type)) modes.add(m);
		}
		return [
			{ value: "none", label: MODE_LABELS.none },
			...[...modes].map((m) => ({ value: m, label: MODE_LABELS[m] ?? m })),
		];
	};

	const unregisterSelected = ctx.hud.registerSettings({
		id: "usketch-plugin-shape-3d:selected",
		label: "3D（選択中の Shape）",
		order: 15,
		get fields() {
			return [
				{ name: "mode", label: "3D 表示", type: "enum" as const, options: modeOptions() },
				{
					name: "height",
					label: "高さ（箱・浮かせる）",
					type: "number" as const,
					min: 0,
					max: MAX_SHAPE_3D_HEIGHT,
					step: 4,
				},
				{
					name: "facing",
					label: "向き（立てる）",
					type: "enum" as const,
					options: [
						{ value: "camera", label: "カメラの方" },
						{ value: "fixed", label: "固定（下辺に沿う）" },
					],
				},
				{ name: "ground", label: "地形に乗せる", type: "boolean" as const },
				{ name: "shadow", label: "影", type: "boolean" as const },
			];
		},
		get(name) {
			const p = shown();
			switch (name) {
				case "mode":
					return p?.mode ?? "none";
				case "height":
					return p?.height ?? 0;
				case "facing":
					return p?.facing ?? "camera";
				case "ground":
					return p?.ground ?? true;
				case "shadow":
					return p?.shadow ?? true;
				default:
					return undefined;
			}
		},
		set(name, value) {
			const ids = selection();
			if (ids.length === 0) return;
			if (name === "mode") {
				if (value === "none") api.clear(ids);
				else if (typeof value === "string") api.set(ids, { mode: value });
				return;
			}
			// Other fields only change shapes that are already 3D.
			const threeD = ids.filter((id) => api.get(id));
			if (name === "height" && typeof value === "number" && Number.isFinite(value)) {
				// Only shapes that use a height (a stood-up shape keeps its natural size).
				api.set(
					threeD.filter((id) => api.get(id)?.mode !== "stand"),
					{ height: value },
				);
			} else if (name === "facing" && (value === "camera" || value === "fixed")) {
				api.set(threeD, { facing: value });
			} else if ((name === "ground" || name === "shadow") && typeof value === "boolean") {
				api.set(threeD, { [name]: value });
			}
		},
		subscribe: (listener) => ctx.store.subscribe(listener),
	});

	const unregisterLimits = ctx.hud.registerSettings({
		id: "usketch-plugin-shape-3d:limits",
		label: "3D 表示（全体）",
		order: 16,
		fields: [
			{ name: "maxCount", label: "3D にする最大数", type: "number", min: 0, max: 2000, step: 10 },
			{ name: "minPx", label: "最小サイズ(px)", type: "number", min: 0, max: 200, step: 1 },
		],
		get(name) {
			const l = api.getLimits();
			return name === "maxCount" ? l.maxCount : name === "minPx" ? l.minPx : undefined;
		},
		set(name, value) {
			if (typeof value !== "number") return;
			if (name === "maxCount") api.setLimits({ maxCount: value });
			else if (name === "minPx") api.setLimits({ minPx: value });
		},
		subscribe: (listener) => settings.subscribe(listener),
	});

	return () => {
		unregisterSelected();
		unregisterLimits();
	};
}
