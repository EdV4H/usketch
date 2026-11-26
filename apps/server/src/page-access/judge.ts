/**
 * デモのルール（CASL）で、ある人がボードのページを見られる・管理できるかを聞く。
 * REST（`routes.ts`）とコメント（`server-comments` の `pageFilter`）が使う。
 */
import {
	type DemoPageAccess,
	defaultPageAccess,
	defineDemoRules,
	pageResource,
} from "@edv4h/usketch-demo-permissions";
import { createCaslSnapshot } from "@edv4h/usketch-permissions-casl";
import { PERMISSIONS, type Permission } from "@edv4h/usketch-shared";
import { type BoardViewer, loadBoardViewer, loadPageAccess } from "./queries.js";

type Db = Parameters<typeof loadPageAccess>[0];

/** 見ている人の判定。`access` を省いたページは既定の扱い。 */
export function judgePages(boardId: string, userId: string | null, viewer: BoardViewer) {
	const { can } = createCaslSnapshot(defineDemoRules({ userId, boardRole: viewer.boardRole }));
	return (permission: Permission, pageId: string, access: DemoPageAccess | undefined) =>
		can(
			permission,
			pageResource({ boardId, pageId }, access ?? defaultPageAccess(viewer.boardPublic)),
		);
}

/**
 * 見ている人が見られるページ（`pageId` が null はページを持たないもので、ボードを見られれば見られる）。
 * ボードを見られなければ何も見られない。
 */
export async function loadPageViewFilter(
	db: Db,
	boardId: string,
	userId: string,
): Promise<(pageId: string | null) => boolean> {
	const viewer = await loadBoardViewer(db, boardId, userId);
	if (!viewer) return () => false;
	const pages = await loadPageAccess(db, boardId);
	const can = judgePages(boardId, userId, viewer);
	return (pageId) => pageId === null || can(PERMISSIONS.pageView, pageId, pages.get(pageId));
}
