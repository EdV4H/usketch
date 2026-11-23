/**
 * デモアプリ（apps/web と apps/server）の権限のルール。CASL で書き、サーバーもブラウザも同じ
 * ルールで判定する（サーバーが作ってブラウザへ送る。R4 までは、ブラウザがボードの役割から作る）。
 *
 * - ボードの役割（`board_members.role`）: owner / editor / viewer。ボードの owner は何でもできる。
 * - ページの公開範囲（`visibility`）: public（ログインなしでも見える）/ members（ボードのメンバー）/
 *   private（作った人と招いた人だけ）。
 * - ページの編集範囲（`edit`）: owner-only（作った人）/ invited（作った人と招いた editor）/
 *   members（ボードの editor 以上と招いた editor）。
 * - ページを作った人（`ownerId`）はそのページを見る・編集する・管理する（名前・削除・プラグイン）。
 *   作った人の分からないページは、ボードの editor 以上が管理する。
 *
 * ページの公開範囲などは、聞くときの resource（{@link pageResource}）に入れて渡す。
 */
import type { UsketchRawRule } from "@edv4h/usketch-permissions-casl";
import type { PermissionResource } from "@edv4h/usketch-shared";

export type DemoBoardRole = "owner" | "editor" | "viewer";
export type PageVisibility = "public" | "members" | "private";
export type PageEditPolicy = "owner-only" | "invited" | "members";
export type PageMemberRole = "editor" | "viewer";

/** ページの公開範囲と編集範囲。 */
export interface DemoPageAccess {
	/** ページを作った人。 */
	ownerId?: string | null;
	visibility: PageVisibility;
	edit: PageEditPolicy;
	/** 個別に招いた人（userId → 役割）。 */
	members?: Readonly<Record<string, PageMemberRole>>;
}

/** 誰が見ているか。 */
export interface DemoViewer {
	/** ログインしていなければ null。 */
	userId: string | null;
	/** このボードでの役割。メンバーでなければ null。 */
	boardRole: DemoBoardRole | null;
}

/**
 * 公開範囲を決めていないページ（今のページは全部これ）の扱い: ボードのメンバーが見て、
 * editor 以上が編集する。公開ボードでは誰でも見られる（今のボードと同じ）。
 */
export function defaultPageAccess(boardPublic: boolean): DemoPageAccess {
	return { visibility: boardPublic ? "public" : "members", edit: "members" };
}

/** 権限を聞くときの resource（ページの id と公開範囲）。 */
export function pageResource(
	ids: { boardId?: string; pageId?: string | null },
	access: DemoPageAccess,
): PermissionResource {
	return {
		...(ids.boardId ? { boardId: ids.boardId } : {}),
		...(ids.pageId ? { pageId: ids.pageId } : {}),
		...access,
	};
}

const SHARED_VISIBILITY = { $in: ["public", "members"] };

/** この人のルール（CASL の生のルール）。 */
export function defineDemoRules(viewer: DemoViewer): UsketchRawRule[] {
	const { userId, boardRole } = viewer;
	if (boardRole === "owner") return [{ action: "manage", subject: "all" }];

	const rules: UsketchRawRule[] = [
		// 公開ページは誰でも見られる。
		{ action: "view", subject: "page", conditions: { visibility: "public" } },
	];
	if (boardRole) {
		rules.push({ action: "view", subject: "page", conditions: { visibility: "members" } });
	}
	if (boardRole === "editor") {
		rules.push(
			{
				action: "edit",
				subject: "page",
				conditions: { edit: "members", visibility: SHARED_VISIBILITY },
			},
			{ action: "create", subject: "page" },
			// 作った人の分からないページ（公開範囲を決める前からあるページ）は editor が管理する。
			{
				action: "manage",
				subject: "page",
				conditions: { ownerId: null, visibility: SHARED_VISIBILITY },
			},
		);
	}
	if (userId) {
		const invited = `members.${userId}`;
		rules.push(
			// 作った人。
			{ action: ["view", "edit", "manage"], subject: "page", conditions: { ownerId: userId } },
			// 招かれた人。
			{ action: "view", subject: "page", conditions: { [invited]: { $in: ["editor", "viewer"] } } },
			{
				action: "edit",
				subject: "page",
				conditions: { [invited]: "editor", edit: { $in: ["invited", "members"] } },
			},
		);
	}
	return rules;
}
