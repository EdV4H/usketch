/**
 * 接続ごとの権限。Worker（`server-boards` の `/api/boards/:id/ws`）がボードの役割と公開ボードかを
 * 確かめて DO への URL に付け（クライアントが付けた値は上書きする）、DO はそれを接続の attachment に
 * 持つ（休眠しても消えない）。書き込み・購読のたびに、デモのルール（CASL）で聞く。
 *
 * ページの公開範囲（`page_access` の行）は呼ぶ側が渡す。行の無いページは {@link defaultPageAccess}
 * （メンバーが見る・editor 以上が編集する・公開ボードは誰でも見る）で聞く。
 */

import {
	type DemoBoardRole,
	type DemoPageAccess,
	defaultPageAccess,
	defineDemoRules,
	pageResource,
} from "@edv4h/usketch-demo-permissions";
import { createCaslSnapshot } from "@edv4h/usketch-permissions-casl";
import { PERMISSIONS } from "@edv4h/usketch-shared";

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

/** ページの公開範囲（`page_access` の行。無ければ null）。 */
export type PageAccessLookup = DemoPageAccess | null | undefined;

/** ある人の判定（WebSocket の接続にも、DO への HTTP の呼び出しにも使う）。 */
export interface AccessJudge {
	readonly access: SocketAccess;
	/**
	 * ページを見られるか。`page` はそのページの公開範囲。`pageId` が null はページを使わない
	 * ボード（既定の公開範囲で聞く）。
	 */
	canView(pageId: string | null, page?: PageAccessLookup): boolean;
	/** ページに書けるか。 */
	canEdit(pageId: string | null, page?: PageAccessLookup): boolean;
	/** ページの名前・並び・削除・プラグインを変えられるか。 */
	canManage(pageId: string | null, page?: PageAccessLookup): boolean;
	/** ページを足せるか。 */
	canCreate(): boolean;
	/**
	 * ルート doc に書けるか。ルート doc はページの一覧と、ページを使わないボードの shapes を持つので、
	 * 「既定の公開範囲のページを編集できる」人（ボードの editor 以上）だけが書ける。
	 */
	canEditRoot(): boolean;
}

/** 人とボードの関係から判定を作る。 */
export function judgeAccess(access: SocketAccess): AccessJudge {
	const { can } = createCaslSnapshot(
		defineDemoRules({ userId: access.userId, boardRole: access.boardRole }),
	);
	const pageOf = (pageId: string | null, page?: PageAccessLookup) =>
		pageResource(
			{ boardId: access.boardId, pageId },
			page ?? defaultPageAccess(access.boardPublic),
		);
	return {
		access,
		canView: (pageId, page) => can(PERMISSIONS.pageView, pageOf(pageId, page)),
		canEdit: (pageId, page) => can(PERMISSIONS.pageEdit, pageOf(pageId, page)),
		canManage: (pageId, page) => can(PERMISSIONS.pageManage, pageOf(pageId, page)),
		canCreate: () => can(PERMISSIONS.pageCreate, { boardId: access.boardId }),
		canEditRoot: () => can(PERMISSIONS.pageEdit, pageOf(null)),
	};
}

// 接続ごとの判定（ルールを作り直さないため）。休眠から戻ると空になり、attachment から作り直す。
const snapshots = new WeakMap<AccessSocket, AccessJudge | null>();

/** 接続の判定。記録が無い接続は null（何もできない）。 */
export function judgeSocket(ws: AccessSocket): AccessJudge | null {
	if (snapshots.has(ws)) return snapshots.get(ws) ?? null;
	const access = getSocketAccess(ws);
	const judge = access ? judgeAccess(access) : null;
	snapshots.set(ws, judge);
	return judge;
}

/** 接続がつながっているボード（記録が無ければ null）。 */
export function socketBoardId(ws: AccessSocket): string | null {
	return judgeSocket(ws)?.access.boardId ?? null;
}

/** ページ doc を購読できるか（見る権限）。`page` はそのページの公開範囲。 */
export function canViewPage(ws: AccessSocket, pageId: string, page?: PageAccessLookup): boolean {
	return judgeSocket(ws)?.canView(pageId, page) ?? false;
}

/** ページ doc に書けるか（編集の権限）。`page` はそのページの公開範囲。 */
export function canEditPage(ws: AccessSocket, pageId: string, page?: PageAccessLookup): boolean {
	return judgeSocket(ws)?.canEdit(pageId, page) ?? false;
}

/** ページを足せるか。 */
export function canCreatePage(ws: AccessSocket): boolean {
	return judgeSocket(ws)?.canCreate() ?? false;
}

/** ページの名前・並び・削除・プラグインを変えられるか。`page` はそのページの公開範囲。 */
export function canManagePage(ws: AccessSocket, pageId: string, page?: PageAccessLookup): boolean {
	return judgeSocket(ws)?.canManage(pageId, page) ?? false;
}

/** ルート doc に書けるか（{@link AccessJudge.canEditRoot}）。 */
export function canEditRoot(ws: AccessSocket): boolean {
	return judgeSocket(ws)?.canEditRoot() ?? false;
}
