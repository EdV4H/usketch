import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import type React from "react";
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

/** 別のページにいる人の、ページ名のボタン（押すとそのページを開く）。 */
const pageChipStyle: React.CSSProperties = {
	maxWidth: 90,
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
	padding: "1px 6px",
	border: "1px solid color-mix(in srgb, currentColor 25%, transparent)",
	borderRadius: "var(--r-xs)",
	background: "transparent",
	color: "color-mix(in srgb, currentColor 70%, transparent)",
	font: "inherit",
	fontSize: 9,
	cursor: "pointer",
	flexShrink: 0,
};

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
					{m.pageId && m.samePage === false && (
						<button
							type="button"
							title={`${m.pageName || "（名前なし）"} を開く`}
							aria-label={`${m.name} のいるページ（${m.pageName || "名前なし"}）を開く`}
							disabled={!presenceStore.openPage}
							onClick={() => m.pageId && presenceStore.openPage?.(m.pageId)}
							style={pageChipStyle}
						>
							{m.pageName || "（名前なし）"}
						</button>
					)}
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
