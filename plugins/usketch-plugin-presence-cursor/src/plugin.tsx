import type { AwarenessState, WsProviderHandle } from "@edv4h/usketch-plugin-sync-localstorage-yjs";
import type { PluginContext, TransientObject, UsketchPlugin } from "@edv4h/usketch-shared";

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
			{/* カーソルアイコン */}
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
			{/* ユーザー名ラベル */}
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

	return {
		id: "usketch-plugin-presence-cursor",
		name: "プレゼンスカーソル",

		setup(ctx: PluginContext) {
			// リモートカーソルのレンダラーを登録
			ctx.transient.registerType("remote-cursor", {
				render: (obj) => <RemoteCursor obj={obj} />,
			});

			// リモートAwareness → TransientRegistry
			const unsubAwareness = wsProvider.onAwarenessChange((states: Map<string, AwarenessState>) => {
				// 既存のリモートカーソルをクリア
				for (const [, obj] of ctx.transient.getAll()) {
					if (obj.type === "remote-cursor") {
						ctx.transient.dismiss(obj.id);
					}
				}
				// リモートカーソルをemit
				for (const [remoteUserId, state] of states) {
					if (state.cursor) {
						ctx.transient.emit({
							id: `cursor-${remoteUserId}`,
							type: "remote-cursor",
							sourceUserId: remoteUserId,
							position: state.cursor,
							data: { name: state.name, color: state.color },
							ttl: 5000,
							createdAt: Date.now(),
						});
					}
				}
			});

			// ローカルカーソル → Awareness
			const handleMouseMove = (e: MouseEvent) => {
				const viewport = ctx.store.getViewport();
				const x = (e.clientX - viewport.x) / viewport.zoom;
				const y = (e.clientY - viewport.y) / viewport.zoom;

				wsProvider.setAwareness({ userId, name: userName, color, cursor: { x, y } });
			};

			const handleMouseLeave = () => {
				wsProvider.setAwareness({ userId, name: userName, color, cursor: null });
			};

			window.addEventListener("mousemove", handleMouseMove);
			window.addEventListener("mouseleave", handleMouseLeave);

			// teardown用にハンドラを保存
			(this as unknown as Record<string, unknown>)._cleanup = () => {
				unsubAwareness();
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
