import { AppProvider, Canvas } from "@edv4h/usketch-canvas-engine";
import { getWindowSystemApi } from "@edv4h/usketch-plugin-window-system";
import { createPage, initPagedBoard, listPages, resolvePageId } from "@edv4h/usketch-sync";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useParams } from "react-router";
import {
	API_URL,
	type BoardSource,
	devHeaders,
	type PagePermissions,
	readRenderer3d,
	useBoardHost,
	useBoardPermissions,
} from "./board-host/index.js";
import { CopilotPill } from "./components/board-frame/index.js";
import { ShareDialog } from "./components/share-dialog.js";
import { InfoTab } from "./components/side-panel/info-tab.js";
import { boardMetaStore } from "./lib/board-meta-store.js";
import { pageSearch, readLastPage, readRequestedPage } from "./lib/board-pages.js";
import { localBoards } from "./lib/local-boards.js";
import { computePresentStage, type StageRect } from "./lib/present-stage.js";
import { useAppActions } from "./lib/use-app-actions.js";
import { useAuth } from "./lib/use-auth.js";
import { useKeyboardShortcuts } from "./lib/use-keyboard-shortcuts.js";
import { createCompare3dPlugin, readCompare3dScene } from "./plugins/compare-3d.js";

type PresentationMode = "off" | "edit" | "present";

/**
 * URL から現在のプレゼンテーション状態を読む。
 * - `?present=1` があれば edit（発表オフ時のプレゼン編集モード）
 * - `?present=1&mode=present` があれば present（発表中）
 * - いずれも無ければ off（通常のホワイトボード）
 */
function readPresentationMode(search: string): PresentationMode {
	const params = new URLSearchParams(search);
	if (params.get("present") !== "1") return "off";
	return params.get("mode") === "present" ? "present" : "edit";
}

/**
 * `?desktop=1` があれば、このボードを「デスクトップ」として開く — window-system
 * プラグインを既定で有効化する（コミュニティページの「デスクトップを追加」で作成した
 * ボードに付く）。有効化で config シェイプが作られ shape として永続化されるので、
 * 次回以降はフラグ無しでもデスクトップのまま。冪等（既存 config には作用しない）。
 */
function readDesktopTemplate(search: string): boolean {
	return new URLSearchParams(search).get("desktop") === "1";
}

/** `/boards/:boardId`（クラウド）と `/local/:boardId`（手元）のボード。プリセットは whiteboard。 */
/** 見る権限の無いページを除く（開くページを選ぶとき）。 */
function visibleOnly<T extends { id: string }>(
	pages: T[],
	permissions: PagePermissions | null,
): T[] {
	const isVisible = permissions?.view.isVisible;
	return isVisible ? pages.filter((p) => isVisible(p.id)) : pages;
}

export function App() {
	const { boardId } = useParams<{ boardId: string }>();
	const location = useLocation();
	const navigate = useNavigate();
	const isCloudBoard = location.pathname.startsWith("/boards/");
	const presentationMode = readPresentationMode(location.search);
	const { user: authUser } = useAuth();

	// 最新の presentation mode を App の外から読むための ref。App を作る effect の依存に
	// 入れると ?present=1 の切替のたびに App が作り直され、undo 履歴や接続が消える。
	// presentation プラグインが popstate で読み直す。
	const modeRef = useRef<PresentationMode>(presentationMode);
	modeRef.current = presentationMode;

	// 「デスクトップを追加」で開かれたか（?desktop=1）。present と同じく App を作り直さない。
	const desktopTemplateRef = useRef<boolean>(readDesktopTemplate(location.search));
	desktopTemplateRef.current = readDesktopTemplate(location.search);

	// react-router の navigate() は pushState なので popstate が起きない。presentation
	// プラグインは popstate で mode を読み直すので、?present= が変わったら自分で起こす。
	// biome-ignore lint/correctness/useExhaustiveDependencies: presentationMode の変化をトリガーとして使用
	useEffect(() => {
		window.dispatchEvent(new PopStateEvent("popstate"));
	}, [presentationMode]);

	// ページを切り替える（URL の ?page= を変える。ボードの接続はそのまま）。
	const switchPage = useCallback(
		(pageId: string) => {
			navigate({ pathname: location.pathname, search: pageSearch(location.search, pageId) });
		},
		[navigate, location.pathname, location.search],
	);
	const switchPageRef = useRef(switchPage);
	switchPageRef.current = switchPage;

	// プレゼン編集モードの stage 矩形（Canvas を縮めて置く）。presentation プラグインに
	// getViewportSize として渡すので ref でも持つ（stage が変わっても App は作り直さない）。
	const stageRectRef = useRef<StageRect | null>(
		presentationMode === "edit"
			? computePresentStage({ width: window.innerWidth, height: window.innerHeight })
			: null,
	);

	const source = useMemo<BoardSource | null>(
		() =>
			boardId
				? {
						boardId,
						persistName: `usketch-board-${boardId}`,
						connect: isCloudBoard,
						migrateLocal: !isCloudBoard,
					}
				: null,
		[boardId, isCloudBoard],
	);

	// クラウドのボードはボードの役割でできることを決める（デモのルール）。手元のボードは何でもできる。
	const permissions = useBoardPermissions({
		boardId: boardId ?? null,
		cloud: isCloudBoard,
		userId: authUser?.id ?? null,
	});

	const {
		app,
		error,
		board,
		pagesState,
		pageId: activePageId,
		lastOpen,
	} = useBoardHost({
		source,
		permissions,
		// 開くページ: URL の ?page= → 前回開いたページ → 先頭ページ。ページ無しのボードは null。
		pickPage: (state) =>
			state.paged && boardId
				? (resolvePageId(visibleOnly(state.pages, permissions), {
						requested: readRequestedPage(location.search),
						lastOpened: readLastPage(boardId),
					}) ?? undefined)
				: null,
		defaultPreset: "whiteboard",
		host: {
			pagesPanel: true,
			pageView: permissions?.view,
			navigate,
			presentation: {
				getMode: () => modeRef.current,
				navigateToBoard: () => {
					if (boardId) navigate(isCloudBoard ? `/boards/${boardId}` : `/local/${boardId}`);
				},
				getViewportSize: () => {
					const stage = stageRectRef.current;
					if (stage) return { width: stage.width, height: stage.height };
					return { width: window.innerWidth, height: window.innerHeight };
				},
			},
		},
		user: {
			id: authUser?.id ?? null,
			name: authUser?.name ?? null,
			image: authUser?.image ?? null,
		},
		switchPage,
		// `?scene3d=hills|many|drive`: 3D レンダラーを比べる場面（#1304 P6c）。
		extraPlugins: () => {
			const search = window.location.search;
			const scene3d = readCompare3dScene(search);
			return scene3d ? [createCompare3dPlugin(scene3d, readRenderer3d(search))] : [];
		},
		onCreated: (created) => {
			// 「デスクトップを追加」で開いたボードはウィンドウシステムを有効にする（冪等）。
			if (desktopTemplateRef.current) getWindowSystemApi(created.services)?.enable();
		},
	});
	// サーバーから「権限が変わった」と届いたら、ページの公開範囲を読み直す。
	useEffect(() => {
		if (!permissions) return;
		return board?.wsProvider?.onPermissionsChanged?.(() => permissions.refresh());
	}, [board, permissions]);
	const appRef = useRef(app);
	appRef.current = app;
	const activePageIdRef = useRef(activePageId);
	activePageIdRef.current = activePageId;

	// 開発用: コンソールからページを作って切り替える。`__usketchPages.init()` で空のボードを
	// ページ形式にする。
	useEffect(() => {
		if (!import.meta.env.DEV || !board) return;
		const w = window as unknown as { __usketchPages?: unknown };
		w.__usketchPages = {
			list: () => listPages(board.rootDoc),
			current: () => activePageIdRef.current ?? null,
			init: (name = "ページ 1") => initPagedBoard(board.rootDoc, { name }),
			create: (name: string) => createPage(board.rootDoc, { name }),
			switchTo: (pageId: string) => switchPageRef.current(pageId),
			loaded: () => board.pageDocs.loadedPageIds(),
			// 最後に開き終えたページと、そこまでの時間（ms）
			lastOpen: () => lastOpen.current,
			store: () => appRef.current?.store ?? null,
			// 開いている App（HUD のレジストリなどを開発中に触るため）
			app: () => appRef.current,
		};
		return () => {
			delete w.__usketchPages;
		};
	}, [board, lastOpen]);

	// ボードの名前（Control HUD のボード情報に出す）
	const [boardName, setBoardName] = useState<string | null>(null);
	useEffect(() => {
		if (!boardId) {
			setBoardName(null);
			return;
		}
		if (!isCloudBoard) {
			const local = localBoards.list().find((b) => b.id === boardId);
			setBoardName(local?.title ?? null);
			return;
		}
		let cancelled = false;
		fetch(`${API_URL}/api/boards/${boardId}`, { credentials: "include", headers: devHeaders() })
			.then((r) => (r.ok ? r.json() : null))
			.then((b) => {
				if (cancelled) return;
				const t = b as { title?: unknown; name?: unknown } | null;
				const name =
					typeof t?.title === "string" ? t.title : typeof t?.name === "string" ? t.name : null;
				setBoardName(name);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [boardId, isCloudBoard]);

	useEffect(() => {
		boardMetaStore.set({ id: boardId, name: boardName, isCloud: isCloudBoard });
	}, [boardId, boardName, isCloudBoard]);

	// ページを離れるときに視点を保存する（不在の人のアバター用）
	const wsProvider = board?.wsProvider ?? null;
	useEffect(() => {
		if (!wsProvider || !boardId) return;
		const saveViewport = () => {
			const local = wsProvider.awareness.getLocalState();
			const vc = local?.viewportCenter as { x: number; y: number } | undefined;
			if (!vc) return;
			fetch(`${API_URL}/api/boards/${boardId}/viewport`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json", ...devHeaders() },
				body: JSON.stringify(vc),
				credentials: "include",
				keepalive: true,
			}).catch(() => {});
		};
		window.addEventListener("beforeunload", saveViewport);
		return () => window.removeEventListener("beforeunload", saveViewport);
	}, [wsProvider, boardId]);

	// ログインが分かったら awareness の名前を入れる
	const authUserId = authUser?.id;
	const authUserName = authUser?.name;
	useEffect(() => {
		if (!wsProvider || !authUserId) return;
		wsProvider.awareness.setLocalStateField("user", { name: authUserName ?? "Anonymous" });
	}, [wsProvider, authUserId, authUserName]);

	// キーボードショートカット。Vim-first でも有効のまま（vim プラグインが capture
	// フェーズでキーを先取りするため衝突せず、Vim 非アクティブ時は通常通り動く）。
	useKeyboardShortcuts(app, presentationMode === "present");

	// 共有ダイアログは App が所有し、Control HUD の「共有」アクションから開く。
	const [showShare, setShowShare] = useState(false);
	const openShare = useCallback(() => setShowShare(true), []);

	// アプリ横断の操作を共有アクションレジストリへ登録。Control HUD の Controls／
	// 検索が単一ソースとして参照する。
	useAppActions(app, boardId, isCloudBoard, openShare);

	// Vim モードは既定 OFF（store の既定ツールは "select"）。Control HUD の
	// "Vim mode" アクションで実行時に切り替える。プレゼン発表へ切替時のみ、vim が
	// 残り続けないよう select に戻す。
	useEffect(() => {
		if (!app) return;
		if (presentationMode === "present") {
			app.store.setDefaultToolId("select");
			app.store.setActiveToolId("select");
		}
	}, [app, presentationMode]);

	// Info タブを SidePanel に登録（Cloud ボードのみ）
	useEffect(() => {
		if (!app || !isCloudBoard || !boardId) return;
		const apiUrl = API_URL;
		app.events.emit("side-panel:register-tab", {
			tab: {
				id: "info",
				label: "情報",
				icon: "📋",
				iconComponent: () => (
					<svg
						width={13}
						height={13}
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden="true"
					>
						<path d="M2 4a1 1 0 0 1 1-1h3l1.5 1.5H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4Z" />
					</svg>
				),
				order: 30,
				render: () => <InfoTab boardId={boardId} apiUrl={apiUrl} />,
			},
		});
		return () => {
			app.events.emit("side-panel:unregister-tab", { tabId: "info" });
		};
	}, [app, boardId, isCloudBoard]);

	const [stageRect, setStageRect] = useState<StageRect | null>(stageRectRef.current);
	stageRectRef.current = stageRect;
	useEffect(() => {
		if (presentationMode !== "edit") {
			setStageRect(null);
			return;
		}
		const update = () =>
			setStageRect(computePresentStage({ width: window.innerWidth, height: window.innerHeight }));
		update();
		window.addEventListener("resize", update);
		return () => window.removeEventListener("resize", update);
	}, [presentationMode]);

	if (error) {
		return (
			<div style={{ padding: "24px", fontFamily: "system-ui, sans-serif", color: "#c33" }}>
				<p>Error: {error}</p>
				<a href="/">トップへ戻る</a>
			</div>
		);
	}

	if (!app) {
		// ページを切り替えている間（ページ doc の読み込みと App の作り直し）だけ表示する。
		if (!pagesState?.paged) return null;
		return (
			<div
				style={{
					position: "fixed",
					inset: 0,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					background: "var(--bg-canvas-2, #0a0a0b)",
					color: "var(--text-muted, #9aa0aa)",
					fontSize: 13,
				}}
			>
				ページを読み込み中…
			</div>
		);
	}

	// 発表モード中、または Vim-first UI では通常の chrome を隠す
	// ツールバーは通常表示。Vim モードは既定 OFF で、Control HUD の "Vim mode"
	// アクションから切り替える（プレゼン発表中のみ chrome を隠す）。
	const hideToolbar = presentationMode === "present";
	// プレゼン編集モード中はスライド編集に関係ない UI を隠す
	const isPresentEdit = presentationMode === "edit";
	// 発表中は Canvas を readonly (シェイプ選択/ドラッグ/描画を全てオフ)
	const isPresenting = presentationMode === "present";

	return (
		<AppProvider app={app}>
			<div
				style={{
					width: "100%",
					height: "100%",
					overflow: "hidden",
					position: "relative",
					background: "var(--bg-canvas-2, #0a0a0b)",
				}}
			>
				{/*
					エディタ全体 (Canvas + 各種オーバーレイ) をひとつの div で包む。
					プレゼン編集モード中は stage 矩形に縮め、外側を発表 UI が取り囲む形にする。
					transform を当てると内側の position: fixed 要素の containing block が
					この div になるため、HUD 等を書き換えずに相対化できる (CSS spec)。
				*/}
				<div
					style={
						stageRect
							? {
									position: "absolute",
									left: stageRect.left,
									top: stageRect.top,
									width: stageRect.width,
									height: stageRect.height,
									borderRadius: 8,
									overflow: "hidden",
									transform: "translate(0, 0)",
									boxShadow: "0 30px 60px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.06)",
									transition:
										"left 180ms var(--ease-out, ease-out), top 180ms var(--ease-out, ease-out), width 180ms var(--ease-out, ease-out), height 180ms var(--ease-out, ease-out)",
								}
							: {
									position: "absolute",
									inset: 0,
								}
					}
				>
					<Canvas />
					{/* TopBar は撤去: ロゴ(→dashboard)/テーマ/プレゼン/コミュニティは全て
					    Control HUD の action(nav:dashboard / theme:* / edit:present /
					    nav:community)に一本化済み。HUD は `` ` `` で開く（bottom-center に
					    常時ヒントあり）。 */}
					{!hideToolbar && isCloudBoard && !isPresentEdit && <CopilotPill />}
				</div>
				{/* 閉じタグ: エディタ全体ラッパーの終わり */}
				{showShare && boardId && (
					<ShareDialog boardId={boardId} onClose={() => setShowShare(false)} store={app?.store} />
				)}
			</div>
			{isPresenting &&
				createPortal(
					<div
						aria-hidden="true"
						style={{
							position: "fixed",
							inset: 0,
							zIndex: 300,
							cursor: "default",
							background: "transparent",
						}}
						onPointerDown={(e) => {
							e.stopPropagation();
							e.preventDefault();
						}}
						onPointerMove={(e) => e.stopPropagation()}
						onPointerUp={(e) => e.stopPropagation()}
						onWheel={(e) => e.stopPropagation()}
						onContextMenu={(e) => {
							e.stopPropagation();
							e.preventDefault();
						}}
					/>,
					document.body,
				)}
		</AppProvider>
	);
}
