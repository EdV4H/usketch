import type { GenerateOptions, OpenUIProvider } from "./types.js";

export interface OpenAICompatibleProviderOptions {
	/**
	 * Base URL, with or without a trailing slash. Defaults to
	 * `https://api.openai.com/v1`. By default the request is sent to
	 * `<baseURL>/chat/completions` using `Authorization: Bearer <apiKey>`.
	 * Override `endpoint` if your server uses a different path or query string,
	 * and pass `extraHeaders` to swap the auth header.
	 */
	baseURL?: string;
	/**
	 * Full chat-completions URL (overrides `baseURL`-based construction).
	 * Use this for endpoints that require query parameters such as Azure
	 * OpenAI (`https://<resource>.openai.azure.com/openai/deployments/<dep>/chat/completions?api-version=2024-...`).
	 */
	endpoint?: string;
	/** Sent as `Authorization: Bearer <apiKey>`. Optional for self-hosted endpoints. */
	apiKey?: string;
	defaultModel?: string;
	availableModels?: string[];
	extraHeaders?: Record<string, string>;
	supportsVision?: boolean;
	label?: string;
}

/**
 * Generic provider for any OpenAI-compatible Chat Completions endpoint
 * (api.openai.com, Ollama, vLLM, LiteLLM, a self-hosted OpenUI server,
 * …). Streams SSE deltas as `AsyncIterable<string>`.
 *
 * **Not fully covered**: Azure OpenAI needs a different URL shape
 * (`/openai/deployments/<name>/chat/completions?api-version=...`) plus an
 * `api-key` header instead of `Authorization: Bearer`. Pass the full URL via
 * `endpoint` and the auth header via `extraHeaders` if you need that
 * variant — a dedicated factory may land later.
 */
export function createOpenAICompatibleProvider(
	options: OpenAICompatibleProviderOptions = {},
): OpenUIProvider {
	const {
		baseURL = "https://api.openai.com/v1",
		endpoint,
		apiKey,
		defaultModel = "gpt-4o",
		availableModels,
		extraHeaders,
		supportsVision = true,
		label = "OpenAI-compatible",
	} = options;
	// Resolve a stable URL once at factory time. URL handles trailing slashes,
	// allows future query-param overrides, and rejects malformed inputs early.
	const resolvedEndpoint =
		endpoint ?? new URL("chat/completions", ensureTrailingSlash(baseURL)).toString();

	return {
		id: "openai-compatible",
		label,
		defaultModel,
		availableModels,
		supportsVision,
		async *generate(prompt: string, opts: GenerateOptions): AsyncIterable<string> {
			const stream = opts.stream ?? true;
			const headers: Record<string, string> = {
				"Content-Type": "application/json",
				...extraHeaders,
			};
			if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

			const userContent =
				opts.vision && supportsVision
					? [
							{ type: "text", text: prompt },
							{ type: "image_url", image_url: { url: opts.vision.imageDataUrl } },
						]
					: prompt;

			const messages = [
				...(opts.systemPrompt ? [{ role: "system", content: opts.systemPrompt }] : []),
				{ role: "user", content: userContent },
			];

			const response = await fetch(resolvedEndpoint, {
				method: "POST",
				headers,
				signal: opts.signal,
				body: JSON.stringify({
					model: opts.model ?? defaultModel,
					stream,
					temperature: 0.2,
					messages,
				}),
			});

			if (!response.ok) {
				const body = await response.text().catch(() => "");
				throw new Error(`OpenUI provider ${response.status}: ${body || response.statusText}`);
			}

			if (!stream) {
				const data = (await response.json()) as {
					choices?: { message?: { content?: string } }[];
				};
				const text = data.choices?.[0]?.message?.content ?? "";
				if (text) yield text;
				return;
			}

			yield* parseOpenAIStream(response);
		},
	};
}

/**
 * Parse an OpenAI-style SSE stream into a flat sequence of content deltas.
 * Handles partial lines across chunk boundaries and stops cleanly on
 * `data: [DONE]`. After the read loop ends, flushes any residual `data:` line
 * that wasn't followed by a trailing newline — some servers terminate the
 * stream without a final `\n\n`.
 */
async function* parseOpenAIStream(response: Response): AsyncIterable<string> {
	const body = response.body;
	if (!body) return;
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	/** Try to interpret one trimmed line as an OpenAI SSE delta. */
	function extractDelta(line: string): { content?: string; done: boolean } {
		if (!line.startsWith("data:")) return { done: false };
		const data = line.slice(5).trimStart();
		if (data === "[DONE]") return { done: true };
		if (!data) return { done: false };
		try {
			const parsed = JSON.parse(data) as {
				choices?: { delta?: { content?: string } }[];
			};
			return { content: parsed.choices?.[0]?.delta?.content, done: false };
		} catch {
			return { done: false };
		}
	}

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			let nl = buffer.indexOf("\n");
			while (nl !== -1) {
				const line = buffer.slice(0, nl).trimEnd();
				buffer = buffer.slice(nl + 1);
				nl = buffer.indexOf("\n");
				const { content, done: terminated } = extractDelta(line);
				if (terminated) return;
				if (typeof content === "string" && content.length > 0) yield content;
			}
		}
		// Flush the final un-newline-terminated line, if any.
		const tail = buffer.trim();
		if (tail.length > 0) {
			const { content, done: terminated } = extractDelta(tail);
			if (terminated) return;
			if (typeof content === "string" && content.length > 0) yield content;
		}
	} finally {
		reader.releaseLock();
	}
}

/** Append a trailing slash if missing; `new URL("chat/completions", base)`
 *  drops the last path segment of `base` when it doesn't end with `/`. */
function ensureTrailingSlash(url: string): string {
	return url.endsWith("/") ? url : `${url}/`;
}
