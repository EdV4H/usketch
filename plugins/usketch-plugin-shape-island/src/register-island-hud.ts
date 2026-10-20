// HUD wiring — one declarative settings group bound to the selected islands. The
// operation itself is `setIslandElevation` (via the island API); no plugin-owned UI.
import type { PluginContext } from "@edv4h/usketch-shared";
import { MAX_ISLAND_ELEVATION, selectedIslandIds } from "./island-elevation.js";
import type { IslandApi } from "./island-service.js";

export function registerIslandHud(ctx: PluginContext, api: IslandApi): () => void {
	return ctx.hud.registerSettings({
		id: "usketch-plugin-shape-island:settings",
		label: "島（選択中）",
		order: 20,
		fields: [
			{
				name: "elevation",
				label: "高さ",
				type: "number",
				min: 0,
				max: MAX_ISLAND_ELEVATION,
				step: 10,
			},
		],
		get(name) {
			if (name !== "elevation") return undefined;
			const [first] = selectedIslandIds(ctx.store);
			return first ? api.getElevation(first) : 0;
		},
		set(name, value) {
			if (name !== "elevation") return;
			const n = typeof value === "number" ? value : Number(value);
			if (!Number.isFinite(n)) return;
			api.setElevation(selectedIslandIds(ctx.store), n);
		},
		subscribe: (listener) => ctx.store.subscribe(listener),
	});
}
