import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOpenAICompatibleProvider } from "../../providers/openai-compatible.js";

/** Build a ReadableStream from a sequence of SSE bytes. */
function sseStream(chunks: string[]): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	let i = 0;
	return new ReadableStream({
		pull(controller) {
			if (i >= chunks.length) {
				controller.close();
				return;
			}
			controller.enqueue(encoder.encode(chunks[i]!));
			i++;
		},
	});
}

describe("createOpenAICompatibleProvider", () => {
	const fetchMock = vi.fn();
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		fetchMock.mockReset();
		globalThis.fetch = fetchMock as unknown as typeof fetch;
	});
	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("posts to <baseURL>/chat/completions with Authorization and JSON body", async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(
				sseStream([
					`data: ${JSON.stringify({ choices: [{ delta: { content: "ok" } }] })}\n\n`,
					"data: [DONE]\n\n",
				]),
				{
					status: 200,
				},
			),
		);
		const provider = createOpenAICompatibleProvider({
			baseURL: "https://example.test/v1",
			apiKey: "sk-test",
			defaultModel: "test-model",
		});
		const chunks: string[] = [];
		for await (const c of provider.generate("hello", { stream: true, systemPrompt: "be brief" })) {
			chunks.push(c);
		}
		expect(chunks.join("")).toBe("ok");

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0]!;
		expect(url).toBe("https://example.test/v1/chat/completions");
		expect((init as RequestInit).method).toBe("POST");
		const headers = (init as RequestInit).headers as Record<string, string>;
		expect(headers.Authorization).toBe("Bearer sk-test");
		expect(headers["Content-Type"]).toBe("application/json");
		const body = JSON.parse((init as RequestInit).body as string);
		expect(body.model).toBe("test-model");
		expect(body.stream).toBe(true);
		expect(body.messages).toEqual([
			{ role: "system", content: "be brief" },
			{ role: "user", content: "hello" },
		]);
	});

	it("attaches image content for vision input", async () => {
		fetchMock.mockResolvedValueOnce(new Response(sseStream(["data: [DONE]\n\n"]), { status: 200 }));
		const provider = createOpenAICompatibleProvider({ apiKey: "sk-x", supportsVision: true });
		const iter = provider.generate("make real", {
			vision: { imageDataUrl: "data:image/png;base64,AAA" },
		});
		// drain
		for await (const _ of iter) {
			// no-op
		}
		const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
		expect(body.messages[0].content).toEqual([
			{ type: "text", text: "make real" },
			{ type: "image_url", image_url: { url: "data:image/png;base64,AAA" } },
		]);
	});

	it("accumulates content across multiple SSE chunks", async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(
				sseStream([
					`data: ${JSON.stringify({ choices: [{ delta: { content: "Hello, " } }] })}\n\n`,
					`data: ${JSON.stringify({ choices: [{ delta: { content: "world!" } }] })}\n\n`,
					"data: [DONE]\n\n",
				]),
				{ status: 200 },
			),
		);
		const provider = createOpenAICompatibleProvider({ apiKey: "sk-x" });
		const all: string[] = [];
		for await (const c of provider.generate("hi", {})) all.push(c);
		expect(all).toEqual(["Hello, ", "world!"]);
	});

	it("throws on non-2xx response with body", async () => {
		fetchMock.mockResolvedValueOnce(
			new Response("rate limit", { status: 429, statusText: "Too Many Requests" }),
		);
		const provider = createOpenAICompatibleProvider({ apiKey: "sk-x" });
		await expect(async () => {
			for await (const _ of provider.generate("hi", {})) {
				// no-op
			}
		}).rejects.toThrow(/429/);
	});

	it("returns a single chunk when stream=false", async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ choices: [{ message: { content: "final answer" } }] }), {
				status: 200,
			}),
		);
		const provider = createOpenAICompatibleProvider({ apiKey: "sk-x" });
		const chunks: string[] = [];
		for await (const c of provider.generate("hi", { stream: false })) chunks.push(c);
		expect(chunks).toEqual(["final answer"]);
	});
});
