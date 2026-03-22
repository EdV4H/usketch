import type { HonoEnv, ServerPlugin } from "@edv4h/usketch-server-core";
import { Hono } from "hono";

/**
 * Auth プラグインを生成する。
 * Better Auth のハンドラは apps/server 側で注入する（server-core は auth ライブラリに依存しない）。
 */
export function createAuthPlugin(options: {
	handler: (req: Request, env: Record<string, unknown>) => Response | Promise<Response>;
}): ServerPlugin {
	return {
		id: "server-auth",
		name: "認証",
		setup(ctx) {
			const app = new Hono<HonoEnv>();
			app.on(["GET", "POST"], "/*", async (c) => {
				return options.handler(c.req.raw, c.env);
			});
			ctx.routes.register({ path: "/api/auth", app, public: true });
		},
	};
}
