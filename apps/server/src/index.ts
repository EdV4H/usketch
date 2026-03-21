import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { ALLOWED_ORIGINS } from "./config.js";
import * as schema from "./db/schema.js";
import { authMiddleware } from "./middleware/auth.js";
import { authApp } from "./routes/auth.js";
import { boardsApp } from "./routes/boards.js";
import type { Env } from "./types.js";

type HonoEnv = {
	Bindings: Env;
	Variables: {
		db?: ReturnType<typeof drizzle<typeof schema>>;
		userId?: string;
	};
};

const app = new Hono<HonoEnv>();

// CORS
app.use(
	"*",
	cors({
		origin: ALLOWED_ORIGINS,
		credentials: true,
	}),
);

// Health check
app.get("/", (c) => c.json({ status: "ok", name: "usketch-server" }));

// Auth routes (Better Auth handles all /api/auth/*)
app.route("/api/auth", authApp);

// Protected routes: auth first, then DB injection
app.use("/api/*", authMiddleware);
app.use("/api/*", async (c, next) => {
	const db = drizzle(c.env.DB, { schema });
	c.set("db", db);
	await next();
});
app.route("/api/boards", boardsApp);

const COMMUNITY_BOARD_ID = "community-lobby";

// WebSocket — 認証 + ボードレベルのアクセス制御後にDurable Objectに接続
app.get("/api/boards/:boardId/ws", async (c) => {
	const userId = c.get("userId");
	if (!userId) return c.json({ error: "Unauthorized" }, 401);

	const db = c.get("db")!;
	const boardId = c.req.param("boardId");

	if (boardId === COMMUNITY_BOARD_ID) {
		// コミュニティロビーは全認証ユーザーにオープン — 存在しなければ自動作成
		const existing = await db
			.select({ id: schema.boards.id })
			.from(schema.boards)
			.where(eq(schema.boards.id, COMMUNITY_BOARD_ID))
			.limit(1);

		if (existing.length === 0) {
			const now = new Date().toISOString();
			await db.insert(schema.boards).values({
				id: COMMUNITY_BOARD_ID,
				title: "Community Lobby",
				ownerId: userId,
				createdAt: now,
				updatedAt: now,
				isPublic: true,
			});
		}
	} else {
		// 通常ボード: 存在確認 + メンバーシップ/公開ボード判定
		const result = await db
			.select({
				isPublic: schema.boards.isPublic,
				role: schema.boardMembers.role,
			})
			.from(schema.boards)
			.leftJoin(
				schema.boardMembers,
				and(
					eq(schema.boards.id, schema.boardMembers.boardId),
					eq(schema.boardMembers.userId, userId),
				),
			)
			.where(eq(schema.boards.id, boardId))
			.limit(1);

		if (result.length === 0 || (result[0].role === null && !result[0].isPublic)) {
			return c.json({ error: "Board not found" }, 404);
		}
	}

	const id = c.env.BOARD_ROOM.idFromName(boardId);
	const room = c.env.BOARD_ROOM.get(id);

	const url = new URL(c.req.url);
	url.pathname = "/ws";
	url.searchParams.set("userId", userId);
	url.searchParams.set("boardId", boardId);
	return room.fetch(new Request(url.toString(), c.req.raw));
});

export default app;

export { BoardRoom } from "./board-room.js";
