import type { PluginContext, TransientObject, UsketchPlugin } from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";

const CURSOR_COLORS = [
	"#e74c3c",
	"#3498db",
	"#2ecc71",
	"#f39c12",
	"#9b59b6",
	"#1abc9c",
	"#e67e22",
	"#e84393",
];

function getUserColor(userId: string): string {
	let hash = 0;
	for (let i = 0; i < userId.length; i++) {
		hash = (hash * 31 + userId.charCodeAt(i)) | 0;
	}
	return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

const STATUS_EMOJI: Record<string, string> = {
	active: "",
	away: "💤",
	busy: "🔴",
	presenting: "📺",
};

function RemoteCursor({ obj }: { obj: TransientObject }) {
	const color = (obj.data.color as string) || "#999";
	const name = (obj.data.name as string) || "";
	const status = (obj.data.status as string) || "active";
	const statusEmoji = STATUS_EMOJI[status] ?? "";

	return (
		<>
			<svg
				width="16"
				height="22"
				viewBox="0 0 16 22"
				style={{ position: "absolute", left: -2, top: -2 }}
			>
				<path
					d="M0 0L14 10.5L7.5 11.5L11 21L7 19L4 11L0 14Z"
					fill={color}
					stroke="#fff"
					strokeWidth="1"
				/>
			</svg>
			{(name || statusEmoji) && (
				<div
					style={{
						position: "absolute",
						left: 16,
						top: 16,
						background: color,
						color: "#fff",
						fontSize: "11px",
						padding: "1px 5px",
						borderRadius: "3px",
						whiteSpace: "nowrap",
						pointerEvents: "none",
					}}
				>
					{statusEmoji && <span style={{ marginRight: 2 }}>{statusEmoji}</span>}
					{name}
				</div>
			)}
		</>
	);
}

export interface PresenceCursorOptions {
	wsProvider: WsProviderHandle;
	userId: string;
	userName: string;
}

export function createPresenceCursorPlugin(options: PresenceCursorOptions): UsketchPlugin {
	const { wsProvider, userId, userName } = options;
	const color = getUserColor(userId);
	const { awareness } = wsProvider;

	return {
		id: "usketch-plugin-presence-cursor",
		name: "プレゼンスカーソル",

		setup(ctx: PluginContext) {
			ctx.transient.registerType("remote-cursor", {
				render: (obj) => <RemoteCursor obj={obj} />,
			});

			awareness.setLocalStateField("user", { name: userName, color });

			const activeCursors = new Set<number>();

			function onAwarenessChange() {
				const states = awareness.getStates();
				const currentClients = new Set<number>();

				for (const [clientId, state] of states) {
					if (clientId === awareness.doc.clientID) continue;
					const user = state.user as { name?: string; color?: string; status?: string } | undefined;
					const cursor = state.cursor as Record<string, unknown> | undefined;

					// バリデーション
					if (!user || !cursor || typeof cursor.x !== "number" || typeof cursor.y !== "number") {
						continue;
					}

					currentClients.add(clientId);
					ctx.transient.emit({
						id: `cursor-${clientId}`,
						type: "remote-cursor",
						sourceUserId: String(clientId),
						position: { x: cursor.x, y: cursor.y },
						data: {
							name: user.name || "",
							color: user.color || getUserColor(String(clientId)),
							status: user.status ?? (state.presenting === true ? "presenting" : "active"),
						},
						ttl: 5000,
						createdAt: Date.now(),
					});
				}

				for (const clientId of activeCursors) {
					if (!currentClients.has(clientId)) {
						ctx.transient.dismiss(`cursor-${clientId}`);
					}
				}
				activeCursors.clear();
				for (const id of currentClients) {
					activeCursors.add(id);
				}
			}

			awareness.on("change", onAwarenessChange);

			// canvas:pointermoveイベントからworldPoint座標を取得
			const unsubPointerMove = ctx.events.on(
				"canvas:pointermove",
				(event: { worldPoint: { x: number; y: number } }) => {
					awareness.setLocalStateField("cursor", event.worldPoint);
				},
			);

			const handleMouseLeave = () => {
				awareness.setLocalStateField("cursor", null);
			};

			window.addEventListener("mouseleave", handleMouseLeave);

			return () => {
				awareness.off("change", onAwarenessChange);
				unsubPointerMove();
				window.removeEventListener("mouseleave", handleMouseLeave);
			};
		},
	};
}
