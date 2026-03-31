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
	authMiddleware: authMiddleware as any,
	dbMiddleware: async (c, next) => {
		const db = drizzle((c.env as unknown as Env).DB, { schema });
		c.set("db", db as any);
		await next();
	},
});

export default app;

export { BoardRoom } from "./board-room.js";
