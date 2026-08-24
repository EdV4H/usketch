// Registers the scatter controls on the Control HUD (no bespoke panel). The action
// only reads settings and calls the pure service — no operation logic in the run
// closure (per docs/plugin-system-design.md).
import type { PluginContext } from "@edv4h/usketch-shared";
import { listScatterPatterns } from "../patterns.js";
import { listRelationResolvers } from "../resolvers.js";
import { getScatterApi } from "../scatter-service.js";
import { type ScatterState, scatterStateStore } from "../scatter-state.js";

export function registerScatterHud(ctx: PluginContext): () => void {
	const offs: Array<() => void> = [];

	offs.push(
		ctx.hud.registerSettings({
			id: "usketch-scatter:opts",
			label: "ぶちまけ設定",
			fields: [
				{
					name: "pattern",
					label: "パターン",
					type: "enum",
					options: listScatterPatterns().map((p) => ({ value: p, label: p })),
				},
				{
					name: "relation",
					label: "関連",
					type: "enum",
					options: listRelationResolvers().map((r) => ({ value: r, label: r })),
				},
				{ name: "spacing", label: "間隔", type: "number", min: 0, max: 400, step: 4 },
				{ name: "animate", label: "アニメーション", type: "boolean" },
				{ name: "durationMs", label: "時間(ms)", type: "number", min: 0, max: 3000, step: 50 },
			],
			get: (name) => scatterStateStore.get()[name as keyof ScatterState],
			set: (name, value) => scatterStateStore.set({ [name]: value } as Partial<ScatterState>),
			subscribe: scatterStateStore.subscribe,
		}),
	);

	offs.push(
		ctx.actions.register({
			id: "scatter:spill",
			group: "ぶちまける",
			label: "関連Shapeをぶちまける",
			isEnabled: () => ctx.store.getSelection().size === 1,
			// Return the Promise so the HUD action runner surfaces failures (e.g. the
			// seed deleted between selection read and run) in its logs instead of them
			// becoming unhandled rejections.
			run: async () => {
				const api = getScatterApi(ctx.services);
				const sel = ctx.store.getSelection();
				if (!api || sel.size !== 1) return;
				const st = scatterStateStore.get();
				await api.scatter({
					seedId: [...sel][0],
					pattern: st.pattern,
					relation: st.relation,
					spacing: st.spacing,
					animate: st.animate,
					durationMs: st.durationMs,
				});
			},
		}),
	);

	return () => {
		for (const off of offs) off();
	};
}
