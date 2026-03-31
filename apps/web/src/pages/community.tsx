import { AppProvider, Canvas, TransientLayer, useApp } from "@edv4h/usketch-canvas-engine";
import { type AppInstance, createApp } from "@edv4h/usketch-core";
import { createDomRendererPlugin } from "@edv4h/usketch-dom-renderer";
import { createActivityFeedPlugin } from "@edv4h/usketch-plugin-activity-feed";
import { createAvatarPlugin } from "@edv4h/usketch-plugin-avatar";
import { createBoardInfoPanelPlugin } from "@edv4h/usketch-plugin-board-info-panel";
import { createCommentsPlugin } from "@edv4h/usketch-plugin-comments";
import { createCommunityChatPlugin } from "@edv4h/usketch-plugin-community-chat";
import { createRippleEffectPlugin, rippleEffectPlugin } from "@edv4h/usketch-plugin-effect-ripple";
import { createFollowMePlugin } from "@edv4h/usketch-plugin-follow-me";
import { createKeyboardShortcutsPlugin } from "@edv4h/usketch-plugin-keyboard-shortcuts";
import { createPresenceCursorPlugin } from "@edv4h/usketch-plugin-presence-cursor";
import { createReactionsPlugin, reactionsPlugin } from "@edv4h/usketch-plugin-reactions";
import { createBoardPortalPlugin } from "@edv4h/usketch-plugin-shape-board-portal";
import { createSidePanelPlugin } from "@edv4h/usketch-plugin-side-panel";
import { createSpatialChatPlugin, spatialChatPlugin } from "@edv4h/usketch-plugin-spatial-chat";
import { createSpotlightPlugin, spotlightPlugin } from "@edv4h/usketch-plugin-spotlight";
import { createYjsSync } from "@edv4h/usketch-plugin-sync-localstorage-yjs";
import { panToolPlugin } from "@edv4h/usketch-plugin-tool-pan";
import { selectToolPlugin } from "@edv4h/usketch-plugin-tool-select";
import { viewportNavPlugin } from "@edv4h/usketch-plugin-viewport-nav";
import { createVotingPlugin, votingPlugin } from "@edv4h/usketch-plugin-voting";
import type { UsketchPlugin } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { createWsProvider, type WsProviderHandle } from "@edv4h/usketch-sync";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../lib/api.js";
import { getDevUser } from "../lib/dev-auth.js";
import { useAuth } from "../lib/use-auth.js";

const COMMUNITY_BOARD_ID = "community-lobby";

export function CommunityPage() {
	const navigate = useNavigate();
	const { user: authUser } = useAuth();
	const authUserId = authUser?.id ?? null;
	const authUserName = authUser?.name ?? null;
	const authUserImage = authUser?.image ?? null;
	const [app, setApp] = useState<AppInstance | null>(null);
	const [error, setError] = useState<string | null>(null);
	const wsProviderRef = useRef<WsProviderHandle | null>(null);

	useEffect(() => {
		let cancelled = false;
		let instance: AppInstance | null = null;
		const store = createBoardStore();
		const syncHandle = createYjsSync(store, `usketch-community-${COMMUNITY_BOARD_ID}`);

		const extraPlugins: UsketchPlugin[] = [];
		let wsProvider: WsProviderHandle | null = null;
		const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

		// コミュニティ空間にはboard-portalシェイプ + コミュニケーション系プラグインのみ
		const portalPlugin = createBoardPortalPlugin({
			onPortalOpen: (boardId) => {
				navigate(`/boards/${boardId}`);
			},
			onPortalCreate: async (shapeId, _position, isPublic) => {
				// ボードを作成してシェイプにboardIdを紐付け
				try {
					const board = await api.boards.create("New Board");
					if (isPublic) {
						await api.boards.update(board.id, { isPublic: true });
					}
					store.updateShape(shapeId, {
						boardId: board.id,
						boardTitle: board.title,
						ownerName: authUserName ?? "",
						ownerImage: authUserImage ?? "",
						isPublic,
					});
				} catch (e) {
					console.error("Failed to create board:", e);
					store.deleteShape(shapeId);
				}
			},
		});
		// Cloud sync（認証済みの場合）
		if (authUserId) {
			let wsUrl = `${apiUrl.replace(/^http/, "ws")}/api/boards/${COMMUNITY_BOARD_ID}/ws`;
			if (import.meta.env.DEV) {
				const devUser = getDevUser();
				if (devUser) {
					wsUrl += `?devUserId=${encodeURIComponent(devUser.id)}`;
				}
			}
			wsProvider = createWsProvider({ url: wsUrl, doc: syncHandle.doc });
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
			extraPlugins.push(
				createActivityFeedPlugin({
					wsProvider,
					boardId: COMMUNITY_BOARD_ID,
					apiUrl,
				}),
			);

			// サイドパネル + ボード情報パネル + コメント
			extraPlugins.push(createSidePanelPlugin());
			const infoHeaders: Record<string, string> = {};
			if (import.meta.env.DEV) {
				const devUser = getDevUser();
				if (devUser) infoHeaders["X-User-Id"] = devUser.id;
			}
			extraPlugins.push(
				createBoardInfoPanelPlugin({
					apiUrl,
					extraHeaders: Object.keys(infoHeaders).length > 0 ? infoHeaders : undefined,
					onOpenBoard: (boardId: string) => {
						navigate(`/boards/${boardId}`);
					},
				}),
			);

			extraPlugins.push(
				createCommentsPlugin({
					boardId: COMMUNITY_BOARD_ID,
					apiUrl,
					extraHeaders: Object.keys(infoHeaders).length > 0 ? infoHeaders : undefined,
				}),
			);

			extraPlugins.push(
				createCommunityChatPlugin({
					apiUrl: `${apiUrl}/api/boards/${COMMUNITY_BOARD_ID}/chat`,
					extraHeaders: Object.keys(infoHeaders).length > 0 ? infoHeaders : undefined,
					wsProvider,
					userId: authUserId,
					userName: authUserName ?? "Anonymous",
				}),
			);
			extraPlugins.push(createKeyboardShortcutsPlugin({ wsProvider }));
		} else {
			extraPlugins.push(rippleEffectPlugin);
			extraPlugins.push(reactionsPlugin);
			extraPlugins.push(spatialChatPlugin);
			extraPlugins.push(votingPlugin);
			extraPlugins.push(spotlightPlugin);
			extraPlugins.push(createKeyboardShortcutsPlugin());
		}

		const basePlugins: UsketchPlugin[] = [
			selectToolPlugin,
			panToolPlugin,
			viewportNavPlugin,
			portalPlugin,
			createDomRendererPlugin(),
		];

		syncHandle.whenSynced
			.then(() => {
				if (cancelled) return;

				const plugins = [...basePlugins, ...extraPlugins];
				return createApp({ store, plugins }).then((created) => {
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

					setApp(instance);
				});
			})
			.catch((e) => {
				if (!cancelled) {
					setError(e instanceof Error ? e.message : "Failed to initialize community");
				}
			});

		return () => {
			cancelled = true;
			instance?.destroy();
			wsProvider?.destroy();
			wsProviderRef.current = null;
			syncHandle.destroy();
			setApp(null);
		};
	}, [authUserId, authUserName, authUserImage, navigate]);

	// キーボードショートカット
	useEffect(() => {
		if (!app) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			const tag = (e.target as HTMLElement)?.tagName;
			const isInput =
				tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;

			// Escape はテキスト入力中でも通す（入力欄からblurしてツールをselectに戻す）
			if (e.key === "Escape" && isInput) {
				(e.target as HTMLElement)?.blur();
				app.shortcuts.handleKeyDown(e);
				return;
			}

			// テキスト入力中はそれ以外のショートカットを無視
			if (isInput) {
				return;
			}
			const tools = app.tools.getAll();
			for (const [id, def] of tools) {
				if (
					def.shortcut &&
					e.key.toLowerCase() === def.shortcut.toLowerCase() &&
					!e.ctrlKey &&
					!e.metaKey &&
					!e.altKey
				) {
					app.store.setActiveToolId(id);
					return;
				}
			}
			app.shortcuts.handleKeyDown(e);
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [app]);

	if (error) {
		return (
			<div style={{ padding: 24, fontFamily: "system-ui, sans-serif", color: "#c33" }}>
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
				<CommunityHeader />
			</div>
		</AppProvider>
	);
}

function CommunityHeader() {
	const navigate = useNavigate();
	const { user: sessionUser, logout } = useAuth();
	const app = useApp();

	return (
		<>
			<div
				style={{
					position: "fixed",
					top: 12,
					left: 12,
					zIndex: 100,
					display: "flex",
					gap: 8,
					alignItems: "center",
				}}
			>
				<div
					style={{
						background: "white",
						borderRadius: 8,
						padding: "6px 14px",
						boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
						fontSize: 14,
						fontWeight: 600,
						fontFamily: "system-ui, sans-serif",
					}}
				>
					uSketch
				</div>
				{sessionUser ? (
					<button
						type="button"
						onClick={() => {
							logout();
							navigate("/login");
						}}
						style={{
							background: "white",
							border: "none",
							borderRadius: 8,
							padding: "6px 12px",
							boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
							fontSize: 12,
							cursor: "pointer",
							color: "#666",
						}}
					>
						{sessionUser.name} — Sign Out
					</button>
				) : (
					<a
						href="/login"
						style={{
							background: "white",
							borderRadius: 8,
							padding: "6px 12px",
							boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
							fontSize: 12,
							textDecoration: "none",
							color: "#0066ff",
						}}
					>
						Sign In
					</a>
				)}
			</div>
			{/* 右上: サイドパネル開閉ボタン */}
			{sessionUser && (
				<div
					style={{
						position: "fixed",
						top: 12,
						right: 12,
						zIndex: 100,
						display: "flex",
						gap: 6,
					}}
				>
					<button
						type="button"
						onClick={() => app.events.emit("side-panel:toggle", { tabId: "board-info" })}
						style={{
							background: "white",
							border: "none",
							borderRadius: 8,
							padding: "6px 10px",
							boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
							fontSize: 14,
							cursor: "pointer",
							color: "#475569",
						}}
						title="Board Info"
					>
						📋
					</button>
					<button
						type="button"
						onClick={() => app.events.emit("side-panel:toggle", { tabId: "comments" })}
						style={{
							background: "white",
							border: "none",
							borderRadius: 8,
							padding: "6px 10px",
							boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
							fontSize: 14,
							cursor: "pointer",
							color: "#475569",
						}}
						title="Comments"
					>
						💬
					</button>
					<button
						type="button"
						onClick={() => app.events.emit("side-panel:toggle", { tabId: "community-chat" })}
						style={{
							background: "white",
							border: "none",
							borderRadius: 8,
							padding: "6px 10px",
							boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
							fontSize: 14,
							cursor: "pointer",
							color: "#475569",
						}}
						title="Chat"
						aria-label="Chat"
					>
						🗨️
					</button>
				</div>
			)}
		</>
	);
}
