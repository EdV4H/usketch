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

interface CursorBroadcast {
	kind: "cursor";
	userId: string;
	name: string;
	color: string;
	cursor: { x: number; y: number } | null;
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

	return {
		id: "usketch-plugin-presence-cursor",
		name: "プレゼンスカーソル",

		setup(ctx: PluginContext) {
			ctx.transient.registerType("remote-cursor", {
				render: (obj) => <RemoteCursor obj={obj} />,
			});

			// リモートカーソルの受信
			const unsubBroadcast = wsProvider.onBroadcast((msg) => {
				if (msg.kind !== "cursor") return;
				const data = msg as unknown as CursorBroadcast;

				if (data.cursor) {
					ctx.transient.emit({
						id: `cursor-${data.userId}`,
						type: "remote-cursor",
						sourceUserId: data.userId,
						position: data.cursor,
						data: { name: data.name, color: data.color },
						ttl: 5000,
						createdAt: Date.now(),
					});
				} else {
					ctx.transient.dismiss(`cursor-${data.userId}`);
				}
			});

			// ローカルカーソルの送信
			const handleMouseMove = (e: MouseEvent) => {
				const viewport = ctx.store.getViewport();
				const x = (e.clientX - viewport.x) / viewport.zoom;
				const y = (e.clientY - viewport.y) / viewport.zoom;

				wsProvider.broadcast({ kind: "cursor", userId, name: userName, color, cursor: { x, y } });
			};

			const handleMouseLeave = () => {
				wsProvider.broadcast({ kind: "cursor", userId, name: userName, color, cursor: null });
			};

			window.addEventListener("mousemove", handleMouseMove);
			window.addEventListener("mouseleave", handleMouseLeave);

			(this as unknown as Record<string, unknown>)._cleanup = () => {
				unsubBroadcast();
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
