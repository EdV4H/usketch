import type { PluginContext, TransientObject, UsketchPlugin } from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";
import { AvatarCircle } from "./avatar-circle.js";

const AVATAR_BASE_SIZE = 40;
/** viewportCenter の awareness 送信間隔の下限（ms）。キャラ追従などで毎フレーム動くビューポートでも ~20Hz に抑える */
const VIEWPORT_SYNC_INTERVAL_MS = 50;
/** アバターの最小ピクセルサイズ */
const AVATAR_MIN_SIZE = 20;

function avatarSize(zoom: number): number {
	return Math.max(AVATAR_MIN_SIZE, AVATAR_BASE_SIZE * zoom);
}

function WorldAvatar({ obj }: { obj: TransientObject }) {
	const name = (obj.data.name as string) || "";
	const image = (obj.data.image as string | null) ?? null;
	const userId = obj.sourceUserId;
	const size = AVATAR_BASE_SIZE;

	return (
		<div style={{ position: "absolute", left: -size / 2, top: -size / 2 }}>
			<AvatarCircle image={image} name={name} userId={userId} size={size} />
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
	/**
	 * クライアントの awareness 状態に対して true を返す間、そのクライアントのアバター（自分を含む）を
	 * 表示しない。例: 操作キャラ（`character` フィールド）で表示されている間は二重に出さない。
	 */
	hideAvatar?: (state: Record<string, unknown>) => boolean;
}

export function createAvatarPlugin(options: AvatarPluginOptions): UsketchPlugin {
	const { wsProvider, userId, userName, userImage, hideAvatar } = options;
	const isHidden = (state: Record<string, unknown> | null | undefined) =>
		!!state && !!hideAvatar?.(state);
	const { awareness } = wsProvider;

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
			let selfHidden = isHidden(awareness.getLocalState());

			// 送信を間引く: 直近の送信から VIEWPORT_SYNC_INTERVAL_MS 以内なら最後の値だけを後で送る
			let lastViewportSync = Number.NEGATIVE_INFINITY;
			let viewportSyncTimer: ReturnType<typeof setTimeout> | null = null;
			function scheduleViewportCenterSync() {
				if (viewportSyncTimer !== null) return;
				const wait = lastViewportSync + VIEWPORT_SYNC_INTERVAL_MS - Date.now();
				if (wait <= 0) {
					syncLocalViewportCenter();
					return;
				}
				viewportSyncTimer = setTimeout(() => {
					viewportSyncTimer = null;
					syncLocalViewportCenter();
				}, wait);
			}

			function syncLocalViewportCenter() {
				lastViewportSync = Date.now();
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
				const zoomChanged = vp.zoom !== lastVp.zoom;
				lastVp = vp;
				scheduleViewportCenterSync();
				// ズームが変わったらアバターサイズを更新
				if (zoomChanged) {
					currentZoom = vp.zoom;
					registerSelfLayer();
				}
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

			// ツール切替は Control HUD のツール一覧に一本化したため、アバターの
			// ラジアルメニューは撤去（クリックはキャンバスへ伝播させないだけ）。
			let currentZoom = ctx.store.getViewport().zoom;

			function registerSelfLayer() {
				const size = avatarSize(currentZoom);
				ctx.layers.unregister("avatar-self");
				if (selfHidden) return;
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
								// Keep clicks on your own avatar from reaching the canvas tools.
								e.stopPropagation();
							}}
						>
							<AvatarCircle
								image={selfImage}
								name={selfName}
								userId={selfUserId}
								size={size}
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
				const newHidden = isHidden(localState);
				if (
					newName !== selfName ||
					newImage !== selfImage ||
					newUserId !== selfUserId ||
					newHidden !== selfHidden
				) {
					selfName = newName;
					selfImage = newImage;
					selfUserId = newUserId;
					selfHidden = newHidden;
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
						isHidden(state) ||
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

			return () => {
				clearTimeout(delayedCheck);
				if (viewportSyncTimer !== null) clearTimeout(viewportSyncTimer);
				awareness.off("change", onAwarenessChange);
				unsubStore();
				ctx.layers.unregister("avatar-self");
			};
		},
	};
}
