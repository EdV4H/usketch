import type { MiddlewareHandler } from "hono";
import type { Env } from "../types.js";

/**
 * 認証ミドルウェア
 * Week 3-4 で Better Auth 統合時に実装を更新する。
 * DEV_MODE 環境変数が設定されている場合のみ X-User-Id ヘッダーを受け付ける。
 */
export const authMiddleware: MiddlewareHandler<{
	Bindings: Env;
	Variables: {
		userId: string;
	};
}> = async (c, next) => {
	// TODO: Better Auth セッション検証に置き換え
	if (c.env.DEV_MODE === "true") {
		const userId = c.req.header("X-User-Id");
		if (userId) {
			c.set("userId", userId);
			await next();
			return;
		}
	}

	return c.json({ error: "Unauthorized" }, 401);
};
