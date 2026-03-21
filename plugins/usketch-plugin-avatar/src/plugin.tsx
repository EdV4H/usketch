import type { PluginContext, TransientObject, UsketchPlugin } from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";
import { AvatarCircle } from "./avatar-circle.js";
import { createRadialMenu, type RadialMenuItem } from "./radial-menu.js";

const AVATAR_SIZE = 40;

function WorldAvatar({ obj }: { obj: TransientObject }) {
	const name = (obj.data.name as string) || "";
	const image = (obj.data.image as string | null) ?? null;
	const userId = obj.sourceUserId;

	return (
		<div style={{ position: "absolute", left: -AVATAR_SIZE / 2, top: -AVATAR_SIZE / 2 }}>
			<AvatarCircle image={image} name={name} userId={userId} size={AVATAR_SIZE} />
			{name && (
				<div
					style={{
						textAlign: "center",
						fontSize: 10,
						color: "#666",
						fontFamily: "system-ui, sans-serif",
						marginTop: 2,
						whiteSpace: "nowrap",
						pointerEvents: "none",
					}}
				>
					{name}
				</div>
			)}
		</div>
	);
}

export interface AvatarPluginOptions {
	wsProvider: WsProviderHandle;
	userId: string;
	userName: string;
	userImage?: string | null;
}

export function createAvatarPlugin(options: AvatarPluginOptions): UsketchPlugin {
	const { wsProvider, userId, userName, userImage } = options;
	const { awareness } = wsProvider;

	let cleanup: (() => void) | undefined;

	return {
		id: "usketch-plugin-avatar",
		name: "アバター",

		setup(ctx: PluginContext) {
			ctx.transient.registerType("avatar", {
				render: (obj) => <WorldAvatar obj={obj} />,
			});

			const activeAvatars = new Set<number>();

			// self-avatar用の状態（awareness変更時に更新→レイヤー再登録）
			let selfName = userName;
			let selfImage = userImage ?? null;
			let selfUserId = userId;

			function syncLocalViewportCenter() {
				const viewport = ctx.store.getViewport();
				// ビューポートの中央をワールド座標で計算
				// viewport: { x, y, zoom } where x,y is the top-left offset
				// 画面中央 = (screenWidth/2, screenHeight/2)
				// ワールド座標 = (screenX - viewport.x) / viewport.zoom
				const screenCenterX = window.innerWidth / 2;
				const screenCenterY = window.innerHeight / 2;
				const worldCenterX = (screenCenterX - viewport.x) / viewport.zoom;
				const worldCenterY = (screenCenterY - viewport.y) / viewport.zoom;

				awareness.setLocalStateField("viewportCenter", {
					x: worldCenterX,
					y: worldCenterY,
				});
			}

			// ビューポート変更時のみ自分の位置を同期（他のstore変更は無視）
			let lastVp = ctx.store.getViewport();
			const unsubStore = ctx.store.subscribe(() => {
				const vp = ctx.store.getViewport();
				if (vp.x === lastVp.x && vp.y === lastVp.y && vp.zoom === lastVp.zoom) return;
				lastVp = vp;
				syncLocalViewportCenter();
			});

			// 初期同期
			syncLocalViewportCenter();

			// ユーザー情報をAwarenessに設定（既にセッション情報で設定済みなら上書きしない）
			const existingAvatar = awareness.getLocalState()?.avatar as
				| { name?: string; image?: string | null; userId?: string }
				| undefined;
			if (!existingAvatar || existingAvatar.userId === "anonymous") {
				awareness.setLocalStateField("avatar", {
					name: userName,
					image: userImage ?? null,
					userId,
				});
			}

			// ツールIDからアイコン文字のマッピング
			const TOOL_ICONS: Record<string, string> = {
				select: "🔲",
				"rectangle-draw": "⬜",
				"ellipse-draw": "⭕",
				"freedraw-draw": "✏️",
				"text-draw": "T",
				"effect-ripple": "💧",
				reaction: "😀",
				laser: "🔴",
				"spatial-chat": "💬",
				spotlight: "🔦",
				voting: "📊",
				"board-portal-create": "🏠",
			};

			const radialMenu = createRadialMenu((toolId) => {
				ctx.store.setActiveToolId(toolId);
			});

			function getToolMenuItems(): RadialMenuItem[] {
				const tools = ctx.tools.getOrdered();
				return tools.map(({ id, definition }) => ({
					id,
					label: `${id}${definition.shortcut ? ` (${definition.shortcut})` : ""}`,
					icon: TOOL_ICONS[id] ?? "•",
				}));
			}

			function registerSelfLayer() {
				ctx.layers.unregister("avatar-self");
				ctx.layers.register({
					id: "avatar-self",
					order: 85,
					fixed: true,
					render: () => (
						<div
							style={{
								position: "absolute",
								left: "50%",
								top: "50%",
								transform: "translate(-50%, -50%)",
								pointerEvents: "auto",
								cursor: "pointer",
							}}
							onPointerDown={(e) => {
								e.stopPropagation();
								const rect = e.currentTarget.getBoundingClientRect();
								const cx = rect.left + rect.width / 2;
								const cy = rect.top + rect.height / 2;
								radialMenu.toggle(cx, cy, getToolMenuItems());
							}}
						>
							<AvatarCircle
								image={selfImage}
								name={selfName}
								userId={selfUserId}
								size={AVATAR_SIZE}
								opacity={0.6}
							/>
						</div>
					),
				});
			}

			function onAwarenessChange() {
				// self-avatar情報をawarenessから更新
				const localState = awareness.getLocalState();
				const av = localState?.avatar as
					| { name?: string; image?: string | null; userId?: string }
					| undefined;
				const newName = av?.name ?? userName;
				const newImage = av?.image ?? userImage ?? null;
				const newUserId = av?.userId ?? userId;
				if (newName !== selfName || newImage !== selfImage || newUserId !== selfUserId) {
					selfName = newName;
					selfImage = newImage;
					selfUserId = newUserId;
					registerSelfLayer();
				}

				const states = awareness.getStates();
				const currentClients = new Set<number>();

				for (const [clientId, state] of states) {
					if (clientId === awareness.doc.clientID) continue;

					const avatar = state.avatar as
						| { name?: string; image?: string | null; userId?: string }
						| undefined;
					const viewportCenter = state.viewportCenter as { x: number; y: number } | undefined;

					if (
						!avatar ||
						!viewportCenter ||
						typeof viewportCenter.x !== "number" ||
						typeof viewportCenter.y !== "number"
					) {
						continue;
					}

					currentClients.add(clientId);
					ctx.transient.emit({
						id: `avatar-${clientId}`,
						type: "avatar",
						sourceUserId: avatar.userId || String(clientId),
						position: { x: viewportCenter.x, y: viewportCenter.y },
						data: {
							name: avatar.name || "",
							image: avatar.image ?? null,
						},
						createdAt: Date.now(),
					});
				}

				// 切断されたクライアントのアバターを削除
				for (const clientId of activeAvatars) {
					if (!currentClients.has(clientId)) {
						ctx.transient.dismiss(`avatar-${clientId}`);
					}
				}
				activeAvatars.clear();
				for (const id of currentClients) {
					activeAvatars.add(id);
				}
			}

			awareness.on("change", onAwarenessChange);

			// 既にawarenessに設定されているavatar情報を読んで初期表示に反映
			const existingState = awareness.getLocalState();
			const existingAv = existingState?.avatar as
				| { name?: string; image?: string | null; userId?: string }
				| undefined;
			if (existingAv) {
				selfName = existingAv.name ?? userName;
				selfImage = existingAv.image ?? userImage ?? null;
				selfUserId = existingAv.userId ?? userId;
			}

			// 自分のアバターをfixedレイヤーとして初期登録
			registerSelfLayer();

			// セッション情報はプラグイン初期化後に非同期で設定されるため、
			// 遅延チェックでavatar情報の更新を拾う
			const delayedCheck = setTimeout(() => onAwarenessChange(), 2000);

			cleanup = () => {
				clearTimeout(delayedCheck);
				awareness.off("change", onAwarenessChange);
				unsubStore();
				radialMenu.destroy();
				ctx.layers.unregister("avatar-self");
			};
		},

		teardown() {
			cleanup?.();
		},
	};
}
