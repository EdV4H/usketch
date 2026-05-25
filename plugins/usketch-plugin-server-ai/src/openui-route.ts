import type { HonoEnv } from "@edv4h/usketch-server-core";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { SQLiteTableWithColumns } from "drizzle-orm/sqlite-core";
import type { Hono } from "hono";
import { z } from "zod";

/**
 * Schema for board access control (re-used from the AI plugin). We only
 * need the `boards` / `boardMembers` tables to enforce membership when
 * the client supplies a `?boardId=...` query.
 */
export interface OpenUIRouteSchema {
	boards: SQLiteTableWithColumns<any>;
	boardMembers: SQLiteTableWithColumns<any>;
}

/**
 * Max bytes for a single `image_url.url` payload. Matches the existing
 * `/api/ai/complete` `image` limit so vision attachments behave the same
 * across all AI endpoints.
 */
const MAX_IMAGE_URL_BYTES = 10_000_000;

const messageContentPart = z.union([
	z.object({ type: z.literal("text"), text: z.string().max(40_000) }),
	z.object({
		type: z.literal("image_url"),
		image_url: z.object({
			url: z.string().max(MAX_IMAGE_URL_BYTES),
			detail: z.enum(["low", "high", "auto"]).optional(),
		}),
	}),
]);

export const openuiCompletionSchema = z.object({
	model: z.string().min(1).max(64).default("gpt-4o"),
	stream: z.boolean().optional().default(true),
	temperature: z.number().min(0).max(2).optional(),
	messages: z
		.array(
			z.object({
				role: z.enum(["system", "user", "assistant"]),
				content: z.union([z.string().max(40_000), z.array(messageContentPart).max(8)]),
			}),
		)
		.min(1)
		.max(16),
});

export type OpenUICompletionBody = z.infer<typeof openuiCompletionSchema>;

export interface RegisterOpenUIRouteOptions {
	schema: OpenUIRouteSchema;
	/**
	 * Override the upstream Chat Completions endpoint. Defaults to OpenAI.
	 * Useful for tests (point at a mock) or self-hosted gateways.
	 */
	upstreamUrl?: string;
}

const DEFAULT_UPSTREAM = "https://api.openai.com/v1/chat/completions";

/**
 * Mount `POST /openui` on the provided AI sub-app. The route is an
 * OpenAI-compatible Chat Completions proxy: it validates the incoming
 * body, enforces board access control when `?boardId=...` is supplied,
 * and forwards the request to OpenAI using the server's `OPENAI_API_KEY`
 * secret. SSE responses are streamed back to the client as-is.
 */
export function registerOpenUIRoute(app: Hono<HonoEnv>, options: RegisterOpenUIRouteOptions): void {
	const { schema, upstreamUrl = DEFAULT_UPSTREAM } = options;
	const { boards, boardMembers } = schema;

	app.post("/openui", zValidator("json", openuiCompletionSchema), async (c) => {
		const userId = c.get("userId");
		if (!userId) return c.json({ error: "Unauthorized" }, 401);

		const apiKey = (c.env as { OPENAI_API_KEY?: string }).OPENAI_API_KEY;
		if (!apiKey) return c.json({ error: "OPENAI_API_KEY is not configured" }, 500);

		const boardId = c.req.query("boardId");
		if (boardId) {
			const db = c.get("db");
			if (!db) return c.json({ error: "Internal error" }, 500);
			const rows = await db
				.select({ isPublic: boards.isPublic, role: boardMembers.role })
				.from(boards)
				.leftJoin(
					boardMembers,
					and(eq(boards.id, boardMembers.boardId), eq(boardMembers.userId, userId)),
				)
				.where(eq(boards.id, boardId))
				.limit(1);
			if (rows.length === 0 || (rows[0].role === null && !rows[0].isPublic)) {
				return c.json({ error: "Not found" }, 404);
			}
		}

		const body = c.req.valid("json");

		let upstream: Response;
		try {
			upstream = await fetch(upstreamUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify(body),
				signal: c.req.raw.signal,
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : "Unknown error";
			return c.json({ error: `OpenAI upstream fetch failed: ${message}` }, 502);
		}

		if (!upstream.ok) {
			const errText = await upstream.text().catch(() => "");
			return c.json(
				{ error: `OpenAI upstream error: ${upstream.status} ${errText.slice(0, 500)}` },
				502,
			);
		}

		if (!body.stream) {
			const json = await upstream.json();
			return c.json(json as Record<string, unknown>);
		}

		return new Response(upstream.body, {
			status: 200,
			headers: {
				"Content-Type": "text/event-stream; charset=utf-8",
				"Cache-Control": "no-cache, no-transform",
				Connection: "keep-alive",
			},
		});
	});
}
