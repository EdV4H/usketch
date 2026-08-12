import { AppProvider, Canvas, TransientLayer } from "@edv4h/usketch-canvas-engine";
import { type AppInstance, createApp } from "@edv4h/usketch-core";
import { createDomRendererPlugin } from "@edv4h/usketch-dom-renderer";
import { createActivityFeedPlugin } from "@edv4h/usketch-plugin-activity-feed";
import { createAvatarPlugin } from "@edv4h/usketch-plugin-avatar";
import { createDotsBgPlugin } from "@edv4h/usketch-plugin-bg-dots";
import { createGridBgPlugin } from "@edv4h/usketch-plugin-bg-grid";
import { createBoardInfoPanelPlugin } from "@edv4h/usketch-plugin-board-info-panel";
import { createFilterPlugin } from "@edv4h/usketch-plugin-canvas-filter";
import { createCommentsPlugin } from "@edv4h/usketch-plugin-comments";
import { createCommunityChatPlugin } from "@edv4h/usketch-plugin-community-chat";
import { createDebugHudPlugin } from "@edv4h/usketch-plugin-debug-hud";
import { createRippleEffectPlugin } from "@edv4h/usketch-plugin-effect-ripple";
import { createFollowMePlugin } from "@edv4h/usketch-plugin-follow-me";
import { createKeyboardShortcutsPlugin } from "@edv4h/usketch-plugin-keyboard-shortcuts";
import { createMapPlugin } from "@edv4h/usketch-plugin-map";
import { createPresenceCursorPlugin } from "@edv4h/usketch-plugin-presence-cursor";
import { createReactionsPlugin } from "@edv4h/usketch-plugin-reactions";
import {
	type BoardPortalShapeData,
	createBoardPortalPlugin,
} from "@edv4h/usketch-plugin-shape-board-portal";
import { createGroupPlugin } from "@edv4h/usketch-plugin-shape-group";
import { createIslandPlugin } from "@edv4h/usketch-plugin-shape-island";
import { createSidePanelPlugin } from "@edv4h/usketch-plugin-side-panel";
import { createSpatialChatPlugin } from "@edv4h/usketch-plugin-spatial-chat";
import { createSpotlightPlugin } from "@edv4h/usketch-plugin-spotlight";
import { createStartPositionPlugin } from "@edv4h/usketch-plugin-start-position";
import { createYjsSync } from "@edv4h/usketch-plugin-sync-localstorage-yjs";
import { createPanToolPlugin } from "@edv4h/usketch-plugin-tool-pan";
import { createSelectToolPlugin } from "@edv4h/usketch-plugin-tool-select";
import { createViewportNavPlugin } from "@edv4h/usketch-plugin-viewport-nav";
import { createVotingPlugin } from "@edv4h/usketch-plugin-voting";
import { createWhistlePlugin } from "@edv4h/usketch-plugin-whistle";
import type { UsketchPlugin } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { createWsProvider, type WsProviderHandle } from "@edv4h/usketch-sync";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { api } from "../../lib/api.js";
import { getDevUser } from "../../lib/dev-auth.js";
import { getErrorMessage } from "../../lib/errors.js";
import { useAuth } from "../../lib/use-auth.js";
import { useCommunityActions } from "../../lib/use-community-actions.js";
import { useKeyboardShortcuts } from "../../lib/use-keyboard-shortcuts.js";
import { CommunityHeader } from "./community-header.js";

export function CommunityPage() {
	const { slug } = useParams<{ slug: string }>();
	const navigate = useNavigate();
	const { user: authUser } = useAuth();
	const authUserId = authUser?.id ?? null;
	const authUserName = authUser?.name ?? null;
	const authUserImage = authUser?.image ?? null;
	const [app, setApp] = useState<AppInstance | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [regionName, setRegionName] = useState<string>("");
	const wsProviderRef = useRef<WsProviderHandle | null>(null);

	useEffect(() => {
		if (!slug) return;

		let cancelled = false;
		let instance: AppInstance | null = null;
		let store: ReturnType<typeof createBoardStore> | null = null;
		let syncHandle: ReturnType<typeof createYjsSync> | null = null;
		let wsProvider: WsProviderHandle | null = null;
		const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

		(async () => {
			try {
				// slug → boardId 解決
				const res = await fetch(`${apiUrl}/api/community-boards/${slug}`);
				if (!res.ok) throw new Error("Community board not found");
				const regionData = await res.json();
				const boardId: string = regionData.boardId;
				if (cancelled) return;
				setRegionName(regionData.displayName);

				store = createBoardStore();
				syncHandle = createYjsSync(store, `usketch-community-${boardId}`);

				const extraPlugins: UsketchPlugin[] = [];

				// コミュニティ空間にはboard-portalシェイプ + コミュニケーション系プラグインのみ
				const portalPlugin = createBoardPortalPlugin({
					onPortalOpen: (portalBoardId) => {
						navigate(`/boards/${portalBoardId}`);
					},
					onPortalCreate: async (shapeId, _position, isPublic) => {
						try {
							const board = await api.boards.create("New Board");
							if (isPublic) {
								await api.boards.update(board.id, { isPublic: true });
							}
							store?.updateShape(shapeId, {
								boardId: board.id,
								boardTitle: board.title,
								ownerName: authUserName ?? "",
								ownerImage: authUserImage ?? "",
								isPublic,
							} as Partial<BoardPortalShapeData>);
						} catch (e) {
							console.error("Failed to create board:", e);
							store?.deleteShape(shapeId);
						}
					},
				});

				// Cloud sync（認証済みの場合）
				if (authUserId) {
					let wsUrl = `${apiUrl.replace(/^http/, "ws")}/api/boards/${boardId}/ws`;
					if (import.meta.env.DEV) {
						const devUser = getDevUser();
						if (devUser) {
							wsUrl += `?devUserId=${encodeURIComponent(devUser.id)}`;
						}
					}
					wsProvider = createWsProvider({ url: wsUrl, doc: syncHandle?.doc });
					wsProviderRef.current = wsProvider;

					extraPlugins.push(createRippleEffectPlugin(wsProvider));
					extraPlugins.push(createReactionsPlugin(wsProvider));
					extraPlugins.push(createSpatialChatPlugin(wsProvider));
					extraPlugins.push(createVotingPlugin(wsProvider));
					extraPlugins.push(createSpotlightPlugin(wsProvider));
					extraPlugins.push(createFollowMePlugin({ wsProvider }));
					extraPlugins.push(
						createPresenceCursorPlugin({
							wsProvider,
							userId: authUserId ?? "anonymous",
							userName: authUserName ?? "Anonymous",
						}),
					);
					extraPlugins.push(
						createAvatarPlugin({
							wsProvider,
							userId: authUserId ?? "anonymous",
							userName: authUserName ?? "Anonymous",
							userImage: authUserImage,
						}),
					);
					// サイドパネル + ボード情報パネル + コメント
					// SidePanel プラグインは `side-panel:register-tab` イベントを listen するため、
					// タブを登録する側のプラグインより先に setup されている必要がある。
					extraPlugins.push(createSidePanelPlugin());
					extraPlugins.push(
						createActivityFeedPlugin({
							wsProvider,
							boardId,
							apiUrl,
						}),
					);
					const infoHeaders: Record<string, string> = {};
					if (import.meta.env.DEV) {
						const devUser = getDevUser();
						if (devUser) infoHeaders["X-User-Id"] = devUser.id;
					}
					extraPlugins.push(
						createBoardInfoPanelPlugin({
							apiUrl,
							extraHeaders: Object.keys(infoHeaders).length > 0 ? infoHeaders : undefined,
							onOpenBoard: (openBoardId: string) => {
								navigate(`/boards/${openBoardId}`);
							},
						}),
					);

					extraPlugins.push(
						createCommentsPlugin({
							boardId,
							apiUrl,
							extraHeaders: Object.keys(infoHeaders).length > 0 ? infoHeaders : undefined,
						}),
					);

					extraPlugins.push(
						createCommunityChatPlugin({
							apiUrl: `${apiUrl}/api/boards/${boardId}/chat`,
							extraHeaders: Object.keys(infoHeaders).length > 0 ? infoHeaders : undefined,
							wsProvider,
							userId: authUserId,
							userName: authUserName ?? "Anonymous",
						}),
					);
					extraPlugins.push(createKeyboardShortcutsPlugin({ wsProvider }));
					extraPlugins.push(createWhistlePlugin(wsProvider));
					// Filter plugin after side-panel so tab registration works
					extraPlugins.push(
						createFilterPlugin({
							boardRoomApiUrl: `${apiUrl}/api/boards/${boardId}`,
						}),
					);
				} else {
					extraPlugins.push(createRippleEffectPlugin());
					extraPlugins.push(createReactionsPlugin());
					extraPlugins.push(createSpatialChatPlugin());
					extraPlugins.push(createVotingPlugin());
					extraPlugins.push(createSpotlightPlugin());
					extraPlugins.push(createKeyboardShortcutsPlugin());
					extraPlugins.push(createWhistlePlugin());
					extraPlugins.push(createFilterPlugin());
				}

				const basePlugins: UsketchPlugin[] = [
					createGridBgPlugin(),
					createDotsBgPlugin(),
					createSelectToolPlugin(),
					createPanToolPlugin(),
					createViewportNavPlugin(),
					portalPlugin,
					createGroupPlugin(),
					createIslandPlugin(),
					// Demo default: unset tiles read as sea, so the world map is an
					// infinite ocean with painted land (off-map counts as water).
					createMapPlugin({ emptyTerrain: "water" }),
					// マップの初期視点（スタート位置）を HUD で設定・起動時移動。
					createStartPositionPlugin(),
					createDomRendererPlugin(),
					// Control HUD: hosts plugin operations/settings + the useCommunityActions
					// actions (toggle with the backtick key). Replaces bespoke on-canvas UI.
					createDebugHudPlugin(),
				];

				await syncHandle?.whenSynced;
				if (cancelled || !store) return;

				const plugins = [...basePlugins, ...extraPlugins];
				const created = await createApp({ store, plugins });
				if (cancelled) {
					created.destroy();
					return;
				}
				instance = created;
				const a = instance;
				a.layers.register({
					id: "transient",
					order: 100,
					render: (renderCtx) => <TransientLayer registry={a.transient} ctx={renderCtx} />,
				});

				// Partition request relay: filter plugin → wsProvider → syncHandle
				if (wsProvider && syncHandle) {
					const wp = wsProvider;
					const sh = syncHandle;
					a.events.on<{ partitions: string[] }>("partition:request", (data) => {
						wp.requestPartition(data.partitions);
						for (const name of data.partitions) {
							sh.loadPartition(name);
						}
					});
					a.events.on<{ partitions: string[] }>("partition:unload", (data) => {
						for (const name of data.partitions) {
							sh.unloadPartition(name);
						}
					});
				}

				setApp(instance);
			} catch (e) {
				if (!cancelled) {
					setError(getErrorMessage(e, "Failed to initialize community"));
				}
			}
		})();

		return () => {
			cancelled = true;
			instance?.destroy();
			wsProvider?.destroy();
			wsProviderRef.current = null;
			syncHandle?.destroy();
			setApp(null);
		};
	}, [slug, authUserId, authUserName, authUserImage, navigate]);

	// キーボードショートカット
	useKeyboardShortcuts(app);
	// 横断アクションを Control HUD に登録（旧ヘッダー右ボタン群の代替）
	useCommunityActions(app, !!authUserId);

	if (error) {
		return (
			<div
				style={{
					padding: 24,
					fontFamily: "var(--font-sans)",
					color: "var(--danger)",
					background: "var(--bg-canvas)",
					minHeight: "100vh",
				}}
			>
				<p>Error: {error}</p>
			</div>
		);
	}

	if (!app) return null;

	return (
		<AppProvider app={app}>
			<div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
				<Canvas />
				{/* コミュニティヘッダー */}
				<CommunityHeader regionName={regionName} />
			</div>
		</AppProvider>
	);
}
