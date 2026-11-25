import type { HonoEnv, ServerPlugin } from "@edv4h/usketch-server-core";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import type { SQLiteTableWithColumns } from "drizzle-orm/sqlite-core";
import { Hono } from "hono";
import { z } from "zod";

/** comments プラグインが必要とするスキーマテーブル */
export interface CommentsPluginSchema {
	boards: SQLiteTableWithColumns<any>;
	boardMembers: SQLiteTableWithColumns<any>;
	comments: SQLiteTableWithColumns<any>;
	commentMessages: SQLiteTableWithColumns<any>;
}

type CommentsEnv = {
	Bindings: HonoEnv["Bindings"];
	Variables: {
		db: NonNullable<HonoEnv["Variables"]["db"]>;
		userId: NonNullable<HonoEnv["Variables"]["userId"]>;
		boardId: string;
	};
};

/** ページを見られるか（`pageId` が null のスレッドはページを持たない）。 */
export type CommentPageFilter = (pageId: string | null) => boolean;

export interface CommentsPluginOptions {
	/**
	 * ページごとに見られる人を絞るボードで、見ている人が見られるページを返す。見られないページの
	 * スレッドは一覧に出さず、作る・返信する・解決する・消すこともできない（404）。省略すると
	 * ボードを見られる人は全部のスレッドを見られる。
	 */
	pageFilter?: (args: {
		db: CommentsEnv["Variables"]["db"];
		boardId: string;
		userId: string;
	}) => Promise<CommentPageFilter>;
}

export function createCommentsPlugin(
	schema: CommentsPluginSchema,
	options: CommentsPluginOptions = {},
): ServerPlugin {
	const { boards, boardMembers, comments, commentMessages } = schema;
	// マルチページ: comments テーブルに page_id 列があるときだけ記録する（無いスキーマも動く）
	const hasPageColumn = "pageId" in comments;

	/** 見ている人が見られるページ（絞らないボードは全部）。 */
	async function pageFilterOf(
		db: CommentsEnv["Variables"]["db"],
		boardId: string,
		userId: string,
	): Promise<CommentPageFilter> {
		if (!options.pageFilter || !hasPageColumn) return () => true;
		return options.pageFilter({ db, boardId, userId });
	}

	/** スレッドがあり、そのページを見られるか。 */
	async function findVisibleThread(
		db: CommentsEnv["Variables"]["db"],
		boardId: string,
		userId: string,
		commentId: string,
	): Promise<{ createdBy: string } | null> {
		const [thread] = await db
			.select({
				createdBy: comments.createdBy,
				...(hasPageColumn ? { pageId: comments.pageId } : {}),
			})
			.from(comments)
			.where(and(eq(comments.id, commentId), eq(comments.boardId, boardId)))
			.limit(1);
		if (!thread) return null;
		const canView = await pageFilterOf(db, boardId, userId);
		return canView((thread as { pageId?: string | null }).pageId ?? null) ? thread : null;
	}

	/** ボードのメンバーかパブリックボードであればアクセス許可 */
	async function assertBoardAccess(db: any, boardId: string, userId: string): Promise<boolean> {
		const result = await db
			.select({ isPublic: boards.isPublic, role: boardMembers.role })
			.from(boards)
			.leftJoin(
				boardMembers,
				and(eq(boards.id, boardMembers.boardId), eq(boardMembers.userId, userId)),
			)
			.where(eq(boards.id, boardId))
			.limit(1);
		if (result.length === 0) return false;
		return result[0].role !== null || !!result[0].isPublic;
	}

	return {
		id: "server-comments",
		name: "コメント",
		setup(ctx) {
			const commentsApp = new Hono<CommentsEnv>();

			// boardIdを親ルートから抽出してVariablesにセット
			commentsApp.use("*", async (c, next) => {
				const boardId = c.req.param("boardId");
				if (!boardId) return c.json({ error: "Board ID required" }, 400);
				c.set("boardId", boardId);
				await next();
			});

			// GET /api/boards/:boardId/comments — スレッド一覧（メッセージ含む）
			commentsApp.get("/", async (c) => {
				const db = c.get("db");
				const userId = c.get("userId");
				const boardId = c.get("boardId");

				if (!(await assertBoardAccess(db, boardId, userId))) {
					return c.json({ error: "Board not found" }, 404);
				}

				const threads = await db
					.select()
					.from(comments)
					.where(eq(comments.boardId, boardId))
					.orderBy(desc(comments.createdAt));

				const canView = await pageFilterOf(db, boardId, userId);
				const visible = threads.filter((t: any) => canView(t.pageId ?? null));
				if (visible.length === 0) return c.json([]);

				// D1ではIN句が制限されるため、スレッドごとにメッセージを並列取得
				const messageResults = await Promise.all(
					visible.map((t: any) =>
						db
							.select()
							.from(commentMessages)
							.where(eq(commentMessages.commentId, t.id))
							.orderBy(commentMessages.createdAt),
					),
				);
				const allMessages = messageResults.flat();

				const messagesByThread = new Map<string, (typeof allMessages)[number][]>();
				for (const msg of allMessages) {
					const arr = messagesByThread.get(msg.commentId) ?? [];
					arr.push(msg);
					messagesByThread.set(msg.commentId, arr);
				}

				return c.json(
					visible.map((t: any) => ({
						...t,
						messages: messagesByThread.get(t.id) ?? [],
					})),
				);
			});

			const createThreadSchema = z.object({
				anchorShapeId: z.string().min(1),
				anchorX: z.number().optional(),
				anchorY: z.number().optional(),
				text: z.string().min(1).max(2000),
				/** マルチページ: コメントしたシェイプのあるページ。 */
				pageId: z
					.string()
					.regex(/^[A-Za-z0-9_-]{1,64}$/)
					.optional(),
			});

			// POST /api/boards/:boardId/comments — スレッド作成（初期メッセージ付き）
			commentsApp.post("/", zValidator("json", createThreadSchema), async (c) => {
				const db = c.get("db");
				const userId = c.get("userId");
				const boardId = c.get("boardId");
				const body = c.req.valid("json");

				if (!(await assertBoardAccess(db, boardId, userId))) {
					return c.json({ error: "Board not found" }, 404);
				}
				if (!(await pageFilterOf(db, boardId, userId))(body.pageId ?? null)) {
					return c.json({ error: "Page not found" }, 404);
				}

				const threadId = crypto.randomUUID();
				const messageId = crypto.randomUUID();
				const now = new Date().toISOString();

				await db.batch([
					db.insert(comments).values({
						id: threadId,
						boardId,
						anchorShapeId: body.anchorShapeId,
						...(hasPageColumn ? { pageId: body.pageId ?? null } : {}),
						anchorX: body.anchorX ?? 0,
						anchorY: body.anchorY ?? 0,
						createdBy: userId,
						createdAt: now,
						updatedAt: now,
					}),
					db.insert(commentMessages).values({
						id: messageId,
						commentId: threadId,
						authorId: userId,
						text: body.text,
						createdAt: now,
					}),
				]);

				return c.json(
					{
						id: threadId,
						boardId,
						anchorShapeId: body.anchorShapeId,
						pageId: hasPageColumn ? (body.pageId ?? null) : null,
						anchorX: body.anchorX ?? 0,
						anchorY: body.anchorY ?? 0,
						resolved: 0,
						createdBy: userId,
						createdAt: now,
						updatedAt: now,
						messages: [
							{
								id: messageId,
								commentId: threadId,
								authorId: userId,
								text: body.text,
								createdAt: now,
							},
						],
					},
					201,
				);
			});

			const addMessageSchema = z.object({
				text: z.string().min(1).max(2000),
			});

			// POST /api/boards/:boardId/comments/:commentId/messages — メッセージ追加
			commentsApp.post("/:commentId/messages", zValidator("json", addMessageSchema), async (c) => {
				const db = c.get("db");
				const userId = c.get("userId");
				const boardId = c.get("boardId");
				const commentId = c.req.param("commentId");
				const body = c.req.valid("json");

				if (!(await assertBoardAccess(db, boardId, userId))) {
					return c.json({ error: "Board not found" }, 404);
				}

				// スレッドの存在確認（見られないページのスレッドは無いものとする）
				if (!(await findVisibleThread(db, boardId, userId, commentId))) {
					return c.json({ error: "Comment thread not found" }, 404);
				}

				const messageId = crypto.randomUUID();
				const now = new Date().toISOString();

				await db.batch([
					db.insert(commentMessages).values({
						id: messageId,
						commentId,
						authorId: userId,
						text: body.text,
						createdAt: now,
					}),
					db.update(comments).set({ updatedAt: now }).where(eq(comments.id, commentId)),
				]);

				return c.json(
					{
						id: messageId,
						commentId,
						authorId: userId,
						text: body.text,
						createdAt: now,
					},
					201,
				);
			});

			const resolveSchema = z.object({
				resolved: z.boolean(),
			});

			// PATCH /api/boards/:boardId/comments/:commentId — 解決/未解決切替
			commentsApp.patch("/:commentId", zValidator("json", resolveSchema), async (c) => {
				const db = c.get("db");
				const userId = c.get("userId");
				const boardId = c.get("boardId");
				const commentId = c.req.param("commentId");
				const body = c.req.valid("json");

				if (!(await assertBoardAccess(db, boardId, userId))) {
					return c.json({ error: "Board not found" }, 404);
				}

				if (!(await findVisibleThread(db, boardId, userId, commentId))) {
					return c.json({ error: "Comment thread not found" }, 404);
				}

				await db
					.update(comments)
					.set({ resolved: body.resolved ? 1 : 0, updatedAt: new Date().toISOString() })
					.where(eq(comments.id, commentId));

				return c.json({ ok: true });
			});

			// DELETE /api/boards/:boardId/comments/:commentId — スレッド削除
			commentsApp.delete("/:commentId", async (c) => {
				const db = c.get("db");
				const userId = c.get("userId");
				const boardId = c.get("boardId");
				const commentId = c.req.param("commentId");

				if (!(await assertBoardAccess(db, boardId, userId))) {
					return c.json({ error: "Board not found" }, 404);
				}

				// 作成者のみ削除可能
				const thread = await findVisibleThread(db, boardId, userId, commentId);
				if (!thread) {
					return c.json({ error: "Comment thread not found" }, 404);
				}

				if (thread.createdBy !== userId) {
					return c.json({ error: "Forbidden" }, 403);
				}

				await db.delete(comments).where(eq(comments.id, commentId));

				return c.json({ ok: true });
			});

			ctx.routes.register({ path: "/api/boards/:boardId/comments", app: commentsApp as any });
		},
	};
}
