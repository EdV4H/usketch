import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { cors } from "hono/cors";
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
		origin: ["http://localhost:5173", "http://localhost:4173"],
		credentials: true,
	}),
);

// Health check
app.get("/", (c) => c.json({ status: "ok", name: "usketch-server" }));

// Auth routes (no auth middleware needed, no DB needed)
app.route("/api/auth", authApp);

// Protected routes: auth first, then DB injection
app.use("/api/*", authMiddleware);
app.use("/api/*", async (c, next) => {
	const db = drizzle(c.env.DB, { schema });
	c.set("db", db);
	await next();
});
app.route("/api/boards", boardsApp);

export default app;

// Durable Object export (stub — Week 5-6 で実装)
export { BoardRoom } from "./board-room.js";
