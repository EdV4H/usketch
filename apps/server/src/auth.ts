import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./db/schema.js";
import type { Env } from "./types.js";

export function createAuth(env: Env) {
	const db = drizzle(env.DB, { schema });

	return betterAuth({
		database: drizzleAdapter(db, {
			provider: "sqlite",
			schema: {
				user: schema.users,
				session: schema.sessions,
				account: schema.accounts,
				verification: schema.verifications,
			},
		}),
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
		socialProviders: {
			...(env.GOOGLE_CLIENT_ID &&
				env.GOOGLE_CLIENT_SECRET && {
					google: {
						clientId: env.GOOGLE_CLIENT_ID,
						clientSecret: env.GOOGLE_CLIENT_SECRET,
					},
				}),
			...(env.GITHUB_CLIENT_ID &&
				env.GITHUB_CLIENT_SECRET && {
					github: {
						clientId: env.GITHUB_CLIENT_ID,
						clientSecret: env.GITHUB_CLIENT_SECRET,
					},
				}),
		},
		emailAndPassword: {
			enabled: true,
		},
		session: {
			cookieCache: {
				enabled: false, // Cloudflare KV との互換性問題を回避
			},
		},
	});
}

export type Auth = ReturnType<typeof createAuth>;
