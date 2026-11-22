import type { HudStatusValue, PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import type { WsConnectionStatus } from "@edv4h/usketch-sync";
import { useSyncExternalStore } from "react";
import { connectionStatusStore } from "../lib/connection-status-store.js";
import { syncStatusStore } from "../lib/sync-status-store.js";

const SYNC_STATE_COLORS: Record<string, string> = {
	loading: "#fbbf24",
	connecting: "#fbbf24",
	synced: "#4ade80",
	syncing: "#60a5fa",
	disconnected: "#9ca3af",
	error: "#f87171",
};

const SYNC_STATE_LABELS: Record<string, string> = {
	loading: "Loading…",
	connecting: "Connecting…",
	synced: "Synced",
	syncing: "Syncing…",
	disconnected: "Disconnected",
	error: "Error",
};

const CONNECTING: HudStatusValue = { text: "接続中…", tone: "warning" };
const FAILED: HudStatusValue = {
	text: "接続できません — このボードへのアクセス権限がない可能性があります",
	tone: "danger",
};

/** 接続の状態を HUD の状態表示に。つながっている・ローカルのボードなら何も出さない。 */
export function connectionStatusValue(status: WsConnectionStatus | null): HudStatusValue | null {
	if (status === "connecting") return CONNECTING;
	if (status === "failed") return FAILED;
	return null;
}

function formatTimestamp(ts: number | null): string {
	if (ts === null) return "—";
	const d = new Date(ts);
	return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

/**
 * Contributes the sync/persistence status readout to the Control HUD via
 * `ctx.hud.registerPanel`, replacing the hardcoded "Persistence" section in the
 * HUD's General panel and the `__usketchSyncStatus` global. The app feeds the
 * current tracker into `syncStatusStore` (base IDB → cloud divergence).
 */
export function createSyncStatusPanelPlugin(): UsketchPlugin {
	return {
		id: "usketch-web-sync-status",
		name: "Sync",

		setup(ctx: PluginContext) {
			const offPanel = ctx.hud.registerPanel({
				id: "usketch-web-sync-status:panel",
				title: "Sync",
				order: 0,
				render: () => <SyncStatusPanel />,
			});
			// 接続中・接続できないときだけ、HUD の状態表示に出す（HUD を閉じていても見える）。
			const offStatus = ctx.hud.registerStatus?.({
				id: "usketch-web-sync-status:connection",
				order: 0,
				get: () => connectionStatusValue(connectionStatusStore.get()),
				subscribe: connectionStatusStore.subscribe,
			});
			return () => {
				offStatus?.();
				offPanel();
			};
		},
	};
}

function SyncStatusPanel() {
	const snap = useSyncExternalStore(
		syncStatusStore.subscribe,
		syncStatusStore.getSnapshot,
		syncStatusStore.getSnapshot,
	);
	return (
		<div style={{ fontSize: 10 }}>
			<div style={{ color: "#9aa0aa", marginBottom: 2 }}>Persistence (Yjs + IndexedDB)</div>
			<div style={{ display: "flex", alignItems: "center", gap: 5 }}>
				<span
					style={{
						display: "inline-block",
						width: 7,
						height: 7,
						borderRadius: "50%",
						background: SYNC_STATE_COLORS[snap.state] ?? "#888",
					}}
				/>
				<span style={{ color: SYNC_STATE_COLORS[snap.state] ?? "#888" }}>
					{SYNC_STATE_LABELS[snap.state] ?? snap.state}
				</span>
			</div>
			<div>
				Shapes: {snap.shapeCount} · Last: {formatTimestamp(snap.lastSyncedAt)}
			</div>
			{/* Divergence only after the server has confirmed us once (gate on
			    firstServerSyncAt, not lastSyncedAt which also moves on local edits). */}
			{snap.firstServerSyncAt != null &&
				snap.unconfirmedShapeIds &&
				snap.unconfirmedShapeIds.length > 0 && (
					<div
						style={{
							marginTop: 4,
							padding: "3px 6px",
							borderRadius: 3,
							background: "#7f1d1d",
							color: "#fecaca",
							fontWeight: 600,
						}}
						title="サーバの Y.Doc に存在しない Shape が IndexedDB に残っています"
					>
						⚠ サーバ未同期 Shape: {snap.unconfirmedShapeIds.length} 件
					</div>
				)}
			{snap.error && <div style={{ color: "#f87171" }}>{snap.error}</div>}
		</div>
	);
}
