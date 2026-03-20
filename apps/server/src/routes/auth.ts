import { Hono } from "hono";

const authApp = new Hono();

// TODO: Week 3-4 で Better Auth を統合
// 現時点では認証スタブとして機能

authApp.get("/session", async (c) => {
	return c.json({ user: null });
});

export { authApp };
