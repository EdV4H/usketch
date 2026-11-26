import type { HonoEnv, ServerPlugin } from "@edv4h/usketch-server-core";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, isNull, lt, or, type SQL } from "drizzle-orm";
import type { SQLiteTableWithColumns } from "drizzle-orm/sqlite-core";
import { Hono } from "hono";
import { z } from "zod";

/** chat プラグインが必要とするスキーマテーブル */
export interface ChatPluginSchema {
	boards: SQLiteTableWithColumns<any>;
	boardMembers: SQLiteTableWithColumns<any>;
	chatMessages: SQLiteTableWithColumns<any>;
}

type ChatEnv = {
	Bindings: HonoEnv["Bindings"];
	Variables: {
		db: NonNullable<HonoEnv["Variables"]["db"]>;
		userId: NonNullable<HonoEnv["Variables"]["userId"]>;
		boardId: string;
	};
};

/** ページを見られるか。 */
export type ChatPageFilter = (pageId: string) => boolean;

export interface ChatPluginOptions {
	/**
	 * ページごとに見られる人を絞るボードで、見ている人が見られるページを返す。見られないページの
	 * メッセージは読めず、書けない（404）。省略するとボードを見られる人は全部のページを見られる。
	 */
	pageFilter?: (args: {
		db: ChatEnv["Variables"]["db"];
		boardId: string;
		userId: string;
	}) => Promise<ChatPageFilter>;
}

/** ページの id として使える値（`@edv4h/usketch-sync` の doc id と同じ形）。 */
const PAGE_ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export function createChatPlugin(
	schema: ChatPluginSchema,
	options: ChatPluginOptions = {},
): ServerPlugin {
	const { boards, boardMembers, chatMessages } = schema;
	// マルチページ: chat_messages に page_id 列があるときだけページで分ける（無いスキーマも動く）
	const hasPageColumn = "pageId" in chatMessages;

	/** ページを指定したとき、見ている人がそのページを見られるか。 */
	async function canViewPage(
		db: ChatEnv["Variables"]["db"],
		boardId: string,
		userId: string,
		pageId: string | undefined,
	): Promise<boolean> {
		if (!pageId || !hasPageColumn || !options.pageFilter) return true;
		const canView = await options.pageFilter({ db, boardId, userId });
		return canView(pageId);
	}

	/** ページの条件。ページを指定しなければページの無いメッセージ（ページを使う前のもの）。 */
	function pageCondition(pageId: string | undefined, includeUnpaged: boolean): SQL | undefined {
		if (!hasPageColumn) return undefined;
		if (!pageId) return isNull(chatMessages.pageId);
		return includeUnpaged
			? or(eq(chatMessages.pageId, pageId), isNull(chatMessages.pageId))
			: eq(chatMessages.pageId, pageId);
	}

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
		id: "server-chat",
		name: "チャット",
		setup(ctx) {
			const chatApp = new Hono<ChatEnv>();

			chatApp.use("*", async (c, next) => {
				const boardId = c.req.param("boardId");
				if (!boardId) return c.json({ error: "Board ID required" }, 400);
				c.set("boardId", boardId);
				await next();
			});

			const listSchema = z.object({
				limit: z.coerce.number().int().min(1).max(100).default(50),
				before: z.string().optional(),
				threadId: z.string().default("default"),
				/** 今のページ。省略するとページの無いメッセージ。 */
				pageId: PAGE_ID.optional(),
				/** `1` ならページの無いメッセージも含める（ページを使う前のボードの 1 枚目）。 */
				includeUnpaged: z.enum(["1"]).optional(),
			});

			// GET /api/boards/:boardId/chat — メッセージ一覧（スレッド別）
			chatApp.get("/", zValidator("query", listSchema), async (c) => {
				const db = c.get("db");
				const userId = c.get("userId");
				const boardId = c.get("boardId");
				const { limit, before, threadId, pageId, includeUnpaged } = c.req.valid("query");

				if (!(await assertBoardAccess(db, boardId, userId))) {
					return c.json({ error: "Board not found" }, 404);
				}
				if (!(await canViewPage(db, boardId, userId, pageId))) {
					return c.json({ error: "Page not found" }, 404);
				}

				const conditions = [eq(chatMessages.boardId, boardId), eq(chatMessages.threadId, threadId)];
				const page = pageCondition(pageId, includeUnpaged === "1");
				if (page) conditions.push(page);
				if (before) {
					conditions.push(lt(chatMessages.createdAt, before));
				}

				const messages = await db
					.select()
					.from(chatMessages)
					.where(and(...conditions))
					.orderBy(desc(chatMessages.createdAt))
					.limit(limit);

				return c.json(messages.reverse());
			});

			const postSchema = z.object({
				text: z.string().min(1).max(2000),
				authorName: z.string().min(1).max(100),
				threadId: z.string().min(1).max(100).default("default"),
				/** 書いたページ。 */
				pageId: PAGE_ID.optional(),
			});

			// POST /api/boards/:boardId/chat — メッセージ投稿
			chatApp.post("/", zValidator("json", postSchema), async (c) => {
				const db = c.get("db");
				const userId = c.get("userId");
				const boardId = c.get("boardId");
				const body = c.req.valid("json");

				if (!(await assertBoardAccess(db, boardId, userId))) {
					return c.json({ error: "Board not found" }, 404);
				}
				if (!(await canViewPage(db, boardId, userId, body.pageId))) {
					return c.json({ error: "Page not found" }, 404);
				}

				const message = {
					id: crypto.randomUUID(),
					boardId,
					threadId: body.threadId,
					...(hasPageColumn && body.pageId ? { pageId: body.pageId } : {}),
					authorId: userId,
					authorName: body.authorName,
					text: body.text,
					createdAt: new Date().toISOString(),
				};
				await db.insert(chatMessages).values(message);

				return c.json(message, 201);
			});

			ctx.routes.register({ path: "/api/boards/:boardId/chat", app: chatApp as any });
		},
	};
}
