import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ── Better Auth テーブル ──

export const users = sqliteTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: integer("emailVerified", { mode: "boolean" }).notNull().default(false),
	image: text("image"),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const sessions = sqliteTable("session", {
	id: text("id").primaryKey(),
	expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
	token: text("token").notNull().unique(),
	ipAddress: text("ipAddress"),
	userAgent: text("userAgent"),
	userId: text("userId")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const accounts = sqliteTable("account", {
	id: text("id").primaryKey(),
	accountId: text("accountId").notNull(),
	providerId: text("providerId").notNull(),
	userId: text("userId")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	accessToken: text("accessToken"),
	refreshToken: text("refreshToken"),
	idToken: text("idToken"),
	accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp" }),
	refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp" }),
	scope: text("scope"),
	password: text("password"),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const verifications = sqliteTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
	createdAt: integer("createdAt", { mode: "timestamp" }),
	updatedAt: integer("updatedAt", { mode: "timestamp" }),
});

// ── アプリケーション テーブル ──

export const boards = sqliteTable("boards", {
	id: text("id").primaryKey(),
	title: text("title").notNull().default("Untitled"),
	ownerId: text("owner_id")
		.notNull()
		.references(() => users.id),
	createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
	updatedAt: text("updated_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
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
		lastViewport: text("last_viewport"),
		lastSeenAt: text("last_seen_at"),
		status: text("status").notNull().default("offline"),
	},
	(table) => [
		primaryKey({ columns: [table.boardId, table.userId] }),
		index("idx_board_members_user_id").on(table.userId),
	],
);

// ── Phase 2: Not Whiteboard テーブル ──

export const activityLog = sqliteTable(
	"activity_log",
	{
		id: text("id").primaryKey(),
		boardId: text("board_id")
			.notNull()
			.references(() => boards.id, { onDelete: "cascade" }),
		userId: text("user_id").notNull(),
		action: text("action").notNull(),
		targetId: text("target_id"),
		summary: text("summary"),
		createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
	},
	(table) => [index("idx_activity_log_board").on(table.boardId, table.createdAt)],
);

export const notifications = sqliteTable(
	"notifications",
	{
		id: text("id").primaryKey(),
		userId: text("user_id").notNull(),
		boardId: text("board_id")
			.notNull()
			.references(() => boards.id, { onDelete: "cascade" }),
		type: text("type").notNull(),
		payload: text("payload").notNull(),
		read: integer("read").notNull().default(0),
		createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
	},
	(table) => [index("idx_notifications_user").on(table.userId, table.read, table.createdAt)],
);

// ── Phase AI-4 / NW-3a: コメントテーブル ──

export const comments = sqliteTable(
	"comments",
	{
		id: text("id").primaryKey(),
		boardId: text("board_id")
			.notNull()
			.references(() => boards.id, { onDelete: "cascade" }),
		anchorShapeId: text("anchor_shape_id").notNull(),
		anchorX: real("anchor_x").notNull().default(0),
		anchorY: real("anchor_y").notNull().default(0),
		resolved: integer("resolved").notNull().default(0),
		createdBy: text("created_by").notNull(),
		createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
		updatedAt: text("updated_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
	},
	(table) => [
		index("idx_comments_board").on(table.boardId),
		index("idx_comments_shape").on(table.anchorShapeId),
	],
);

export const commentMessages = sqliteTable(
	"comment_messages",
	{
		id: text("id").primaryKey(),
		commentId: text("comment_id")
			.notNull()
			.references(() => comments.id, { onDelete: "cascade" }),
		authorId: text("author_id").notNull(),
		text: text("text").notNull(),
		createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
	},
	(table) => [index("idx_comment_messages_comment").on(table.commentId)],
);
