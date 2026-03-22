import type { MiddlewareHandler } from "hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type {
	HonoEnv,
	RouteEntry,
	RouteRegistry,
	ServerPlugin,
	ServerPluginContext,
} from "./plugin.js";
import { createServerEventBus } from "./server-event-bus.js";

function createRouteRegistry(): RouteRegistry {
	const publicRoutes: RouteEntry[] = [];
	const protectedRoutes: RouteEntry[] = [];

	return {
		register(entry: RouteEntry): void {
			if (entry.public) {
				publicRoutes.push(entry);
			} else {
				protectedRoutes.push(entry);
			}
		},
		getPublicRoutes(): readonly RouteEntry[] {
			return publicRoutes;
		},
		getProtectedRoutes(): readonly RouteEntry[] {
			return protectedRoutes;
		},
	};
}

export interface CreateServerAppOptions {
	plugins: ServerPlugin[];
	corsOrigins: string[];
	authMiddleware: MiddlewareHandler<HonoEnv>;
	dbMiddleware: MiddlewareHandler<HonoEnv>;
}

/**
 * プラグインを順次 setup し、Hono アプリを組み立てて返す。
 *
 * 1. レジストリ作成（routes, events）
 * 2. 各プラグインの setup(ctx) を順次実行
 * 3. CORS 適用
 * 4. Health check
 * 5. public routes マウント（auth 等）
 * 6. auth middleware + DB injection
 * 7. protected routes マウント（boards, comments, ai, ws）
 * 8. Hono app を返す
 */
export async function createServerApp(options: CreateServerAppOptions): Promise<Hono<HonoEnv>> {
	const { plugins, corsOrigins, authMiddleware, dbMiddleware } = options;

	// 1. レジストリ作成
	const routes = createRouteRegistry();
	const events = createServerEventBus();
	const ctx: ServerPluginContext = { routes, events };

	// 2. 各プラグインの setup を順次実行
	for (const plugin of plugins) {
		await plugin.setup(ctx);
	}

	// 3. Hono app 組み立て
	const app = new Hono<HonoEnv>();

	// CORS
	app.use(
		"*",
		cors({
			origin: corsOrigins,
			credentials: true,
		}),
	);

	// 4. Health check
	app.get("/", (c) => c.json({ status: "ok", name: "usketch-server" }));

	// 5. Public routes（auth middleware をスキップ）
	for (const route of routes.getPublicRoutes()) {
		app.route(route.path, route.app);
	}

	// 6. Auth middleware + DB injection（/api/* に適用）
	app.use("/api/*", authMiddleware);
	app.use("/api/*", dbMiddleware);

	// 7. Protected routes
	for (const route of routes.getProtectedRoutes()) {
		app.route(route.path, route.app);
	}

	return app;
}
