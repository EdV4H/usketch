import type { HonoEnv, ServerPlugin } from "@edv4h/usketch-server-core";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, lt } from "drizzle-orm";
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

export function createChatPlugin(schema: ChatPluginSchema): ServerPlugin {
	const { boards, boardMembers, chatMessages } = schema;

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
			});

			// GET /api/boards/:boardId/chat — メッセージ一覧（スレッド別）
			chatApp.get("/", zValidator("query", listSchema), async (c) => {
				const db = c.get("db") as any;
				const userId = c.get("userId");
				const boardId = c.get("boardId");
				const { limit, before, threadId } = c.req.valid("query");

				if (!(await assertBoardAccess(db, boardId, userId))) {
					return c.json({ error: "Board not found" }, 404);
				}

				const conditions = [eq(chatMessages.boardId, boardId), eq(chatMessages.threadId, threadId)];
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
			});

			// POST /api/boards/:boardId/chat — メッセージ投稿
			chatApp.post("/", zValidator("json", postSchema), async (c) => {
				const db = c.get("db") as any;
				const userId = c.get("userId");
				const boardId = c.get("boardId");
				const body = c.req.valid("json");

				if (!(await assertBoardAccess(db, boardId, userId))) {
					return c.json({ error: "Board not found" }, 404);
				}

				const id = crypto.randomUUID();
				const now = new Date().toISOString();

				await db.insert(chatMessages).values({
					id,
					boardId,
					threadId: body.threadId,
					authorId: userId,
					authorName: body.authorName,
					text: body.text,
					createdAt: now,
				});

				return c.json(
					{
						id,
						boardId,
						threadId: body.threadId,
						authorId: userId,
						authorName: body.authorName,
						text: body.text,
						createdAt: now,
					},
					201,
				);
			});

			ctx.routes.register({ path: "/api/boards/:boardId/chat", app: chatApp as any });
		},
	};
}
