import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import { ALLOWED_ORIGINS } from "./config.js";
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
		trustedOrigins: ALLOWED_ORIGINS,
		emailAndPassword: {
			enabled: false,
		},
		session: {
			cookieCache: {
				enabled: false,
			},
		},
		advanced: {
			defaultCookieAttributes:
				env.DEV_MODE === "true"
					? { sameSite: "lax", secure: false }
					: { sameSite: "none", secure: true },
		},
	});
}

export type Auth = ReturnType<typeof createAuth>;
