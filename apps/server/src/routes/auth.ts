import { Hono } from "hono";
import { createAuth } from "../auth.js";
import type { Env } from "../types.js";

type AuthEnv = {
	Bindings: Env;
};

const authApp = new Hono<AuthEnv>();

// Better Auth handles all /api/auth/* routes
authApp.on(["GET", "POST"], "/*", async (c) => {
	const auth = createAuth(c.env);
	return auth.handler(c.req.raw);
});

export { authApp };
