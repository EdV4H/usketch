import { createAiPlugin } from "@edv4h/usketch-plugin-server-ai";
import { createAuthPlugin } from "@edv4h/usketch-plugin-server-auth";
import { createBoardsPlugin } from "@edv4h/usketch-plugin-server-boards";
import { createChatPlugin } from "@edv4h/usketch-plugin-server-chat";
import { createCommentsPlugin } from "@edv4h/usketch-plugin-server-comments";
import { createServerApp } from "@edv4h/usketch-server-core";
import { drizzle } from "drizzle-orm/d1";
import { createAuth } from "./auth.js";
import { ALLOWED_ORIGINS } from "./config.js";
import * as schema from "./db/schema.js";
import { authMiddleware } from "./middleware/auth.js";
import type { Env } from "./types.js";

const app = await createServerApp({
	plugins: [
		createAuthPlugin({
			handler: (req, env) => {
				const auth = createAuth(env as unknown as Env);
				return auth.handler(req);
			},
		}),
		createBoardsPlugin({
			users: schema.users,
			boards: schema.boards,
			boardMembers: schema.boardMembers,
			activityLog: schema.activityLog,
			communityBoards: schema.communityBoards,
		}),
		createCommentsPlugin({
			boards: schema.boards,
			boardMembers: schema.boardMembers,
			comments: schema.comments,
			commentMessages: schema.commentMessages,
		}),
		createChatPlugin({
			boards: schema.boards,
			boardMembers: schema.boardMembers,
			chatMessages: schema.chatMessages,
		}),
		createAiPlugin({
			boards: schema.boards,
			boardMembers: schema.boardMembers,
		}),
	],
	corsOrigins: ALLOWED_ORIGINS,
	authMiddleware,
	dbMiddleware: async (c, next) => {
		const db = drizzle(c.env.DB, { schema });
		c.set("db", db);
		await next();
	},
});

// Public server-time endpoint: lets clients estimate their clock offset from the
// server (Cristian's algorithm) so shared timers agree on "now". Intentionally
// outside `/api/*` so it needs no auth; CORS is applied by the app's global cors.
app.get("/time", (c) => c.json({ t: Date.now() }));

export default app;

export { BoardRoom } from "./board-room.js";
