import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { boardMembers, boards, users } from "../db/schema.js";
import type { AppDb, Env } from "../types.js";

type BoardsEnv = {
	Bindings: Env;
	Variables: {
		db: AppDb;
		userId: string;
	};
};

const boardsApp = new Hono<BoardsEnv>();

const createBoardSchema = z.object({
	title: z.string().min(1).max(200).optional(),
});

const updateBoardSchema = z.object({
	title: z.string().min(1).max(200).optional(),
	isPublic: z.boolean().optional(),
});

// POST /api/boards — ボード作成
boardsApp.post("/", zValidator("json", createBoardSchema), async (c) => {
	const db = c.get("db");
	const userId = c.get("userId");
	const body = c.req.valid("json");

	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	// ボード作成 + メンバー追加をバッチ実行でアトミックに
	const statements = [
		// DEV_MODE時のみ: Better Auth外のユーザーを自動作成
		...(c.env.DEV_MODE === "true"
			? [
					db
						.insert(users)
						.values({
							id: userId,
							name: "Dev User",
							email: `${userId}@dev.local`,
							createdAt: new Date(),
							updatedAt: new Date(),
						})
						.onConflictDoNothing(),
				]
			: []),
		db.insert(boards).values({
			id,
			title: body.title ?? "Untitled",
			ownerId: userId,
			createdAt: now,
			updatedAt: now,
		}),
		db.insert(boardMembers).values({
			boardId: id,
			userId,
			role: "owner",
		}),
	] as const;
	await db.batch(statements as any);

	return c.json({ id, title: body.title ?? "Untitled", createdAt: now }, 201);
});

// GET /api/boards — ボード一覧（自分がメンバーのボード）
boardsApp.get("/", async (c) => {
	const db = c.get("db");
	const userId = c.get("userId");

	const result = await db
		.select({
			id: boards.id,
			title: boards.title,
			ownerId: boards.ownerId,
			createdAt: boards.createdAt,
			updatedAt: boards.updatedAt,
			isPublic: boards.isPublic,
			role: boardMembers.role,
		})
		.from(boards)
		.innerJoin(boardMembers, eq(boards.id, boardMembers.boardId))
		.where(eq(boardMembers.userId, userId))
		.orderBy(desc(boards.updatedAt));

	return c.json(result);
});

// GET /api/boards/:id — ボード取得
boardsApp.get("/:id", async (c) => {
	const db = c.get("db");
	const currentUserId = c.get("userId");
	const boardId = c.req.param("id");

	const result = await db
		.select({
			id: boards.id,
			title: boards.title,
			ownerId: boards.ownerId,
			createdAt: boards.createdAt,
			updatedAt: boards.updatedAt,
			isPublic: boards.isPublic,
			role: boardMembers.role,
		})
		.from(boards)
		.leftJoin(
			boardMembers,
			and(eq(boards.id, boardMembers.boardId), eq(boardMembers.userId, currentUserId)),
		)
		.where(eq(boards.id, boardId))
		.limit(1);

	if (result.length === 0) {
		return c.json({ error: "Board not found" }, 404);
	}

	const board = result[0];

	// アクセス制御: メンバーであるかパブリックボードのみ閲覧可能
	// 非メンバーには404を返し、ボードIDの存在をリークしない
	if (board.role === null && !board.isPublic) {
		return c.json({ error: "Board not found" }, 404);
	}

	return c.json(board);
});

// PATCH /api/boards/:id — ボード更新
boardsApp.patch("/:id", zValidator("json", updateBoardSchema), async (c) => {
	const db = c.get("db");
	const boardId = c.req.param("id");
	const body = c.req.valid("json");
	const currentUserId = c.get("userId");

	// オーナー確認
	const board = await db
		.select({ ownerId: boards.ownerId })
		.from(boards)
		.where(eq(boards.id, boardId))
		.limit(1);

	if (board.length === 0) {
		return c.json({ error: "Board not found" }, 404);
	}

	if (board[0].ownerId !== currentUserId) {
		return c.json({ error: "Forbidden" }, 403);
	}

	await db
		.update(boards)
		.set({
			updatedAt: new Date().toISOString(),
			...(body.title !== undefined && { title: body.title }),
			...(body.isPublic !== undefined && { isPublic: body.isPublic }),
		})
		.where(eq(boards.id, boardId));

	return c.json({ ok: true });
});

// DELETE /api/boards/:id — ボード削除
boardsApp.delete("/:id", async (c) => {
	const db = c.get("db");
	const userId = c.get("userId");
	const boardId = c.req.param("id");

	const board = await db
		.select({ ownerId: boards.ownerId })
		.from(boards)
		.where(eq(boards.id, boardId))
		.limit(1);

	if (board.length === 0) {
		return c.json({ error: "Board not found" }, 404);
	}

	if (board[0].ownerId !== userId) {
		return c.json({ error: "Forbidden" }, 403);
	}

	await db.delete(boards).where(eq(boards.id, boardId));

	return c.json({ ok: true });
});

export { boardsApp };
