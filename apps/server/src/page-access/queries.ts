/**
 * ページの公開範囲（`page_access` / `page_members`）とボードの役割を D1 から読む。
 * REST（`routes.ts`）と BoardRoom（DO）が同じ読み方をする。
 */
import type {
	DemoBoardRole,
	DemoPageAccess,
	PageMemberRole,
} from "@edv4h/usketch-demo-permissions";
import { and, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { boardMembers, boards, communityBoards, pageAccess, pageMembers } from "../db/schema.js";

// どの drizzle（スキーマ付き・無し）でも使えるように、使う形だけにする。
type Db = DrizzleD1Database<Record<string, unknown>>;

/** ボードと見ている人の関係。 */
export interface BoardViewer {
	boardRole: DemoBoardRole | null;
	boardPublic: boolean;
}

function asRole(role: unknown): DemoBoardRole | null {
	return role === "owner" || role === "editor" || role === "viewer" ? role : null;
}

/**
 * ボードでの役割と公開ボードか。ボードが無い・見られない（非公開でメンバーでない）なら null。
 * コミュニティボードは誰でも編集できるので editor にする（WebSocket の接続と同じ扱い）。
 */
export async function loadBoardViewer(
	db: Db,
	boardId: string,
	userId: string,
): Promise<BoardViewer | null> {
	const [row] = await db
		.select({ isPublic: boards.isPublic, role: boardMembers.role })
		.from(boards)
		.leftJoin(
			boardMembers,
			and(eq(boards.id, boardMembers.boardId), eq(boardMembers.userId, userId)),
		)
		.where(eq(boards.id, boardId))
		.limit(1);
	if (!row) return null;
	let boardRole = asRole(row.role);
	if (!boardRole) {
		const [community] = await db
			.select({ boardId: communityBoards.boardId })
			.from(communityBoards)
			.where(eq(communityBoards.boardId, boardId))
			.limit(1);
		if (community) boardRole = "editor";
	}
	if (!boardRole && !row.isPublic) return null;
	return { boardRole, boardPublic: !!row.isPublic };
}

/** ボードの全ページの公開範囲（行の無いページは入らない = 既定の扱い）。 */
export async function loadPageAccess(
	db: Db,
	boardId: string,
): Promise<Map<string, DemoPageAccess>> {
	const [rows, members] = await Promise.all([
		db.select().from(pageAccess).where(eq(pageAccess.boardId, boardId)),
		db.select().from(pageMembers).where(eq(pageMembers.boardId, boardId)),
	]);
	const result = new Map<string, DemoPageAccess>();
	for (const row of rows) {
		result.set(row.pageId, {
			ownerId: row.ownerId ?? null,
			visibility: row.visibility,
			edit: row.edit,
		});
	}
	for (const member of members) {
		const access = result.get(member.pageId);
		// 公開範囲の行が無いページへの招待は意味が無い（既定の扱いのまま）ので読まない
		if (!access) continue;
		access.members = {
			...access.members,
			[member.userId]: member.role as PageMemberRole,
		};
	}
	return result;
}
