import { useCallback, useSyncExternalStore } from "react";
import type { PresenceSnapshot, PresenceTrackerLike } from "../presence-types.js";
import { STOP_CANVAS_PROPAGATION } from "../stop-propagation.js";
import { PANEL_BASE, TEXT_MUTED } from "../styles.js";

const EMPTY: PresenceSnapshot = { members: [] };

const STATUS_DOT: Record<string, string> = {
	active: "#22c55e",
	away: "#eab308",
	busy: "#ef4444",
	presenting: "#3b82f6",
};

function initial(name: string): string {
	return name?.[0]?.toUpperCase() ?? "?";
}

/**
 * オンラインメンバーのアバター一覧。旧 TopBar の PresencePill を Control HUD の
 * 独立パネルへ移したもの。`globalThis.__usketchPresence`（app.tsx が供給）を購読し、
 * 他メンバーがいる時だけ表示する。General パネルの左隣（右上クラスタ）に配置。
 */
export function MembersPanel({ presence }: { presence?: PresenceTrackerLike }) {
	const subscribe = useCallback(
		(cb: () => void) => presence?.subscribe(cb) ?? (() => {}),
		[presence],
	);
	const getSnapshot = useCallback(() => presence?.getSnapshot() ?? EMPTY, [presence]);
	const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
	const members = snap.members;

	// 他メンバーがいなければ非表示（solo 時は出さない）。
	if (members.length === 0) return null;

	return (
		<div
			{...STOP_CANVAS_PROPAGATION}
			style={{
				...PANEL_BASE,
				position: "absolute",
				top: 8,
				right: 238,
				width: 180,
			}}
		>
			<div style={{ color: TEXT_MUTED, marginBottom: 6 }}>Members ({members.length})</div>
			<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
				{members.map((m) => (
					<div key={m.clientId} style={{ display: "flex", alignItems: "center", gap: 6 }}>
						<span
							style={{
								width: 18,
								height: 18,
								borderRadius: "50%",
								background: m.color,
								color: "#fff",
								fontSize: 10,
								fontWeight: 700,
								display: "inline-flex",
								alignItems: "center",
								justifyContent: "center",
								flexShrink: 0,
							}}
						>
							{initial(m.name)}
						</span>
						<span
							style={{
								flex: 1,
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
							}}
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
		</div>
	);
}
