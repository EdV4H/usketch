import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { useSyncExternalStore } from "react";
import { presenceStore } from "../lib/presence-store.js";

const STATUS_DOT: Record<string, string> = {
	active: "#22c55e",
	away: "#eab308",
	busy: "#ef4444",
	presenting: "#3b82f6",
};

/**
 * Contributes the online-members (presence) list to the Control HUD via
 * `ctx.hud.registerPanel`, replacing the top-right Members panel that lived in
 * the HUD and the `__usketchPresence` global. The app feeds `presenceStore` from
 * the Yjs awareness (cloud boards only; empty otherwise).
 */
export function createPresencePanelPlugin(): UsketchPlugin {
	return {
		id: "usketch-web-presence",
		name: "Members",

		setup(ctx: PluginContext) {
			return ctx.hud.registerPanel({
				id: "usketch-web-presence:panel",
				title: "Members",
				order: 0,
				render: () => <PresencePanel />,
			});
		},
	};
}

function PresencePanel() {
	const snap = useSyncExternalStore(
		presenceStore.subscribe,
		presenceStore.getSnapshot,
		presenceStore.getSnapshot,
	);
	const members = snap.members;
	if (members.length === 0) {
		return <div style={{ color: "#888", fontSize: 10 }}>（自分のみ）</div>;
	}
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10 }}>
			{members.map((m) => (
				<div key={m.clientId} style={{ display: "flex", alignItems: "center", gap: 6 }}>
					<span
						style={{
							width: 16,
							height: 16,
							borderRadius: "50%",
							background: m.color,
							color: "#fff",
							fontSize: 9,
							fontWeight: 700,
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "center",
							flexShrink: 0,
						}}
					>
						{m.name?.[0]?.toUpperCase() ?? "?"}
					</span>
					<span
						style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
					>
						{m.name}
					</span>
					<span
						title={m.status ?? "active"}
						style={{
							width: 8,
							height: 8,
							borderRadius: "50%",
							background: STATUS_DOT[m.status ?? "active"] ?? STATUS_DOT.active,
							flexShrink: 0,
						}}
					/>
				</div>
			))}
		</div>
	);
}
