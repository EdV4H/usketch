/**
 * 接続ごとの権限。Worker（`server-boards` の `/api/boards/:id/ws`）がボードの役割と公開ボードかを
 * 確かめて DO への URL に付け（クライアントが付けた値は上書きする）、DO はそれを接続の attachment に
 * 持つ（休眠しても消えない）。書き込み・購読のたびに、デモのルール（CASL）で聞く。
 *
 * ページごとの公開範囲（`page_access`）はまだ無いので、どのページも {@link defaultPageAccess}
 * （メンバーが見る・editor 以上が編集する・公開ボードは誰でも見る）で聞く。
 */

import {
	type DemoBoardRole,
	defaultPageAccess,
	defineDemoRules,
	pageResource,
} from "@edv4h/usketch-demo-permissions";
import { createCaslSnapshot } from "@edv4h/usketch-permissions-casl";
import { PERMISSIONS, type PermissionSnapshot } from "@edv4h/usketch-shared";

/** Worker が DO への URL に付けるパラメーターの名前。 */
export const ACCESS_PARAMS = {
	/** ボードの役割（owner / editor / viewer）。メンバーでなければ付けない。 */
	role: "role",
	/** 公開ボードなら "1"。 */
	boardPublic: "boardPublic",
} as const;

/** 接続した人とボードの関係。 */
export interface SocketAccess {
	/** ログインしていなければ null。 */
	userId: string | null;
	boardId: string;
	boardRole: DemoBoardRole | null;
	boardPublic: boolean;
}

const ROLES: readonly DemoBoardRole[] = ["owner", "editor", "viewer"];

function isRole(value: unknown): value is DemoBoardRole {
	return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** DO への URL から接続の権限を読む。 */
export function readAccessParams(url: URL, boardId: string): SocketAccess {
	const userId = url.searchParams.get("userId");
	const role = url.searchParams.get(ACCESS_PARAMS.role);
	return {
		userId: userId && userId !== "anonymous" ? userId : null,
		boardId,
		boardRole: isRole(role) ? role : null,
		boardPublic: url.searchParams.get(ACCESS_PARAMS.boardPublic) === "1",
	};
}

/** 使う WebSocket の機能だけ（テストで差し替えられるように）。 */
export type AccessSocket = Pick<WebSocket, "serializeAttachment" | "deserializeAttachment">;

function readAttachment(ws: AccessSocket): Record<string, unknown> {
	try {
		const value = ws.deserializeAttachment() as unknown;
		return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
	} catch {
		return {};
	}
}

/** 接続の attachment に権限を置く（ページ doc の購読と同じ attachment に並べる）。 */
export function setSocketAccess(ws: AccessSocket, access: SocketAccess): void {
	ws.serializeAttachment({ ...readAttachment(ws), access });
	snapshots.delete(ws);
}

/** 接続の権限。記録が無い接続（壊れた attachment など）は何もできない。 */
export function getSocketAccess(ws: AccessSocket): SocketAccess | null {
	const access = readAttachment(ws).access as Partial<SocketAccess> | undefined;
	if (!access || typeof access !== "object" || typeof access.boardId !== "string") return null;
	return {
		userId: typeof access.userId === "string" ? access.userId : null,
		boardId: access.boardId,
		boardRole: isRole(access.boardRole) ? access.boardRole : null,
		boardPublic: access.boardPublic === true,
	};
}

interface AccessSnapshot {
	access: SocketAccess;
	can: PermissionSnapshot["can"];
}

// 接続ごとの判定（ルールを作り直さないため）。休眠から戻ると空になり、attachment から作り直す。
const snapshots = new WeakMap<AccessSocket, AccessSnapshot | null>();

function snapshotOf(ws: AccessSocket): AccessSnapshot | null {
	if (snapshots.has(ws)) return snapshots.get(ws) ?? null;
	const access = getSocketAccess(ws);
	const snapshot = access
		? {
				access,
				can: createCaslSnapshot(
					defineDemoRules({ userId: access.userId, boardRole: access.boardRole }),
				).can,
			}
		: null;
	snapshots.set(ws, snapshot);
	return snapshot;
}

function pageOf(access: SocketAccess, pageId: string | null) {
	return pageResource({ boardId: access.boardId, pageId }, defaultPageAccess(access.boardPublic));
}

/** ページ doc を購読できるか（見る権限）。 */
export function canViewPage(ws: AccessSocket, pageId: string): boolean {
	const s = snapshotOf(ws);
	return !!s && s.can(PERMISSIONS.pageView, pageOf(s.access, pageId));
}

/** ページ doc に書けるか（編集の権限）。 */
export function canEditPage(ws: AccessSocket, pageId: string): boolean {
	const s = snapshotOf(ws);
	return !!s && s.can(PERMISSIONS.pageEdit, pageOf(s.access, pageId));
}

/**
 * ルート doc に書けるか。ルート doc はページの一覧と、ページを使わないボードの shapes を持つので、
 * 「既定の公開範囲のページを編集できる」人（ボードの editor 以上）だけが書ける。
 */
export function canEditRoot(ws: AccessSocket): boolean {
	const s = snapshotOf(ws);
	return !!s && s.can(PERMISSIONS.pageEdit, pageOf(s.access, null));
}
