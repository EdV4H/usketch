import type { MiddlewareHandler } from "hono";

/**
 * 認証ミドルウェア
 * Week 3-4 で Better Auth 統合時に実装を更新する。
 * 現時点では開発用にヘッダーからユーザーIDを取得するスタブ実装。
 */
export const authMiddleware: MiddlewareHandler<{
	Variables: {
		userId: string;
	};
}> = async (c, next) => {
	// TODO: Better Auth セッション検証に置き換え
	const userId = c.req.header("X-User-Id") ?? "dev-user";
	c.set("userId", userId);
	await next();
};
