import type { HonoEnv, ServerPlugin } from "@edv4h/usketch-server-core";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, notInArray } from "drizzle-orm";
import type { SQLiteTableWithColumns } from "drizzle-orm/sqlite-core";
import { Hono } from "hono";
import { z } from "zod";

/** boards プラグインが必要とするスキーマテーブル */
export interface BoardsPluginSchema {
	users: SQLiteTableWithColumns<any>;
	boards: SQLiteTableWithColumns<any>;
	boardMembers: SQLiteTableWithColumns<any>;
	activityLog: SQLiteTableWithColumns<any>;
	communityBoards: SQLiteTableWithColumns<any>;
}

export function createBoardsPlugin(schema: BoardsPluginSchema): ServerPlugin {
	const { users, boards, boardMembers, activityLog, communityBoards } = schema;

	return {
		id: "server-boards",
		name: "ボード管理",
		setup(ctx) {
			const boardsApp = new Hono<HonoEnv>();

			const createBoardSchema = z.object({
				title: z.string().min(1).max(200).optional(),
			});

			const updateBoardSchema = z.object({
				title: z.string().min(1).max(200).optional(),
				isPublic: z.boolean().optional(),
				description: z.string().max(1000).optional(),
			});

			// POST /api/boards — ボード作成
			boardsApp.post("/", zValidator("json", createBoardSchema), async (c) => {
				const db = c.get("db") as any;
				const userId = c.get("userId");
				const body = c.req.valid("json");

				const id = crypto.randomUUID();
				const now = new Date().toISOString();

				// DEV_MODE時のみ: Better Auth外のユーザーを自動作成
				if ((c.env as any).DEV_MODE === "true") {
					await db
						.insert(users)
						.values({
							id: userId,
							name: "Dev User",
							email: `${userId}@dev.local`,
							createdAt: new Date(),
							updatedAt: new Date(),
						})
						.onConflictDoNothing();
				}

				// ボード作成 + メンバー追加をバッチ実行でアトミックに
				await db.batch([
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
				]);

				return c.json({ id, title: body.title ?? "Untitled", createdAt: now }, 201);
			});

			// GET /api/boards/discover — 公開ボード一覧（コミュニティエリア用）
			boardsApp.get("/discover", async (c) => {
				const db = c.get("db") as any;

				const result = await db
					.select({
						id: boards.id,
						title: boards.title,
						description: boards.description,
						ownerId: boards.ownerId,
						ownerName: users.name,
						ownerImage: users.image,
						createdAt: boards.createdAt,
						updatedAt: boards.updatedAt,
					})
					.from(boards)
					.innerJoin(users, eq(boards.ownerId, users.id))
					.where(
						and(
							eq(boards.isPublic, true),
							notInArray(
								boards.id,
								db.select({ id: communityBoards.boardId }).from(communityBoards),
							),
						),
					)
					.orderBy(desc(boards.updatedAt))
					.limit(50);

				return c.json(result);
			});

			// GET /api/boards — ボード一覧（自分がメンバーのボード）
			boardsApp.get("/", async (c) => {
				const db = c.get("db") as any;
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
					.where(
						and(
							eq(boardMembers.userId, userId),
							notInArray(
								boards.id,
								db.select({ id: communityBoards.boardId }).from(communityBoards),
							),
						),
					)
					.orderBy(desc(boards.updatedAt));

				return c.json(result);
			});

			// GET /api/boards/:id — ボード取得
			boardsApp.get("/:id", async (c) => {
				const db = c.get("db") as any;
				const currentUserId = c.get("userId");
				const boardId = c.req.param("id");

				const result = await db
					.select({
						id: boards.id,
						title: boards.title,
						description: boards.description,
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
				const db = c.get("db") as any;
				const boardId = c.req.param("id");
				// コミュニティボードは変更不可
				const isCommunity = await db
					.select({ boardId: communityBoards.boardId })
					.from(communityBoards)
					.where(eq(communityBoards.boardId, boardId))
					.limit(1);
				if (isCommunity.length > 0) return c.json({ error: "Cannot modify community board" }, 403);
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
						...(body.description !== undefined && { description: body.description }),
					})
					.where(eq(boards.id, boardId));

				return c.json({ ok: true });
			});

			// DELETE /api/boards/:id — ボード削除
			boardsApp.delete("/:id", async (c) => {
				const db = c.get("db") as any;
				const userId = c.get("userId");
				const boardId = c.req.param("id");
				// コミュニティボードは削除不可
				const isCommunityDel = await db
					.select({ boardId: communityBoards.boardId })
					.from(communityBoards)
					.where(eq(communityBoards.boardId, boardId))
					.limit(1);
				if (isCommunityDel.length > 0)
					return c.json({ error: "Cannot delete community board" }, 403);

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

			// GET /api/boards/:id/members — メンバー一覧（メンバーまたは公開ボードからアクセス可）
			boardsApp.get("/:id/members", async (c) => {
				const db = c.get("db") as any;
				const currentUserId = c.get("userId");
				const boardId = c.req.param("id");

				// メンバーシップ確認
				const membership = await db
					.select({ role: boardMembers.role })
					.from(boardMembers)
					.where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, currentUserId)))
					.limit(1);

				if (membership.length === 0) {
					// 公開ボードならメンバーでなくても閲覧可能
					const board = await db
						.select({ isPublic: boards.isPublic })
						.from(boards)
						.where(eq(boards.id, boardId))
						.limit(1);

					if (board.length === 0 || !board[0].isPublic) {
						return c.json({ error: "Board not found" }, 404);
					}
				}

				const result = await db
					.select({
						userId: boardMembers.userId,
						role: boardMembers.role,
						name: users.name,
						image: users.image,
						lastViewport: boardMembers.lastViewport,
						lastSeenAt: boardMembers.lastSeenAt,
						status: boardMembers.status,
					})
					.from(boardMembers)
					.innerJoin(users, eq(boardMembers.userId, users.id))
					.where(eq(boardMembers.boardId, boardId));

				return c.json(result);
			});

			const addMemberSchema = z.object({
				email: z.string().email(),
				role: z.enum(["editor", "viewer"]).optional(),
			});

			// POST /api/boards/:id/members — メンバー追加
			boardsApp.post("/:id/members", zValidator("json", addMemberSchema), async (c) => {
				const db = c.get("db") as any;
				const currentUserId = c.get("userId");
				const boardId = c.req.param("id");
				const body = c.req.valid("json");

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

				// メールからユーザーを検索
				const user = await db.select().from(users).where(eq(users.email, body.email)).limit(1);

				if (user.length === 0) {
					return c.json({ error: "User not found" }, 404);
				}

				await db
					.insert(boardMembers)
					.values({
						boardId,
						userId: user[0].id,
						role: body.role ?? "editor",
					})
					.onConflictDoNothing();

				return c.json({ ok: true }, 201);
			});

			// DELETE /api/boards/:id/members/:userId — メンバー削除
			boardsApp.delete("/:id/members/:userId", async (c) => {
				const db = c.get("db") as any;
				const currentUserId = c.get("userId");
				const boardId = c.req.param("id");
				const targetUserId = c.req.param("userId");

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
				// オーナー自身は削除不可
				if (targetUserId === board[0].ownerId) {
					return c.json({ error: "Cannot remove owner" }, 400);
				}

				await db
					.delete(boardMembers)
					.where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, targetUserId)));

				return c.json({ ok: true });
			});

			// POST /api/boards/:id/share — パブリックリンクの切り替え
			boardsApp.post("/:id/share", async (c) => {
				const db = c.get("db") as any;
				const currentUserId = c.get("userId");
				const boardId = c.req.param("id");

				const board = await db
					.select({ ownerId: boards.ownerId, isPublic: boards.isPublic })
					.from(boards)
					.where(eq(boards.id, boardId))
					.limit(1);

				if (board.length === 0) {
					return c.json({ error: "Board not found" }, 404);
				}
				if (board[0].ownerId !== currentUserId) {
					return c.json({ error: "Forbidden" }, 403);
				}

				const newIsPublic = !board[0].isPublic;
				await db
					.update(boards)
					.set({ isPublic: newIsPublic, updatedAt: new Date().toISOString() })
					.where(eq(boards.id, boardId));

				return c.json({ isPublic: newIsPublic });
			});

			// PATCH /api/boards/:id/viewport — 自分のビューポート位置を保存
			const viewportSchema = z.object({
				x: z.number(),
				y: z.number(),
			});

			boardsApp.patch("/:id/viewport", zValidator("json", viewportSchema), async (c) => {
				const db = c.get("db") as any;
				const userId = c.get("userId");
				const boardId = c.req.param("id");
				const body = c.req.valid("json");

				// メンバーシップ確認
				const membership = await db
					.select({ role: boardMembers.role })
					.from(boardMembers)
					.where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, userId)))
					.limit(1);

				if (membership.length === 0) {
					return c.json({ error: "Board not found" }, 404);
				}

				await db
					.update(boardMembers)
					.set({ lastViewport: JSON.stringify(body) })
					.where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, userId)));

				return c.json({ ok: true });
			});

			// GET /api/boards/:id/activity — アクティビティログ取得
			boardsApp.get("/:id/activity", async (c) => {
				const db = c.get("db") as any;
				const userId = c.get("userId");
				const boardId = c.req.param("id");

				// メンバーシップ確認
				const membership = await db
					.select({ role: boardMembers.role })
					.from(boardMembers)
					.where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, userId)))
					.limit(1);

				if (membership.length === 0) {
					return c.json({ error: "Board not found" }, 404);
				}

				const entries = await db
					.select()
					.from(activityLog)
					.where(eq(activityLog.boardId, boardId))
					.orderBy(desc(activityLog.createdAt))
					.limit(50);

				return c.json(entries);
			});

			// WebSocket — 認証 + ボードレベルのアクセス制御後にDurable Objectに接続
			boardsApp.get("/:boardId/ws", async (c) => {
				const userId = c.get("userId");
				if (!userId) return c.json({ error: "Unauthorized" }, 401);

				const db = c.get("db") as any;
				if (!db) return c.json({ error: "Internal error" }, 500);
				const boardId = c.req.param("boardId");

				// コミュニティボード判定（community_boards テーブルに存在するか）
				const communityEntry = await db
					.select({ boardId: communityBoards.boardId, displayName: communityBoards.displayName })
					.from(communityBoards)
					.where(eq(communityBoards.boardId, boardId))
					.limit(1);

				if (communityEntry.length > 0) {
					// コミュニティボードは全認証ユーザーにオープン — 存在しなければ自動作成
					// DEV_MODE: ユーザーが存在しない場合はFK制約のため自動作成
					if ((c.env as any).DEV_MODE === "true") {
						await db
							.insert(users)
							.values({
								id: userId,
								name: "Dev User",
								email: `${userId}@dev.local`,
								createdAt: new Date(),
								updatedAt: new Date(),
							})
							.onConflictDoNothing();
					}
					// onConflictDoNothingで並行作成に対応
					const now = new Date().toISOString();
					await db
						.insert(boards)
						.values({
							id: boardId,
							title: communityEntry[0].displayName,
							ownerId: userId,
							createdAt: now,
							updatedAt: now,
							isPublic: true,
						})
						.onConflictDoNothing();
				} else {
					// 通常ボード: 存在確認 + メンバーシップ/公開ボード判定
					const result = await db
						.select({
							isPublic: boards.isPublic,
							role: boardMembers.role,
						})
						.from(boards)
						.leftJoin(
							boardMembers,
							and(eq(boards.id, boardMembers.boardId), eq(boardMembers.userId, userId)),
						)
						.where(eq(boards.id, boardId))
						.limit(1);

					if (result.length === 0 || (result[0].role === null && !result[0].isPublic)) {
						return c.json({ error: "Board not found" }, 404);
					}
				}

				const id = (c.env as any).BOARD_ROOM.idFromName(boardId);
				const room = (c.env as any).BOARD_ROOM.get(id);

				const url = new URL(c.req.url);
				url.pathname = "/ws";
				url.searchParams.set("userId", userId);
				url.searchParams.set("boardId", boardId);
				return room.fetch(new Request(url.toString(), c.req.raw));
			});

			// ── Durable Object プロキシ: snapshot API ──
			// 認証済みユーザーのリクエストを BoardRoom Durable Object にプロキシする
			async function proxyToDurableObject(c: any) {
				const userId = c.get("userId");
				if (!userId) return c.json({ error: "Unauthorized" }, 401);
				const boardId = c.req.param("boardId");
				const env = c.env as any;
				const id = env.BOARD_ROOM.idFromName(boardId);
				const room = env.BOARD_ROOM.get(id);
				const url = new URL(c.req.url);
				url.pathname = url.pathname.replace(`/api/boards/${boardId}`, "");
				return room.fetch(new Request(url.toString(), c.req.raw));
			}

			boardsApp.all("/:boardId/snapshots/*", proxyToDurableObject);
			boardsApp.all("/:boardId/snapshots", proxyToDurableObject);
			boardsApp.post("/:boardId/snapshot", proxyToDurableObject);

			ctx.routes.register({ path: "/api/boards", app: boardsApp });

			// ── コミュニティボード（ワールドマップ地域）API ──
			const communityApp = new Hono<HonoEnv>();

			// 初期地域データ（テーブルが空の場合に自動シード）
			const SEED_REGIONS = [
				{
					boardId: "community-lobby",
					slug: "lobby",
					displayName: "Lobby",
					description: "メインロビー",
					themeColor: "#6366f1",
					icon: "🏠",
					gridX: 0,
					gridY: 0,
					sortOrder: 0,
				},
				{
					boardId: "community-workshop",
					slug: "workshop",
					displayName: "Workshop",
					description: "作業スペース",
					themeColor: "#f59e0b",
					icon: "🔨",
					gridX: 1,
					gridY: 0,
					sortOrder: 1,
				},
				{
					boardId: "community-gallery",
					slug: "gallery",
					displayName: "Gallery",
					description: "ギャラリー",
					themeColor: "#ec4899",
					icon: "🎨",
					gridX: 0,
					gridY: 1,
					sortOrder: 2,
				},
				{
					boardId: "community-playground",
					slug: "playground",
					displayName: "Playground",
					description: "実験場",
					themeColor: "#10b981",
					icon: "🎮",
					gridX: 1,
					gridY: 1,
					sortOrder: 3,
				},
			];

			// DB取得ヘルパー（public route では dbMiddleware が効かないため）
			async function getDb(c: any) {
				let db = c.get("db") as any;
				if (!db && (c.env as any).DB) {
					const { drizzle: makeDrizzle } = await import("drizzle-orm/d1");
					db = makeDrizzle((c.env as any).DB);
				}
				return db;
			}

			// テーブルが空なら初期地域データを自動シード
			async function ensureSeed(db: any) {
				const count = await db
					.select({ boardId: communityBoards.boardId })
					.from(communityBoards)
					.limit(1);
				if (count.length > 0) return;

				const now = new Date().toISOString();
				await db
					.insert(users)
					.values({
						id: "system",
						name: "System",
						email: "system@usketch.local",
						createdAt: new Date(),
						updatedAt: new Date(),
					})
					.onConflictDoNothing();
				for (const seed of SEED_REGIONS) {
					await db
						.insert(boards)
						.values({
							id: seed.boardId,
							title: seed.displayName,
							ownerId: "system",
							createdAt: now,
							updatedAt: now,
							isPublic: true,
						})
						.onConflictDoNothing();
					await db.insert(communityBoards).values(seed).onConflictDoNothing();
				}
			}

			// GET /api/community-boards — 全地域一覧（認証不要）
			communityApp.get("/", async (c) => {
				const db = await getDb(c);
				if (!db) return c.json({ error: "Internal error" }, 500);

				await ensureSeed(db);

				const result = await db
					.select({
						boardId: communityBoards.boardId,
						slug: communityBoards.slug,
						displayName: communityBoards.displayName,
						description: communityBoards.description,
						themeColor: communityBoards.themeColor,
						icon: communityBoards.icon,
						gridX: communityBoards.gridX,
						gridY: communityBoards.gridY,
					})
					.from(communityBoards)
					.orderBy(communityBoards.sortOrder);

				return c.json(result);
			});

			// GET /api/community-boards/:slug — slug → boardId 解決（認証不要）
			communityApp.get("/:slug", async (c) => {
				const db = await getDb(c);
				if (!db) return c.json({ error: "Internal error" }, 500);

				await ensureSeed(db);

				const slug = c.req.param("slug");
				const result = await db
					.select({
						boardId: communityBoards.boardId,
						slug: communityBoards.slug,
						displayName: communityBoards.displayName,
						description: communityBoards.description,
						themeColor: communityBoards.themeColor,
						icon: communityBoards.icon,
						gridX: communityBoards.gridX,
						gridY: communityBoards.gridY,
					})
					.from(communityBoards)
					.where(eq(communityBoards.slug, slug))
					.limit(1);

				if (result.length === 0) {
					return c.json({ error: "Community board not found" }, 404);
				}

				return c.json(result[0]);
			});

			ctx.routes.register({ path: "/api/community-boards", app: communityApp, public: true });

			// サムネイル（認証不要の public route — img タグから直接アクセスされるため）
			const thumbnailApp = new Hono<HonoEnv>();

			thumbnailApp.get("/:id/thumbnail", async (c) => {
				const boardId = c.req.param("id");
				const w = c.req.query("w") ?? "240";
				const h = c.req.query("h") ?? "160";

				// DB注入（public route なので dbMiddleware が適用されない場合に備える）
				const env = c.env as any;
				let db = c.get("db") as any;
				if (!db && env.DB) {
					const { drizzle: makeDrizzle } = await import("drizzle-orm/d1");
					db = makeDrizzle(env.DB);
				}
				if (!db) {
					return c.json({ error: "Internal error: database unavailable" }, 500);
				}

				// 公開ボードのみ（認証なしなのでメンバーチェックは行わない）
				const result = await db
					.select({ isPublic: boards.isPublic })
					.from(boards)
					.where(eq(boards.id, boardId))
					.limit(1);

				if (result.length === 0 || !result[0].isPublic) {
					return c.json({ error: "Board not found" }, 404);
				}

				const id = env.BOARD_ROOM.idFromName(boardId);
				const room = env.BOARD_ROOM.get(id);
				const thumbnailUrl = new URL(`https://internal/thumbnail?w=${w}&h=${h}`);
				const res = await room.fetch(thumbnailUrl.toString());
				return new Response(res.body, {
					status: res.status,
					headers: res.headers,
				});
			});

			ctx.routes.register({ path: "/public/boards", app: thumbnailApp, public: true });
		},
	};
}
