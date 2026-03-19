import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "./db/schema.js";

export interface Env {
	DB: D1Database;
	BOARD_ROOM: DurableObjectNamespace;
	DEV_MODE?: string;
}

export type AppDb = DrizzleD1Database<typeof schema>;
