import type { WsConnectionStatus } from "@edv4h/usketch-sync";

/**
 * 今開いているクラウドボードの WebSocket の接続状態。HUD の状態表示（sync-status-panel
 * プラグインの「接続中…」「接続できません」）が読む。ローカルボードでは null のまま。
 */
export const connectionStatusStore = (() => {
	let current: WsConnectionStatus | null = null;
	const listeners = new Set<() => void>();
	return {
		get: (): WsConnectionStatus | null => current,
		set(next: WsConnectionStatus | null) {
			if (next === current) return;
			current = next;
			for (const l of [...listeners]) l();
		},
		subscribe(listener: () => void): () => void {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
})();
