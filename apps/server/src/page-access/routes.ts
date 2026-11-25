/**
 * ページの公開範囲の REST（デモの権限、R4b）。
 *
 * - GET    /api/boards/:boardId/page-access                    見ている人の役割と、見られるページの公開範囲・
 *                                                              非公開ページの本当の名前
 * - PUT    /api/boards/:boardId/pages/:pageId/access            公開範囲・編集範囲を決める（page.manage）
 * - PUT    /api/boards/:boardId/pages/:pageId/name              非公開ページの名前を変える（page.manage）
 * - POST   /api/boards/:boardId/pages/:pageId/members           メールで招く（page.manage）
 * - DELETE /api/boards/:boardId/pages/:pageId/members/:userId   招待を外す（page.manage）
 *
 * 変えたら BoardRoom に知らせ、見られなくなったページの購読を外してもらう。
 *
 * 非公開ページの名前は、ルート doc（全員に配る）では伏せて空にし、本当の名前は D1 の
 * `page_access.title` に置いて見られる人にだけ返す。非公開にするとき BoardRoom が名前を伏せて
 * 元の名前を返し、やめるときに戻す。
 */
import { type DemoPageAccess, defaultPageAccess } from "@edv4h/usketch-demo-permissions";
import type { HonoEnv, ServerPlugin } from "@edv4h/usketch-server-core";
import { PERMISSIONS } from "@edv4h/usketch-shared";
import { isValidDocId } from "@edv4h/usketch-sync";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { pageAccess, pageMembers, users } from "../db/schema.js";
import { judgePages as judge } from "./judge.js";
import { loadBoardViewer, loadPageAccess, type StoredPageAccess } from "./queries.js";

const accessSchema = z.object({
	visibility: z.enum(["public", "members", "private"]),
	edit: z.enum(["owner-only", "invited", "members"]),
});

const nameSchema = z.object({ name: z.string().trim().min(1).max(200) });

const inviteSchema = z.object({
	email: z.string().email(),
	role: z.enum(["editor", "viewer"]).default("viewer"),
});

/** BoardRoom に権限が変わったことを知らせる（失敗しても REST の結果は変えない）。 */
async function notifyRoom(c: Context<HonoEnv>, boardId: string): Promise<void> {
	try {
		const room = c.env.BOARD_ROOM.get(c.env.BOARD_ROOM.idFromName(boardId));
		await room.fetch("https://internal/permissions-changed", { method: "POST" });
	} catch (e) {
		console.error("[page-access] Failed to notify the board room:", e);
	}
}

/** BoardRoom にルート doc のページの名前を伏せて（戻して）もらう。伏せたときは元の名前を返す。 */
async function maskInRoom(
	c: Context<HonoEnv>,
	boardId: string,
	body: { pageId: string; masked: boolean; name?: string },
): Promise<{ ok: true; name: string | null } | { ok: false; status: number }> {
	const room = c.env.BOARD_ROOM.get(c.env.BOARD_ROOM.idFromName(boardId));
	const res = await room.fetch("https://internal/pages/mask", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!res.ok) return { ok: false, status: res.status };
	const { name } = (await res.json()) as { name: string | null };
	return { ok: true, name };
}

/** `:boardId` と `:pageId` を読み、page.manage がある人だけ通す。 */
async function authorizeManage(c: Context<HonoEnv>) {
	const userId = c.get("userId");
	const db = c.get("db");
	if (!userId) return { error: c.json({ error: "Unauthorized" }, 401) } as const;
	if (!db) return { error: c.json({ error: "Internal error" }, 500) } as const;
	const boardId = c.req.param("boardId") ?? "";
	const pageId = c.req.param("pageId") ?? "";
	if (!isValidDocId(pageId)) return { error: c.json({ error: "Invalid page id" }, 400) } as const;
	const viewer = await loadBoardViewer(db, boardId, userId);
	if (!viewer) return { error: c.json({ error: "Board not found" }, 404) } as const;
	const pages = await loadPageAccess(db, boardId);
	const current: StoredPageAccess | undefined = pages.get(pageId);
	const can = judge(boardId, userId, viewer);
	if (!can(PERMISSIONS.pageView, pageId, current)) {
		return { error: c.json({ error: "Page not found" }, 404) } as const;
	}
	if (!can(PERMISSIONS.pageManage, pageId, current)) {
		return { error: c.json({ error: "Forbidden" }, 403) } as const;
	}
	return { db, userId, boardId, pageId, current, viewer } as const;
}

export function createPageAccessPlugin(): ServerPlugin {
	return {
		id: "demo-page-access",
		name: "Page access (demo)",
		setup(ctx) {
			const app = new Hono<HonoEnv>();

			app.get("/:boardId/page-access", async (c) => {
				const userId = c.get("userId");
				const db = c.get("db");
				if (!userId) return c.json({ error: "Unauthorized" }, 401);
				if (!db) return c.json({ error: "Internal error" }, 500);
				const boardId = c.req.param("boardId");
				const viewer = await loadBoardViewer(db, boardId, userId);
				if (!viewer) return c.json({ error: "Board not found" }, 404);
				const can = judge(boardId, userId, viewer);
				const pages: Record<string, DemoPageAccess> = {};
				const names: Record<string, string> = {};
				const hidden: string[] = [];
				for (const [pageId, { title, ...access }] of await loadPageAccess(db, boardId)) {
					if (!can(PERMISSIONS.pageView, pageId, access)) {
						hidden.push(pageId);
						continue;
					}
					if (access.visibility === "private" && title) names[pageId] = title;
					// 招いた人の一覧は、そのページを管理できる人にだけ見せる
					const { members, ...rest } = access;
					pages[pageId] = can(PERMISSIONS.pageManage, pageId, access)
						? access
						: members?.[userId]
							? { ...rest, members: { [userId]: members[userId] } }
							: rest;
				}
				return c.json({ viewer: { userId, ...viewer }, pages, names, hidden });
			});

			app.put("/:boardId/pages/:pageId/access", zValidator("json", accessSchema), async (c) => {
				const auth = await authorizeManage(c);
				if ("error" in auth) return auth.error;
				const { db, userId, boardId, pageId, current } = auth;
				const body = c.req.valid("json");
				// 作った人の分からないページを絞ったら、絞った人を作った人にする（editor が自分で
				// 見られなくならないように）。
				const narrowed = body.visibility === "private" || body.edit !== "members";
				const ownerId = current?.ownerId ?? (narrowed ? userId : null);
				// 非公開にするなら名前を伏せ、やめるなら戻す
				const wasPrivate = current?.visibility === "private";
				const willBePrivate = body.visibility === "private";
				let title = current?.title ?? null;
				if (!wasPrivate && willBePrivate) {
					const masked = await maskInRoom(c, boardId, { pageId, masked: true });
					if (!masked.ok) {
						return c.json({ error: "Page not found" }, masked.status === 404 ? 404 : 500);
					}
					title = masked.name ?? "";
				} else if (wasPrivate && !willBePrivate) {
					const unmasked = await maskInRoom(c, boardId, {
						pageId,
						masked: false,
						name: title ?? "",
					});
					if (!unmasked.ok) return c.json({ error: "Internal error" }, 500);
					title = null;
				}
				const now = new Date().toISOString();
				await db
					.insert(pageAccess)
					.values({ boardId, pageId, ownerId, ...body, title, updatedAt: now })
					.onConflictDoUpdate({
						target: [pageAccess.boardId, pageAccess.pageId],
						set: { ownerId, ...body, title, updatedAt: now },
					});
				await notifyRoom(c, boardId);
				return c.json({ pageId, ownerId, ...body });
			});

			// 非公開ページの名前（ルート doc では伏せているので、ここで変える）
			app.put("/:boardId/pages/:pageId/name", zValidator("json", nameSchema), async (c) => {
				const auth = await authorizeManage(c);
				if ("error" in auth) return auth.error;
				const { db, boardId, pageId, current } = auth;
				if (current?.visibility !== "private") {
					return c.json({ error: "Only private pages are renamed here" }, 409);
				}
				const { name } = c.req.valid("json");
				await db
					.update(pageAccess)
					.set({ title: name, updatedAt: new Date().toISOString() })
					.where(and(eq(pageAccess.boardId, boardId), eq(pageAccess.pageId, pageId)));
				await notifyRoom(c, boardId);
				return c.json({ pageId, name });
			});

			app.post("/:boardId/pages/:pageId/members", zValidator("json", inviteSchema), async (c) => {
				const auth = await authorizeManage(c);
				if ("error" in auth) return auth.error;
				const { db, boardId, pageId, current, viewer } = auth;
				const body = c.req.valid("json");
				const [user] = await db
					.select({ id: users.id })
					.from(users)
					.where(eq(users.email, body.email))
					.limit(1);
				if (!user) return c.json({ error: "User not found" }, 404);
				// 公開範囲の行が無いページは、今の扱い（既定）のまま行を作ってから招く
				if (!current) {
					await db
						.insert(pageAccess)
						.values({ boardId, pageId, ownerId: null, ...defaultPageAccess(viewer.boardPublic) })
						.onConflictDoNothing();
				}
				await db
					.insert(pageMembers)
					.values({ boardId, pageId, userId: user.id, role: body.role })
					.onConflictDoUpdate({
						target: [pageMembers.boardId, pageMembers.pageId, pageMembers.userId],
						set: { role: body.role },
					});
				await notifyRoom(c, boardId);
				return c.json({ userId: user.id, role: body.role }, 201);
			});

			app.delete("/:boardId/pages/:pageId/members/:userId", async (c) => {
				const auth = await authorizeManage(c);
				if ("error" in auth) return auth.error;
				const { db, boardId, pageId } = auth;
				await db
					.delete(pageMembers)
					.where(
						and(
							eq(pageMembers.boardId, boardId),
							eq(pageMembers.pageId, pageId),
							eq(pageMembers.userId, c.req.param("userId")),
						),
					);
				await notifyRoom(c, boardId);
				return c.json({ ok: true });
			});

			ctx.routes.register({ path: "/api/boards", app });
		},
	};
}
