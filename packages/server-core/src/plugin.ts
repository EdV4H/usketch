import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { Hono } from "hono";

/**
 * サーバープラグインで使用する Hono の型環境。
 * apps/server の types.ts にある Env と同じ Bindings を想定するが、
 * server-core は apps/server に依存しないため、Bindings を generic にして
 * createServerApp 側で具体型を注入する。
 */
export type HonoEnv = {
	Bindings: Record<string, unknown>;
	Variables: {
		db: DrizzleD1Database<Record<string, unknown>>;
		userId: string;
	};
};

/**
 * ルート登録エントリ。
 * public: true の場合、auth middleware をスキップしてマウントされる。
 */
export interface RouteEntry {
	path: string;
	app: Hono<HonoEnv>;
	public?: boolean;
}

/**
 * ルートレジストリ。プラグインが setup() 内でルートを登録する。
 */
export interface RouteRegistry {
	register(entry: RouteEntry): void;
	getPublicRoutes(): readonly RouteEntry[];
	getProtectedRoutes(): readonly RouteEntry[];
}

/**
 * サーバー用 EventBus。フロントエンドの EventBus と同じ Map<string, Set> パターン。
 */
export interface ServerEventBus {
	on<T = unknown>(event: string, handler: (data: T) => void): () => void;
	emit<T = unknown>(event: string, data: T): void;
}

/**
 * プラグインの setup() に渡されるコンテキスト。
 */
export interface ServerPluginContext {
	routes: RouteRegistry;
	events: ServerEventBus;
}

/**
 * サーバープラグインインターフェース。
 * フロントエンドの UsketchPlugin に対応するサーバー版。
 */
export interface ServerPlugin {
	readonly id: string;
	readonly name: string;
	setup(ctx: ServerPluginContext): void | Promise<void>;
}
