import { AppProvider, Canvas } from "@edv4h/usketch-canvas-engine";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { API_URL, type BoardSource, presetPlugins, useBoardHost } from "../../board-host/index.js";
import { boardMetaStore } from "../../lib/board-meta-store.js";
import { getErrorMessage } from "../../lib/errors.js";
import { useAuth } from "../../lib/use-auth.js";
import { useCommunityActions } from "../../lib/use-community-actions.js";
import { useKeyboardShortcuts } from "../../lib/use-keyboard-shortcuts.js";
import { CommunityHeader } from "./community-header.js";
import { ensureRegionTerrain } from "./community-terrain.js";

const MAP = presetPlugins("map");

/** `/community/:slug` の地域。地域のボードを map プリセットで開く（ページを使うボードは先頭ページ）。 */
export function CommunityPage() {
	const { slug } = useParams<{ slug: string }>();
	const navigate = useNavigate();
	const { user: authUser } = useAuth();
	const authUserId = authUser?.id ?? null;
	const [region, setRegion] = useState<{ boardId: string; name: string } | null>(null);
	const [lookupError, setLookupError] = useState<string | null>(null);

	// slug → 地域のボード
	useEffect(() => {
		if (!slug) return;
		let cancelled = false;
		setRegion(null);
		fetch(`${API_URL}/api/community-boards/${slug}`)
			.then(async (res) => {
				if (!res.ok) throw new Error("Community board not found");
				const data = (await res.json()) as { boardId: string; displayName: string };
				if (!cancelled) setRegion({ boardId: data.boardId, name: data.displayName });
			})
			.catch((e) => {
				if (!cancelled) setLookupError(getErrorMessage(e, "Failed to initialize community"));
			});
		return () => {
			cancelled = true;
		};
	}, [slug]);

	const regionBoardId = region?.boardId ?? null;
	const source = useMemo<BoardSource | null>(
		() =>
			regionBoardId
				? {
						boardId: regionBoardId,
						// ルートの保存先は、ルートの shapes だけを見ていた頃と同じ名前（手元の保存を引き継ぐ）。
						persistName: `usketch-community-${regionBoardId}`,
						// ログインしている人だけがつなぐ。
						connect: authUserId !== null,
					}
				: null,
		[regionBoardId, authUserId],
	);

	const { app, error } = useBoardHost({
		source,
		// ページを使うボード（マルチページ移行後）は先頭ページ。
		pickPage: (state) => (state.paged ? (state.pages[0]?.id ?? undefined) : null),
		plugins: MAP,
		host: { navigate },
		user: { id: authUserId, name: authUser?.name ?? null, image: authUser?.image ?? null },
		switchPage: () => {},
		onCreated: (created, wiring) => {
			// 標高マップの地域なら、ボードに場が無いときだけ無限地形を置く。つないでいる人は
			// ページ doc を開けてから（サーバーの中身を読んでから）にする。移行前のルートに置くと、
			// サーバーが 1 枚目へ移すときに誰かが変えた地形を上書きしかねないため。
			if (slug && (!wiring.board.wsProvider || wiring.pageId)) {
				ensureRegionTerrain(created.store, slug);
			}
		},
	});

	useEffect(() => {
		if (!region) return;
		boardMetaStore.set({ id: region.boardId, name: region.name, isCloud: true });
	}, [region]);

	const regionName = region?.name ?? "";

	// キーボードショートカット
	useKeyboardShortcuts(app);
	// 横断アクションを Control HUD に登録（旧ヘッダー右ボタン群の代替）
	useCommunityActions(app, !!authUserId);

	const shownError = lookupError ?? error;
	if (shownError) {
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
				<p>Error: {shownError}</p>
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
