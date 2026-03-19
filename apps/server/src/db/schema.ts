import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
	id: text("id").primaryKey(),
	name: text("name"),
	email: text("email").unique(),
	avatarUrl: text("avatar_url"),
	createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const boards = sqliteTable("boards", {
	id: text("id").primaryKey(),
	title: text("title").notNull().default("Untitled"),
	ownerId: text("owner_id")
		.notNull()
		.references(() => users.id),
	createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
	updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
	isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
});

export const boardMembers = sqliteTable(
	"board_members",
	{
		boardId: text("board_id")
			.notNull()
			.references(() => boards.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id),
		role: text("role", { enum: ["owner", "editor", "viewer"] })
			.notNull()
			.default("editor"),
	},
	(table) => [primaryKey({ columns: [table.boardId, table.userId] })],
);
