import type { MiddlewareHandler } from "hono";
import { createAuth } from "../auth.js";
import type { Env } from "../types.js";

/**
 * 認証ミドルウェア
 * Better Auth のセッションを検証し、userId を設定する。
 * DEV_MODE が有効な場合は X-User-Id ヘッダーも受け付ける（開発用）。
 */
export const authMiddleware: MiddlewareHandler<{
	Bindings: Env;
	Variables: {
		userId: string;
	};
}> = async (c, next) => {
	// 開発モード: X-User-Id ヘッダーまたは devUserId クエリパラメータを受け付ける
	// 本番環境では DEV_MODE が有効でも無視する（誤設定による認証バイパス防止）
	if (c.env.DEV_MODE === "true" && c.env.ENVIRONMENT !== "production") {
		const devUserId = c.req.header("X-User-Id") || c.req.query("devUserId");
		if (devUserId) {
			c.set("userId", devUserId);
			await next();
			return;
		}
	}

	// Better Auth セッション検証
	const auth = createAuth(c.env);
	const session = await auth.api.getSession({ headers: c.req.raw.headers });

	if (!session) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	c.set("userId", session.user.id);
	await next();
};
