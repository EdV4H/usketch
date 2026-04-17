import type { ServerBindings } from "@edv4h/usketch-server-core";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "./db/schema.js";

export interface Env extends ServerBindings {
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	WEB_URL?: string;
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
	GITHUB_CLIENT_ID?: string;
	GITHUB_CLIENT_SECRET?: string;
	OPENAI_API_KEY?: string;
}

export type AppDb = DrizzleD1Database<typeof schema>;
