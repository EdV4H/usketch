import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { useSyncExternalStore } from "react";
import { boardMetaStore } from "../lib/board-meta-store.js";

/**
 * Contributes the board meta readout (title / cloud-or-local / id) to the
 * Control HUD via `ctx.hud.registerPanel`, replacing the hardcoded "Board"
 * section that lived in the HUD's General panel (and the `__usketchBoardMeta`
 * global). The app keeps feeding `boardMetaStore.set(...)`.
 */
export function createBoardMetaPanelPlugin(): UsketchPlugin {
	return {
		id: "usketch-web-board-meta",
		name: "Board",

		setup(ctx: PluginContext) {
			return ctx.hud.registerPanel({
				// Namespaced by plugin id: HudRegistry keys panels by id, so a bare
				// generic id could be overwritten by another plugin's panel.
				id: "usketch-web-board-meta:panel",
				title: "Board",
				order: 0,
				render: () => <BoardMetaPanel />,
			});
		},
	};
}

function BoardMetaPanel() {
	// getServerSnapshot (3rd arg) = getSnapshot: the store is deterministic, so
	// SSR/hydration reads the same value (avoids the hydration-mismatch warning).
	const meta = useSyncExternalStore(
		boardMetaStore.subscribe,
		boardMetaStore.getSnapshot,
		boardMetaStore.getSnapshot,
	);
	return (
		<div style={{ fontSize: 10 }}>
			<div style={{ fontWeight: 600, color: "#e5e7eb", wordBreak: "break-word" }}>
				{meta.name ?? "(untitled)"}
			</div>
			<div style={{ color: "#888" }}>
				{meta.isCloud ? "☁ Cloud" : "🖥 Local"}
				{meta.id ? ` · ${meta.id}` : ""}
			</div>
		</div>
	);
}
