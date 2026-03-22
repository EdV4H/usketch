import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "./db/schema.js";

export interface Env {
	DB: D1Database;
	BOARD_ROOM: DurableObjectNamespace;
	DEV_MODE?: string;
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
	GITHUB_CLIENT_ID?: string;
	GITHUB_CLIENT_SECRET?: string;
	OPENAI_API_KEY?: string;
}

export type AppDb = DrizzleD1Database<typeof schema>;
