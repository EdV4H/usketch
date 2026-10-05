import type React from "react";
import { useSyncExternalStore } from "react";
import type { CardHandAwareness, HandStore } from "./hand-store.js";
import type { CardTypeDefinition } from "./types.js";

/**
 * Hand panel for the Control HUD (#671). Registered via `ctx.hud.registerPanel`
 * — the hand is no longer a bespoke bottom-fixed tray, so it lives inside the
 * HUD like every other plugin surface.
 *
 * Shows **this client's** hand — contents live only in `handStore`
 * (localStorage), never on the network. Others' hands show as a count only
 * (read from awareness `cardHand.count`). Each card has a "場に出す" (play)
 * button that calls `onPlay(id)` (the plugin emits `card:play-from-hand`).
 */
export function HandPanel({
	handStore,
	registry,
	localUserId,
	awareness,
	onPlay,
}: {
	handStore: HandStore;
	registry: Map<string, CardTypeDefinition>;
	localUserId: string;
	awareness?: CardHandAwareness;
	onPlay: (id: string) => void;
}) {
	const hand = useSyncExternalStore(handStore.subscribe, handStore.getHand, handStore.getHand);

	// Sum of other clients' hand counts (contents never shared — count only).
	const othersCount = useSyncExternalStore(
		(cb) => {
			if (!awareness) return () => {};
			awareness.on("change", cb);
			return () => awareness.off("change", cb);
		},
		() => sumOthers(awareness, localUserId),
		() => sumOthers(awareness, localUserId),
	);

	// Hidden entirely when there is nothing to show (matches the old tray), so
	// the HUD doesn't carry an empty "Hand" section on non-card boards.
	if (hand.length === 0 && othersCount === 0) return null;

	return (
		<div style={wrapStyle}>
			{hand.length > 0 ? (
				<div style={cardsStyle}>
					{hand.map((entry) => {
						const def = registry.get(entry.cardType);
						const aspect = def?.aspectRatio ?? 0.7;
						const h = 64;
						const w = Math.round(h * aspect);
						return (
							<div key={entry.id} style={cardWrapStyle}>
								<div style={{ width: w, height: h, ...faceBoxStyle }}>
									{def ? def.renderFront(entry.fields) : <UnknownFace />}
								</div>
								<button
									type="button"
									onClick={() => onPlay(entry.id)}
									style={playBtnStyle}
									title="場に出す"
								>
									場に出す
								</button>
							</div>
						);
					})}
				</div>
			) : (
				<div style={emptyStyle}>手札なし</div>
			)}
			{othersCount > 0 && <div style={othersStyle}>🂠 他 {othersCount}枚</div>}
		</div>
	);
}

export function sumOthers(awareness: CardHandAwareness | undefined, localUserId: string): number {
	if (!awareness) return 0;
	let total = 0;
	const selfClient = awareness.doc.clientID;
	for (const [clientId, state] of awareness.getStates()) {
		if (clientId === selfClient) continue;
		const h = state.cardHand as { userId?: string; count?: number } | undefined;
		if (!h || typeof h.count !== "number") continue;
		if (h.userId && h.userId === localUserId) continue; // 同一ユーザーの別クライアントは二重計上しない
		total += h.count;
	}
	return total;
}

function UnknownFace() {
	return <div style={{ width: "100%", height: "100%", background: "#ddd", borderRadius: 6 }} />;
}

const wrapStyle: React.CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 6,
	fontFamily: "system-ui, sans-serif",
};

const cardsStyle: React.CSSProperties = {
	display: "flex",
	flexWrap: "wrap",
	alignItems: "flex-end",
	gap: 6,
	maxHeight: 220,
	overflowY: "auto",
};

const cardWrapStyle: React.CSSProperties = {
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	gap: 3,
};

const faceBoxStyle: React.CSSProperties = {
	borderRadius: 5,
	overflow: "hidden",
	boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
	background: "#fff",
};

const playBtnStyle: React.CSSProperties = {
	height: 20,
	padding: "0 6px",
	border: "1px solid #2680eb",
	borderRadius: 5,
	background: "#e8f0fe",
	color: "#2680eb",
	fontSize: 10,
	cursor: "pointer",
};

const emptyStyle: React.CSSProperties = {
	color: "#888",
	fontSize: 12,
	padding: "2px 0",
};

const othersStyle: React.CSSProperties = {
	color: "#666",
	fontSize: 12,
	whiteSpace: "nowrap",
};
