import { useApp } from "@edv4h/usketch-canvas-engine";
import type React from "react";
import { useSyncExternalStore } from "react";
import type { CardHandAwareness, HandStore } from "./hand-store.js";
import type { CardTypeDefinition } from "./types.js";

/**
 * Bottom-fixed hand tray (#671). Shows **this client's** hand — contents live
 * only in `handStore` (localStorage), never on the network. Others' hands show
 * as a count only (read from awareness `cardHand.count`). Each card has a
 * "場に出す" (play) button; playing emits `card:play-from-hand`.
 */
export function HandTray({
	handStore,
	registry,
	localUserId,
	awareness,
}: {
	handStore: HandStore;
	registry: Map<string, CardTypeDefinition>;
	localUserId: string;
	awareness?: CardHandAwareness;
}) {
	const app = useApp();
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

	if (hand.length === 0 && othersCount === 0) return null;

	return (
		<div style={wrapStyle}>
			<div style={trayStyle} onPointerDown={(e) => e.stopPropagation()}>
				{hand.map((entry) => {
					const def = registry.get(entry.cardType);
					const aspect = def?.aspectRatio ?? 0.7;
					const h = 96;
					const w = Math.round(h * aspect);
					return (
						<div key={entry.id} style={cardWrapStyle}>
							<div style={{ width: w, height: h, ...faceBoxStyle }}>
								{def ? def.renderFront(entry.fields) : <UnknownFace />}
							</div>
							<button
								type="button"
								onClick={() => app.events.emit("card:play-from-hand", { id: entry.id })}
								style={playBtnStyle}
								title="場に出す"
							>
								場に出す
							</button>
						</div>
					);
				})}
				{othersCount > 0 && <div style={othersStyle}>🂠 他 {othersCount}枚</div>}
			</div>
		</div>
	);
}

function sumOthers(awareness: CardHandAwareness | undefined, localUserId: string): number {
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
	position: "absolute",
	left: 0,
	right: 0,
	bottom: 12,
	display: "flex",
	justifyContent: "center",
	pointerEvents: "none",
};

const trayStyle: React.CSSProperties = {
	display: "flex",
	alignItems: "flex-end",
	gap: 8,
	padding: "8px 12px",
	background: "rgba(255,255,255,0.95)",
	borderRadius: 12,
	boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
	fontFamily: "system-ui, sans-serif",
	maxWidth: "90%",
	overflowX: "auto",
	pointerEvents: "auto",
};

const cardWrapStyle: React.CSSProperties = {
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	gap: 4,
};

const faceBoxStyle: React.CSSProperties = {
	borderRadius: 6,
	overflow: "hidden",
	boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
	background: "#fff",
};

const playBtnStyle: React.CSSProperties = {
	height: 22,
	padding: "0 8px",
	border: "1px solid #2680eb",
	borderRadius: 5,
	background: "#e8f0fe",
	color: "#2680eb",
	fontSize: 11,
	cursor: "pointer",
};

const othersStyle: React.CSSProperties = {
	alignSelf: "center",
	padding: "0 8px",
	color: "#666",
	fontSize: 12,
	whiteSpace: "nowrap",
};
