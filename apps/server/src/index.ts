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

// WebSocket — 認証済みユーザーのみDurable Objectに接続
app.get("/api/boards/:boardId/ws", async (c) => {
	const userId = c.get("userId");
	if (!userId) return c.json({ error: "Unauthorized" }, 401);

	const boardId = c.req.param("boardId");
	const id = c.env.BOARD_ROOM.idFromName(boardId);
	const room = c.env.BOARD_ROOM.get(id);

	// userId をDOに伝達（WebSocketタグで識別）
	const url = new URL(c.req.url);
	url.pathname = "/ws";
	url.searchParams.set("userId", userId);
	return room.fetch(new Request(url.toString(), c.req.raw));
});

export default app;

export { BoardRoom } from "./board-room.js";
