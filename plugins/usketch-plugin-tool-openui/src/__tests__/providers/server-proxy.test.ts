import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServerProxyProvider } from "../../providers/server-proxy.js";

function sseStream(chunks: string[]): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	let i = 0;
	return new ReadableStream({
		pull(controller) {
			const chunk = chunks[i];
			if (chunk === undefined) {
				controller.close();
				return;
			}
			controller.enqueue(encoder.encode(chunk));
			i++;
		},
	});
}

describe("createServerProxyProvider", () => {
	const fetchMock = vi.fn();
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		fetchMock.mockReset();
		globalThis.fetch = fetchMock as unknown as typeof fetch;
	});
	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("POSTs to <apiUrl>/api/ai/openui with credentials: include", async () => {
		fetchMock.mockResolvedValueOnce(new Response(sseStream(["data: [DONE]\n\n"]), { status: 200 }));
		const provider = createServerProxyProvider({ apiUrl: "https://api.example.test" });
		for await (const _ of provider.generate("hi", {})) {
			// no-op
		}
		const [url, init] = fetchMock.mock.calls[0] ?? [];
		expect(url).toBe("https://api.example.test/api/ai/openui");
		expect((init as RequestInit).method).toBe("POST");
		expect((init as RequestInit).credentials).toBe("include");
	});

	it("forwards boardId as a query parameter when provided", async () => {
		fetchMock.mockResolvedValueOnce(new Response(sseStream(["data: [DONE]\n\n"]), { status: 200 }));
		const provider = createServerProxyProvider({
			apiUrl: "https://api.example.test",
			boardId: "board-123",
		});
		for await (const _ of provider.generate("hi", {})) {
			// no-op
		}
		const url = fetchMock.mock.calls[0]?.[0];
		expect(url).toBe("https://api.example.test/api/ai/openui?boardId=board-123");
	});

	it("omits the boardId query when not provided", async () => {
		fetchMock.mockResolvedValueOnce(new Response(sseStream(["data: [DONE]\n\n"]), { status: 200 }));
		const provider = createServerProxyProvider({ apiUrl: "https://api.example.test" });
		for await (const _ of provider.generate("hi", {})) {
			// no-op
		}
		const url = fetchMock.mock.calls[0]?.[0] as string;
		expect(url.includes("boardId")).toBe(false);
	});

	it("merges extraHeaders into the fetch headers", async () => {
		fetchMock.mockResolvedValueOnce(new Response(sseStream(["data: [DONE]\n\n"]), { status: 200 }));
		const provider = createServerProxyProvider({
			apiUrl: "https://api.example.test",
			extraHeaders: { "X-User-Id": "user-42" },
		});
		for await (const _ of provider.generate("hi", {})) {
			// no-op
		}
		const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
		const headers = init.headers as Record<string, string>;
		expect(headers["X-User-Id"]).toBe("user-42");
		expect(headers["Content-Type"]).toBe("application/json");
		// No Authorization header — the server attaches it.
		expect(headers.Authorization).toBeUndefined();
	});

	it("sends an OpenAI-compatible body shape", async () => {
		fetchMock.mockResolvedValueOnce(new Response(sseStream(["data: [DONE]\n\n"]), { status: 200 }));
		const provider = createServerProxyProvider({
			apiUrl: "https://api.example.test",
			defaultModel: "gpt-4o-mini",
		});
		for await (const _ of provider.generate("hello", { systemPrompt: "be brief" })) {
			// no-op
		}
		const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
		const body = JSON.parse(init.body as string);
		expect(body.model).toBe("gpt-4o-mini");
		expect(body.stream).toBe(true);
		expect(body.messages).toEqual([
			{ role: "system", content: "be brief" },
			{ role: "user", content: "hello" },
		]);
	});

	it("streams SSE deltas as an AsyncIterable<string>", async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(
				sseStream([
					`data: ${JSON.stringify({ choices: [{ delta: { content: "Hello" } }] })}\n\n`,
					`data: ${JSON.stringify({ choices: [{ delta: { content: ", world" } }] })}\n\n`,
					"data: [DONE]\n\n",
				]),
				{ status: 200 },
			),
		);
		const provider = createServerProxyProvider({ apiUrl: "https://api.example.test" });
		const chunks: string[] = [];
		for await (const c of provider.generate("hi", {})) chunks.push(c);
		expect(chunks.join("")).toBe("Hello, world");
	});

	it("throws when the server returns a 4xx response", async () => {
		fetchMock.mockResolvedValueOnce(
			new Response("Unauthorized", { status: 401, statusText: "Unauthorized" }),
		);
		const provider = createServerProxyProvider({ apiUrl: "https://api.example.test" });
		await expect(async () => {
			for await (const _ of provider.generate("hi", {})) {
				// no-op
			}
		}).rejects.toThrow(/401/);
	});

	it("supports a custom routePath override", async () => {
		fetchMock.mockResolvedValueOnce(new Response(sseStream(["data: [DONE]\n\n"]), { status: 200 }));
		const provider = createServerProxyProvider({
			apiUrl: "https://api.example.test",
			routePath: "/v2/ai/openui",
		});
		for await (const _ of provider.generate("hi", {})) {
			// no-op
		}
		const url = fetchMock.mock.calls[0]?.[0];
		expect(url).toBe("https://api.example.test/v2/ai/openui");
	});

	it("tolerates apiUrl with a trailing slash", async () => {
		fetchMock.mockResolvedValueOnce(new Response(sseStream(["data: [DONE]\n\n"]), { status: 200 }));
		const provider = createServerProxyProvider({ apiUrl: "https://api.example.test/" });
		for await (const _ of provider.generate("hi", {})) {
			// no-op
		}
		const url = fetchMock.mock.calls[0]?.[0];
		expect(url).toBe("https://api.example.test/api/ai/openui");
	});

	it("exposes id: 'server-proxy'", () => {
		const provider = createServerProxyProvider({ apiUrl: "https://api.example.test" });
		expect(provider.id).toBe("server-proxy");
	});
});
