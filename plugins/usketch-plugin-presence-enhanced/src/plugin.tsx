import type { PluginContext, TransientObject, UsketchPlugin } from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";

const GHOST_AVATAR_SIZE = 36;

function formatTimeAgo(isoString: string): string {
	const diff = Date.now() - new Date(isoString).getTime();
	const minutes = Math.floor(diff / 60000);
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

function GhostAvatar({ obj }: { obj: TransientObject }) {
	const name = (obj.data.name as string) || "";
	const image = (obj.data.image as string | null) ?? null;
	const lastSeenAt = (obj.data.lastSeenAt as string) || "";
	const initials = name
		.split(/\s+/)
		.map((w) => w[0])
		.filter(Boolean)
		.slice(0, 2)
		.join("")
		.toUpperCase();

	return (
		<div
			style={{
				position: "absolute",
				left: -GHOST_AVATAR_SIZE / 2,
				top: -GHOST_AVATAR_SIZE / 2,
				opacity: 0.4,
				pointerEvents: "none",
			}}
		>
			<div
				style={{
					width: GHOST_AVATAR_SIZE,
					height: GHOST_AVATAR_SIZE,
					borderRadius: "50%",
					overflow: "hidden",
					border: "2px solid #999",
					background: "#ccc",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontSize: GHOST_AVATAR_SIZE * 0.35,
					fontWeight: 600,
					color: "#fff",
					fontFamily: "system-ui, sans-serif",
					filter: "grayscale(1)",
				}}
			>
				{image ? (
					<img
						src={image}
						alt={name}
						style={{ width: "100%", height: "100%", objectFit: "cover" }}
					/>
				) : (
					initials || "?"
				)}
			</div>
			<div
				style={{
					textAlign: "center",
					fontSize: 9,
					color: "#999",
					fontFamily: "system-ui, sans-serif",
					marginTop: 2,
					whiteSpace: "nowrap",
				}}
			>
				{name}
			</div>
			{lastSeenAt && (
				<div
					style={{
						textAlign: "center",
						fontSize: 8,
						color: "#bbb",
						fontFamily: "system-ui, sans-serif",
					}}
				>
					{formatTimeAgo(lastSeenAt)}
				</div>
			)}
		</div>
	);
}

interface MemberInfo {
	userId: string;
	name: string;
	image: string | null;
	lastViewport: string | null;
	lastSeenAt: string | null;
	status: string;
}

export interface PresenceEnhancedOptions {
	wsProvider: WsProviderHandle;
	boardId: string;
	apiUrl: string;
}

export function createPresenceEnhancedPlugin(options: PresenceEnhancedOptions): UsketchPlugin {
	const { wsProvider, boardId, apiUrl } = options;
	const { awareness } = wsProvider;

	let cleanup: (() => void) | undefined;

	return {
		id: "usketch-plugin-presence-enhanced",
		name: "拡張プレゼンス",

		setup(ctx: PluginContext) {
			ctx.transient.registerType("ghost-avatar", {
				render: (obj) => <GhostAvatar obj={obj} />,
			});

			const activeGhosts = new Set<string>();
			let pollTimer: ReturnType<typeof setInterval> | null = null;

			async function fetchAndRenderGhosts() {
				try {
					const res = await fetch(`${apiUrl}/api/boards/${boardId}/members`, {
						credentials: "include",
					});
					if (!res.ok) return;

					const members: MemberInfo[] = await res.json();
					const onlineClientIds = new Set<number>();
					for (const [clientId] of awareness.getStates()) {
						onlineClientIds.add(clientId);
					}

					// オフラインメンバーのゴーストを表示
					const newGhosts = new Set<string>();
					for (const member of members) {
						if (member.status === "online") continue;
						if (!member.lastViewport) continue;

						let viewport: { x: number; y: number };
						try {
							viewport = JSON.parse(member.lastViewport);
						} catch {
							continue;
						}

						if (typeof viewport.x !== "number" || typeof viewport.y !== "number") continue;

						const ghostId = `ghost-${member.userId}`;
						newGhosts.add(ghostId);

						ctx.transient.emit({
							id: ghostId,
							type: "ghost-avatar",
							sourceUserId: member.userId,
							position: viewport,
							data: {
								name: member.name,
								image: member.image,
								lastSeenAt: member.lastSeenAt,
							},
							createdAt: Date.now(),
						});
					}

					// 消えたゴーストをdismiss
					for (const id of activeGhosts) {
						if (!newGhosts.has(id)) {
							ctx.transient.dismiss(id);
						}
					}
					activeGhosts.clear();
					for (const id of newGhosts) {
						activeGhosts.add(id);
					}
				} catch {
					// フェッチ失敗は無視
				}
			}

			// 初回フェッチ + 30秒間隔でポーリング
			fetchAndRenderGhosts();
			pollTimer = setInterval(fetchAndRenderGhosts, 30000);

			// awareness変更時にも更新（オンラインになったらゴースト消す）
			function onAwarenessChange() {
				fetchAndRenderGhosts();
			}
			awareness.on("change", onAwarenessChange);

			cleanup = () => {
				if (pollTimer) clearInterval(pollTimer);
				awareness.off("change", onAwarenessChange);
				for (const id of activeGhosts) {
					ctx.transient.dismiss(id);
				}
				activeGhosts.clear();
				ctx.layers.unregister("presence-enhanced");
			};
		},

		teardown() {
			cleanup?.();
		},
	};
}
