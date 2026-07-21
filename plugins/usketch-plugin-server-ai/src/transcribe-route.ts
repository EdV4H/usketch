import type { HonoEnv } from "@edv4h/usketch-server-core";
import { and, eq } from "drizzle-orm";
import type { SQLiteTableWithColumns } from "drizzle-orm/sqlite-core";
import type { Hono } from "hono";

/** Board access tables (same as the OpenUI route). */
export interface TranscribeRouteSchema {
	// biome-ignore lint/suspicious/noExplicitAny: table shape varies by app schema
	boards: SQLiteTableWithColumns<any>;
	// biome-ignore lint/suspicious/noExplicitAny: table shape varies by app schema
	boardMembers: SQLiteTableWithColumns<any>;
}

export interface RegisterTranscribeRouteOptions {
	schema: TranscribeRouteSchema;
	/** Override the upstream transcription endpoint (tests / self-hosted). */
	upstreamUrl?: string;
	/** Transcription model. Default "whisper-1". */
	model?: string;
}

const DEFAULT_UPSTREAM = "https://api.openai.com/v1/audio/transcriptions";
/** OpenAI's audio upload limit is 25 MB. */
const MAX_AUDIO_BYTES = 25_000_000;

/** Map an audio MIME type to a filename extension OpenAI accepts. */
function extFor(mime: string): string {
	if (mime.includes("mp4") || mime.includes("m4a")) return "mp4";
	if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
	if (mime.includes("wav")) return "wav";
	if (mime.includes("ogg")) return "ogg";
	return "webm";
}

/**
 * Mount `POST /transcribe`: accepts a raw audio body and forwards it to OpenAI
 * Whisper using the server's `OPENAI_API_KEY`, returning `{ text }`. This is the
 * server-side transcription path (no Google dependency), used by the voice-notes
 * Whisper transcriber when the browser Web Speech API is unavailable/blocked.
 * Enforces board access when `?boardId=...` is supplied, mirroring the AI routes.
 */
export function registerTranscribeRoute(
	app: Hono<HonoEnv>,
	options: RegisterTranscribeRouteOptions,
): void {
	const { schema, upstreamUrl = DEFAULT_UPSTREAM, model = "whisper-1" } = options;
	const { boards, boardMembers } = schema;

	app.post("/transcribe", async (c) => {
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

		const mime = c.req.header("content-type") ?? "audio/webm";
		const bytes = await c.req.arrayBuffer();
		if (bytes.byteLength === 0) return c.json({ error: "Empty audio" }, 400);
		if (bytes.byteLength > MAX_AUDIO_BYTES) return c.json({ error: "Audio too large" }, 413);

		const form = new FormData();
		form.append("file", new File([bytes], `audio.${extFor(mime)}`, { type: mime }));
		form.append("model", model);
		const lang = c.req.query("lang");
		if (lang) form.append("language", lang);

		let upstream: Response;
		try {
			upstream = await fetch(upstreamUrl, {
				method: "POST",
				headers: { Authorization: `Bearer ${apiKey}` },
				body: form,
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

		const data = (await upstream.json()) as { text?: unknown };
		return c.json({ text: typeof data.text === "string" ? data.text : "" });
	});
}
