// The elevation plugin's controls on the Control HUD (no toolbar or panel of its own):
// the look as live settings, the terrain operations as actions. The actions only call
// the service's functions.
import type { PluginContext } from "@edv4h/usketch-shared";
import { type BrushSettings, MAX_RADIUS, MIN_RADIUS, normalizeBrush } from "./elevation-brush.js";
import { DEFAULT_GEN, DEFAULT_WATER_RATIO, MAX_HEIGHT } from "./elevation-field.js";
import { DEFAULT_ELEVATION_SEED } from "./elevation-ops.js";
import type { ElevationApi } from "./elevation-service.js";
import type { ElevationDisplay } from "./elevation-shade.js";

const GROUP = "標高";

const MODE_OPTIONS: { value: BrushSettings["mode"]; label: string }[] = [
	{ value: "raise", label: "盛る（Shift で削る）" },
	{ value: "lower", label: "削る（Shift で盛る）" },
	{ value: "smooth", label: "ならす" },
	{ value: "flatten", label: "平らにする（Alt+クリックで高さを拾う）" },
	{ value: "terrace", label: "段にする" },
];
const FALLOFF_OPTIONS: { value: BrushSettings["falloff"]; label: string }[] = [
	{ value: "smooth", label: "なめらか" },
	{ value: "linear", label: "直線" },
	{ value: "flat", label: "平ら（縁まで同じ）" },
];

/** Register the HUD settings + actions. Returns one teardown for all of them. */
export function registerElevationHud(ctx: PluginContext, api: ElevationApi): () => void {
	const offs: Array<() => void> = [];
	offs.push(
		ctx.hud.registerSettings({
			id: "usketch-elevation:display",
			label: "標高の表示",
			fields: [
				{ name: "tint", label: "高さで色分け", type: "boolean" },
				{ name: "shade", label: "陰影", type: "boolean" },
				{
					name: "contour",
					label: "等高線の間隔（0 で なし）",
					type: "number",
					min: 0,
					max: 512,
					step: 8,
				},
			],
			get: (name) => api.display.get()[name as keyof ElevationDisplay],
			set: (name, value) => {
				if (name === "contour") {
					const n = Number(value);
					api.display.set({ contour: Number.isFinite(n) ? Math.min(512, Math.max(0, n)) : 0 });
				} else if (name === "tint" || name === "shade") {
					api.display.set({ [name]: value === true || value === "true" });
				}
			},
			subscribe: api.display.subscribe,
		}),
	);
	offs.push(
		ctx.hud.registerSettings({
			id: "usketch-elevation:brush",
			label: "標高ブラシ（ツール: G）",
			fields: [
				{ name: "mode", label: "モード", type: "enum", options: MODE_OPTIONS },
				{
					name: "radius",
					label: "半径",
					type: "number",
					min: MIN_RADIUS,
					max: MAX_RADIUS,
					step: 16,
				},
				{ name: "strength", label: "強さ", type: "number", min: 1, max: 100, step: 1 },
				{ name: "falloff", label: "縁の落ち方", type: "enum", options: FALLOFF_OPTIONS },
				{
					name: "flattenHeight",
					label: "平らにする高さ（-1 で 押した所）",
					type: "number",
					min: -1,
					max: MAX_HEIGHT,
					step: 8,
				},
				{ name: "terraceStep", label: "段の間隔", type: "number", min: 1, max: 1024, step: 8 },
			],
			get: (name) => api.brush.get()[name as keyof BrushSettings],
			set: (name, value) => {
				// Checked like synced data: a HUD field can hand over a string or junk.
				const next = normalizeBrush({ ...api.brush.get(), [name]: value });
				api.brush.set({ [name]: next[name as keyof BrushSettings] });
			},
			subscribe: api.brush.subscribe,
		}),
	);
	offs.push(
		ctx.actions.register({
			id: "elevation:enable",
			group: GROUP,
			label: "無限地形を作る・変える",
			order: 0,
			params: [
				{
					name: "seed",
					label: "シード（整数）",
					type: "number",
					default: DEFAULT_ELEVATION_SEED,
					step: 1,
				},
				{
					name: "relief",
					label: "起伏の大きさ",
					type: "number",
					default: DEFAULT_GEN.relief,
					min: 0,
					max: MAX_HEIGHT,
					step: 16,
				},
				{
					name: "scale",
					label: "山の大きさ",
					type: "number",
					default: DEFAULT_GEN.scale,
					min: 64,
					max: 65536,
					step: 64,
				},
				{
					name: "roughness",
					label: "細かさ",
					type: "number",
					default: DEFAULT_GEN.roughness,
					min: 0,
					max: 1,
					step: 0.05,
				},
				{
					name: "ridges",
					label: "尾根の強さ",
					type: "number",
					default: DEFAULT_GEN.ridges,
					min: 0,
					max: 1,
					step: 0.05,
				},
				{
					name: "waterLevel",
					label: "水面の高さ（-1 で なし）",
					type: "number",
					default: Math.round(DEFAULT_GEN.relief * DEFAULT_WATER_RATIO),
					min: -1,
					max: MAX_HEIGHT,
					step: 8,
				},
			],
			run: (args) => {
				const n = (v: unknown) => (v === undefined || v === "" ? undefined : Number(v));
				const water = n(args.waterLevel);
				api.enableInfinite({
					seed: Math.trunc(n(args.seed) ?? DEFAULT_ELEVATION_SEED),
					gen: {
						relief: n(args.relief),
						scale: n(args.scale),
						roughness: n(args.roughness),
						ridges: n(args.ridges),
					},
					waterLevel: water === undefined ? undefined : water < 0 ? null : water,
				});
			},
		}),
	);
	offs.push(
		ctx.actions.register({
			id: "elevation:disable",
			group: GROUP,
			label: "無限地形を外す（ブラシの差分は残す）",
			order: 1,
			isEnabled: () => (api.getField()?.seed ?? null) !== null,
			run: () => api.disableInfinite(),
		}),
	);
	offs.push(
		ctx.actions.register({
			id: "elevation:clear-edits",
			group: GROUP,
			label: "ブラシの差分を全部消す",
			order: 2,
			isEnabled: () => api.editedChunkCount() > 0,
			run: () => api.clearEdits(),
		}),
	);
	offs.push(
		ctx.actions.register({
			id: "elevation:remove",
			group: GROUP,
			label: "標高を削除",
			order: 3,
			isEnabled: () => api.getField() !== null,
			run: () => api.removeField(),
		}),
	);
	return () => {
		for (const off of offs) off();
	};
}
