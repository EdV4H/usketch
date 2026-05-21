import type { GenerateOptions, OpenUIProvider } from "./types.js";

export interface OpenAICompatibleProviderOptions {
	/** Default `"https://api.openai.com/v1"`. Override for Ollama, LiteLLM, Azure, etc. */
	baseURL?: string;
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
 * (api.openai.com, Azure OpenAI, Ollama, vLLM, LiteLLM, a self-hosted
 * OpenUI server, …). Streams SSE deltas as `AsyncIterable<string>`.
 */
export function createOpenAICompatibleProvider(
	options: OpenAICompatibleProviderOptions = {},
): OpenUIProvider {
	const {
		baseURL = "https://api.openai.com/v1",
		apiKey,
		defaultModel = "gpt-4o",
		availableModels,
		extraHeaders,
		supportsVision = true,
		label = "OpenAI-compatible",
	} = options;

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

			const response = await fetch(`${baseURL}/chat/completions`, {
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
 * `data: [DONE]`.
 */
async function* parseOpenAIStream(response: Response): AsyncIterable<string> {
	const body = response.body;
	if (!body) return;
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
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
				if (!line.startsWith("data:")) continue;
				const data = line.slice(5).trimStart();
				if (data === "[DONE]") return;
				if (!data) continue;
				let parsed: { choices?: { delta?: { content?: string } }[] };
				try {
					parsed = JSON.parse(data);
				} catch {
					continue;
				}
				const content = parsed.choices?.[0]?.delta?.content;
				if (typeof content === "string" && content.length > 0) yield content;
			}
		}
	} finally {
		reader.releaseLock();
	}
}
