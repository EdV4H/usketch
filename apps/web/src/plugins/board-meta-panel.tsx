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
				id: "board-meta",
				title: "Board",
				order: 0,
				render: () => <BoardMetaPanel />,
			});
		},
	};
}

function BoardMetaPanel() {
	const meta = useSyncExternalStore(boardMetaStore.subscribe, boardMetaStore.getSnapshot);
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
