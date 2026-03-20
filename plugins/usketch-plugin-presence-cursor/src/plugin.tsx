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

function RemoteCursor({ obj }: { obj: TransientObject }) {
	const color = (obj.data.color as string) ?? "#999";
	const name = (obj.data.name as string) ?? "";

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
			{name && (
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

			// Awarenessにローカルユーザー情報を設定
			awareness.setLocalStateField("user", { name: userName, color });

			// Awareness変更 → TransientRegistryに反映
			function onAwarenessChange() {
				// 既存のリモートカーソルをクリア
				for (const [, obj] of ctx.transient.getAll()) {
					if (obj.type === "remote-cursor") {
						ctx.transient.dismiss(obj.id);
					}
				}

				// 全Awarenessステートを走査
				for (const [clientId, state] of awareness.getStates()) {
					if (clientId === awareness.doc.clientID) continue; // 自分は除外
					const user = state.user as { name: string; color: string } | undefined;
					const cursor = state.cursor as { x: number; y: number } | undefined;
					if (!user || !cursor) continue;

					ctx.transient.emit({
						id: `cursor-${clientId}`,
						type: "remote-cursor",
						sourceUserId: String(clientId),
						position: cursor,
						data: { name: user.name, color: user.color },
						ttl: 5000,
						createdAt: Date.now(),
					});
				}
			}

			awareness.on("change", onAwarenessChange);

			// ローカルカーソルの送信
			const handleMouseMove = (e: MouseEvent) => {
				const viewport = ctx.store.getViewport();
				const x = (e.clientX - viewport.x) / viewport.zoom;
				const y = (e.clientY - viewport.y) / viewport.zoom;
				awareness.setLocalStateField("cursor", { x, y });
			};

			const handleMouseLeave = () => {
				awareness.setLocalStateField("cursor", null);
			};

			window.addEventListener("mousemove", handleMouseMove);
			window.addEventListener("mouseleave", handleMouseLeave);

			(this as unknown as Record<string, unknown>)._cleanup = () => {
				awareness.off("change", onAwarenessChange);
				window.removeEventListener("mousemove", handleMouseMove);
				window.removeEventListener("mouseleave", handleMouseLeave);
			};
		},

		teardown() {
			const cleanup = (this as unknown as Record<string, unknown>)._cleanup as
				| (() => void)
				| undefined;
			cleanup?.();
		},
	};
}
