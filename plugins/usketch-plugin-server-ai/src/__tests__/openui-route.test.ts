import type { HonoEnv } from "@edv4h/usketch-server-core";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerOpenUIRoute } from "../openui-route.js";

/**
 * Fake drizzle query chain. The real `registerOpenUIRoute` calls:
 *   db.select(...).from(boards).leftJoin(...).where(...).limit(1)
 * so each method just returns the same object until `limit()` resolves to
 * the rows we want for this test case.
 */
function makeFakeDb(rows: Array<{ isPublic: boolean; role: string | null }>) {
	const chain = {
		select: () => chain,
		from: () => chain,
		leftJoin: () => chain,
		where: () => chain,
		limit: async () => rows,
	};
	return chain;
}

const SCHEMA = {
	boards: { id: "boards.id", isPublic: "boards.isPublic" } as any,
	boardMembers: {
		boardId: "boardMembers.boardId",
		userId: "boardMembers.userId",
		role: "boardMembers.role",
	} as any,
};

function buildApp(opts: {
	userId?: string;
	apiKey?: string;
	db?: ReturnType<typeof makeFakeDb>;
	upstreamUrl?: string;
}) {
	const { userId, db, upstreamUrl = "https://upstream.test/v1/chat/completions" } = opts;
	const app = new Hono<HonoEnv>();
	// inject fake auth + db middleware to mimic the real server pipeline
	app.use("*", async (c, next) => {
		if (userId) c.set("userId", userId);
		if (db) c.set("db", db as never);
		await next();
	});
	registerOpenUIRoute(app, { schema: SCHEMA, upstreamUrl });
	return app;
}

async function requestApp(
	app: Hono<HonoEnv>,
	path: string,
	body: unknown,
	apiKey: string | undefined,
) {
	const env = apiKey ? { OPENAI_API_KEY: apiKey } : {};
	return app.request(
		path,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		},
		env,
	);
}

const VALID_BODY = {
	model: "gpt-4o",
	stream: true,
	messages: [{ role: "user" as const, content: "hello" }],
};

describe("registerOpenUIRoute", () => {
	const fetchMock = vi.fn();
	const originalFetch = globalThis.fetch;
	beforeEach(() => {
		fetchMock.mockReset();
		globalThis.fetch = fetchMock as unknown as typeof fetch;
	});
	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("returns 401 when there is no userId", async () => {
		const app = buildApp({ apiKey: "sk-x" });
		const res = await requestApp(app, "/openui", VALID_BODY, "sk-x");
		expect(res.status).toBe(401);
	});

	it("returns 500 when OPENAI_API_KEY is not configured", async () => {
		const app = buildApp({ userId: "u-1" });
		const res = await requestApp(app, "/openui", VALID_BODY, undefined);
		expect(res.status).toBe(500);
		expect(await res.json()).toMatchObject({ error: expect.stringMatching(/OPENAI_API_KEY/) });
	});

	it("forwards stream=true upstream and pass-throughs SSE bytes", async () => {
		const sse = new ReadableStream({
			start(controller) {
				controller.enqueue(new TextEncoder().encode('data: {"x":1}\n\n'));
				controller.close();
			},
		});
		fetchMock.mockResolvedValueOnce(new Response(sse, { status: 200 }));
		const app = buildApp({ userId: "u-1", apiKey: "sk-x" });

		const res = await requestApp(app, "/openui", VALID_BODY, "sk-x");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);
		const text = await res.text();
		expect(text).toBe('data: {"x":1}\n\n');

		// Upstream call used our key + url + forwarded body
		const [url, init] = fetchMock.mock.calls[0] ?? [];
		expect(url).toBe("https://upstream.test/v1/chat/completions");
		const initHeaders = (init as RequestInit).headers as Record<string, string>;
		expect(initHeaders.Authorization).toBe("Bearer sk-x");
		expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
			model: "gpt-4o",
			stream: true,
		});
	});

	it("returns upstream JSON verbatim for stream=false", async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ choices: [{ message: { content: "done" } }] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);
		const app = buildApp({ userId: "u-1", apiKey: "sk-x" });
		const res = await requestApp(app, "/openui", { ...VALID_BODY, stream: false }, "sk-x");
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ choices: [{ message: { content: "done" } }] });
	});

	it("checks board access when boardId is provided (non-member, non-public → 404)", async () => {
		const db = makeFakeDb([{ isPublic: false, role: null }]);
		const app = buildApp({ userId: "u-1", apiKey: "sk-x", db });
		const res = await requestApp(app, "/openui?boardId=b-1", VALID_BODY, "sk-x");
		expect(res.status).toBe(404);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("allows access when boardId points at a public board (non-member)", async () => {
		const db = makeFakeDb([{ isPublic: true, role: null }]);
		fetchMock.mockResolvedValueOnce(
			new Response(new ReadableStream({ start: (c) => c.close() }), { status: 200 }),
		);
		const app = buildApp({ userId: "u-1", apiKey: "sk-x", db });
		const res = await requestApp(app, "/openui?boardId=b-1", VALID_BODY, "sk-x");
		expect(res.status).toBe(200);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("allows access when boardId points at a board the user is a member of", async () => {
		const db = makeFakeDb([{ isPublic: false, role: "editor" }]);
		fetchMock.mockResolvedValueOnce(
			new Response(new ReadableStream({ start: (c) => c.close() }), { status: 200 }),
		);
		const app = buildApp({ userId: "u-1", apiKey: "sk-x", db });
		const res = await requestApp(app, "/openui?boardId=b-1", VALID_BODY, "sk-x");
		expect(res.status).toBe(200);
	});

	it("returns 404 when boardId does not exist", async () => {
		const db = makeFakeDb([]);
		const app = buildApp({ userId: "u-1", apiKey: "sk-x", db });
		const res = await requestApp(app, "/openui?boardId=b-missing", VALID_BODY, "sk-x");
		expect(res.status).toBe(404);
	});

	it("skips board access check when boardId is omitted", async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(new ReadableStream({ start: (c) => c.close() }), { status: 200 }),
		);
		const app = buildApp({ userId: "u-1", apiKey: "sk-x" });
		const res = await requestApp(app, "/openui", VALID_BODY, "sk-x");
		expect(res.status).toBe(200);
	});

	it("returns 502 on upstream 5xx", async () => {
		fetchMock.mockResolvedValueOnce(new Response("rate limited", { status: 503 }));
		const app = buildApp({ userId: "u-1", apiKey: "sk-x" });
		const res = await requestApp(app, "/openui", VALID_BODY, "sk-x");
		expect(res.status).toBe(502);
	});

	it("returns 502 when upstream fetch throws", async () => {
		fetchMock.mockRejectedValueOnce(new Error("ECONNRESET"));
		const app = buildApp({ userId: "u-1", apiKey: "sk-x" });
		const res = await requestApp(app, "/openui", VALID_BODY, "sk-x");
		expect(res.status).toBe(502);
		expect(await res.json()).toMatchObject({ error: expect.stringMatching(/ECONNRESET/) });
	});

	it("rejects bodies with no messages (zod 400)", async () => {
		const app = buildApp({ userId: "u-1", apiKey: "sk-x" });
		const res = await requestApp(app, "/openui", { messages: [] }, "sk-x");
		expect(res.status).toBe(400);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("rejects oversized image_url payloads (>10MB)", async () => {
		const huge = "x".repeat(10_000_001);
		const app = buildApp({ userId: "u-1", apiKey: "sk-x" });
		const res = await requestApp(
			app,
			"/openui",
			{
				messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: huge } }] }],
			},
			"sk-x",
		);
		expect(res.status).toBe(400);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("strips unknown extra fields like `tools` from the forwarded body", async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(new ReadableStream({ start: (c) => c.close() }), { status: 200 }),
		);
		const app = buildApp({ userId: "u-1", apiKey: "sk-x" });
		const res = await requestApp(
			app,
			"/openui",
			{ ...VALID_BODY, tools: [{ type: "function", function: { name: "x" } }] },
			"sk-x",
		);
		expect(res.status).toBe(200);
		const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
		const forwarded = JSON.parse(init.body as string);
		expect(forwarded.tools).toBeUndefined();
	});
});
