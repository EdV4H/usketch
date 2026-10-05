// Registers the map plugin's operations onto the Control HUD (actions + settings)
// instead of a bespoke on-canvas palette. The map tool's canvas interactions are
// unchanged; only the control surface moves into the HUD (toggle with `).

import { ICON_CATEGORIES, ICONS } from "@edv4h/usketch-map-icons";
import type { ActionParam, PluginContext } from "@edv4h/usketch-shared";
import type { CellBox } from "../autotile.js";
import { DEFAULT_BASE_RADIUS } from "../base/base-map-shape.js";
import {
	createBase,
	deleteBase,
	getBaseMap,
	setBaseIcon,
	setBaseRadius,
} from "../base/base-ops.js";
import { baseStateStore } from "../base/base-state.js";
import { genStateStore } from "../gen-state.js";
import { generateIntoBox, viewportCellBox } from "../generate.js";
import { defaultParams, GENERATORS, GENERATORS_BY_ID } from "../generators/index.js";
import { TERRAINS, type TerrainKey } from "../terrain.js";
import { type MapMode, toolStateStore } from "../tool-state.js";

const MODE_OPTIONS: { value: MapMode; label: string }[] = [
	{ value: "brush", label: "ブラシ" },
	{ value: "eraser", label: "消しゴム" },
	{ value: "fill", label: "塗りつぶし" },
	{ value: "region", label: "領域塗り" },
	{ value: "generate", label: "生成" },
	{ value: "base", label: "拠点" },
];
const TERRAIN_OPTIONS = TERRAINS.map((t) => ({ value: t.key, label: t.name }));
const GEN_OPTIONS = GENERATORS.map((g) => ({ value: g.id, label: g.label }));
const CAT_LABEL = new Map(ICON_CATEGORIES.map((c) => [c.id, c.label]));
const ICON_OPTIONS = ICONS.map((i) => ({
	value: i.key,
	label: `${CAT_LABEL.get(i.category) ?? i.category} / ${i.ja}`,
}));

/**
 * Register every map control on the HUD. Returns a single teardown that unwinds
 * all registrations (including the dynamically re-registered generator-params
 * and active-base groups).
 */
export function registerMapHud(ctx: PluginContext, tile: number): () => void {
	const offs: Array<() => void> = [];
	const deps = { store: ctx.store, commands: ctx.commands, tile };

	// ── Mode / terrain (bound to toolStateStore) ──
	offs.push(
		ctx.hud.registerSettings({
			id: "usketch-map:tool",
			label: "RPG マップ操作",
			fields: [
				{ name: "mode", label: "モード", type: "enum", options: MODE_OPTIONS },
				{ name: "terrain", label: "地形", type: "enum", options: TERRAIN_OPTIONS },
			],
			get: (name) => toolStateStore.get()[name as "mode" | "terrain"],
			set: (name, value) => toolStateStore.set({ [name]: value } as Record<string, never>),
			subscribe: toolStateStore.subscribe,
		}),
	);

	// ── Region-fill exclude: one boolean per terrain ──
	offs.push(
		ctx.hud.registerSettings({
			id: "usketch-map:region-exclude",
			label: "領域塗り: 除外地形",
			fields: TERRAINS.map((t) => ({ name: t.key, label: t.name, type: "boolean" as const })),
			get: (name) => toolStateStore.get().excludeTerrains.includes(name as TerrainKey),
			set: (name, value) => {
				const cur = toolStateStore.get().excludeTerrains;
				const key = name as TerrainKey;
				const next = value
					? cur.includes(key)
						? cur
						: [...cur, key]
					: cur.filter((k) => k !== key);
				toolStateStore.set({ excludeTerrains: next });
			},
			subscribe: toolStateStore.subscribe,
		}),
	);

	// ── Generation: algorithm + seed, dynamic params, generate/regenerate ──
	offs.push(
		ctx.hud.registerSettings({
			id: "usketch-map:gen",
			label: "マップ生成",
			fields: [
				{ name: "algorithmId", label: "アルゴリズム", type: "enum", options: GEN_OPTIONS },
				{ name: "seed", label: "シード", type: "number", min: 0, step: 1 },
			],
			get: (name) => genStateStore.get()[name as "algorithmId" | "seed"],
			set: (name, value) => {
				if (name === "algorithmId") {
					const g = GENERATORS_BY_ID.get(String(value));
					if (g) genStateStore.set({ algorithmId: g.id, params: defaultParams(g) });
				} else if (name === "seed") {
					genStateStore.set({ seed: Number(value) >>> 0 });
				}
			},
			subscribe: genStateStore.subscribe,
		}),
	);

	// Dynamic generator params: re-register the fields whenever the algorithm changes.
	let paramsOff: (() => void) | null = null;
	let lastAlgo = "";
	const syncParams = () => {
		const algo = genStateStore.get().algorithmId;
		if (algo === lastAlgo) return;
		lastAlgo = algo;
		paramsOff?.();
		paramsOff = null;
		const gen = GENERATORS_BY_ID.get(algo);
		if (!gen || gen.params.length === 0) return;
		const fields: ActionParam[] = gen.params.map((p) => ({
			name: p.name,
			label: p.label,
			type: "number",
			min: p.min,
			max: p.max,
			step: p.step,
		}));
		paramsOff = ctx.hud.registerSettings({
			id: "usketch-map:gen-params",
			label: "生成パラメータ",
			fields,
			get: (name) =>
				genStateStore.get().params[name] ?? gen.params.find((p) => p.name === name)?.default ?? 0,
			set: (name, value) =>
				genStateStore.set({ params: { ...genStateStore.get().params, [name]: Number(value) } }),
			subscribe: genStateStore.subscribe,
		});
	};
	syncParams();
	const offParamsSub = genStateStore.subscribe(syncParams);
	offs.push(() => {
		offParamsSub();
		paramsOff?.();
	});

	const runGen = (box: CellBox) => {
		const g = genStateStore.get();
		generateIntoBox(deps, {
			generatorId: g.algorithmId,
			seed: g.seed,
			params: g.params,
			box,
		});
	};
	offs.push(
		ctx.actions.register({
			id: "map:generate-view",
			group: "マップ生成",
			label: "ビュー全体に生成",
			run: () => runGen(viewportCellBox(ctx.store, tile)),
		}),
	);
	offs.push(
		ctx.actions.register({
			id: "map:generate-regen",
			group: "マップ生成",
			label: "再生成",
			isEnabled: () => !!genStateStore.get().lastBox,
			run: () => {
				const b = genStateStore.get().lastBox;
				if (b) runGen(b);
			},
		}),
	);

	// ── Base: create action + mode + dynamic active-base enum ──
	offs.push(
		ctx.actions.register({
			id: "map:base-create",
			group: "拠点",
			label: "拠点を作成",
			params: [
				{ name: "name", label: "名前", type: "string" },
				{ name: "color", label: "色", type: "color", default: "#EF5350" },
			],
			run: (args) => {
				const count = Object.keys(getBaseMap(ctx.store)?.bases ?? {}).length;
				const name = String(args.name ?? "").trim() || `拠点${count + 1}`;
				const id = createBase(deps, name, String(args.color ?? "#EF5350"));
				baseStateStore.set({ activeBaseId: id });
			},
		}),
	);
	offs.push(
		ctx.actions.register({
			id: "map:base-delete",
			group: "拠点",
			label: "アクティブ拠点を削除",
			isEnabled: () => {
				const active = baseStateStore.get().activeBaseId;
				return !!active && !!getBaseMap(ctx.store)?.bases[active];
			},
			run: () => {
				const active = baseStateStore.get().activeBaseId;
				if (!active) return;
				deleteBase(deps, active);
				const remaining = Object.keys(getBaseMap(ctx.store)?.bases ?? {});
				baseStateStore.set({ activeBaseId: remaining[0] ?? null });
			},
		}),
	);
	// Beacon: territory radius of the ACTIVE base (edited live → territory follows).
	const subBaseAndStore = (cb: () => void) => {
		const u1 = baseStateStore.subscribe(cb);
		const u2 = ctx.store.subscribe(cb);
		return () => {
			u1();
			u2();
		};
	};
	offs.push(
		ctx.hud.registerSettings({
			id: "usketch-map:base-look",
			label: "拠点: 半径とアイコン",
			// Radius sizes the territory disk AND (unless overridden) picks the landmark
			// icon tier. Icon "" = 半径連動（自動）; any other value overrides the tier.
			fields: [
				{ name: "radius", label: "半径（マス）", type: "number", min: 1, max: 64, step: 1 },
				{
					name: "icon",
					label: "アイコン",
					type: "enum",
					options: [{ value: "", label: "半径連動（自動）" }, ...ICON_OPTIONS],
				},
			],
			get: (name) => {
				const active = baseStateStore.get().activeBaseId;
				const base = active ? getBaseMap(ctx.store)?.bases[active] : undefined;
				if (name === "icon") return base?.icon ?? "";
				return base?.radius || DEFAULT_BASE_RADIUS;
			},
			set: (name, value) => {
				const active = baseStateStore.get().activeBaseId;
				if (!active) return;
				if (name === "icon") setBaseIcon(deps, active, value ? String(value) : null);
				else setBaseRadius(deps, active, Number(value));
			},
			subscribe: subBaseAndStore,
		}),
	);
	offs.push(
		ctx.hud.registerSettings({
			id: "usketch-map:base-exclude",
			label: "拠点: 除外地形（壁）",
			fields: TERRAINS.map((t) => ({ name: t.key, label: t.name, type: "boolean" as const })),
			get: (name) => baseStateStore.get().excludeTerrains.includes(name as TerrainKey),
			set: (name, value) => {
				const cur = baseStateStore.get().excludeTerrains;
				const key = name as TerrainKey;
				const next = value
					? cur.includes(key)
						? cur
						: [...cur, key]
					: cur.filter((k) => k !== key);
				baseStateStore.set({ excludeTerrains: next });
			},
			subscribe: baseStateStore.subscribe,
		}),
	);

	// Active base: re-register the enum options whenever the set of bases changes.
	let baseOff: (() => void) | null = null;
	let lastBaseSig = " ";
	const syncBases = () => {
		const bases = getBaseMap(ctx.store)?.bases ?? {};
		const sig = Object.keys(bases).sort().join(",");
		if (sig === lastBaseSig) return;
		lastBaseSig = sig;
		baseOff?.();
		const options = Object.entries(bases).map(([id, info]) => ({ value: id, label: info.name }));
		baseOff = ctx.hud.registerSettings({
			id: "usketch-map:active-base",
			label: "拠点: アクティブ",
			fields: [
				{
					name: "activeBaseId",
					label: "拠点",
					type: "enum",
					options: options.length ? options : [{ value: "", label: "（未作成）" }],
				},
			],
			get: () => baseStateStore.get().activeBaseId ?? "",
			set: (_name, value) => baseStateStore.set({ activeBaseId: String(value) || null }),
			subscribe: baseStateStore.subscribe,
		});
	};
	syncBases();
	const offBaseSub = ctx.store.subscribe(syncBases);
	offs.push(() => {
		offBaseSub();
		baseOff?.();
	});

	return () => {
		for (const off of offs) off();
	};
}
