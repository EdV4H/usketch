/**
 * Image input for vision-capable providers (e.g. used by the "Make Real" flow
 * which snapshots the canvas selection and feeds it to a multimodal model).
 */
export interface VisionInput {
	/** `data:image/png;base64,…` style URL preferred. Remote `https://` URLs also work for OpenAI. */
	imageDataUrl: string;
	width?: number;
	height?: number;
}

export interface GenerateOptions {
	/** When `true`, return token-by-token deltas. When `false`, yield one chunk. Defaults to `true`. */
	stream?: boolean;
	model?: string;
	vision?: VisionInput;
	/** Caller-controlled abort signal so the side-panel "Cancel" button can interrupt. */
	signal?: AbortSignal;
	/** Override the system prompt for this single request. */
	systemPrompt?: string;
}

export type ProviderId = "openai" | "openai-compatible";

/**
 * Provider abstraction. All implementations expose a single async-iterable
 * `generate()` so the calling code is uniform regardless of streaming mode.
 */
export interface OpenUIProvider {
	id: ProviderId;
	/** Human-readable label (e.g. shown next to "Generated via …" in the side panel). */
	label: string;
	defaultModel: string;
	/**
	 * Optional list of additional model names. Reserved for a future side-panel
	 * model selector — not consumed by the current UI, but providers should
	 * still populate it accurately so hosts can build their own selector.
	 */
	availableModels?: string[];
	supportsVision: boolean;
	/**
	 * Generate text deltas (OpenUI Lang source) for a user prompt. Always
	 * returns an async iterable, even for non-streaming providers (which
	 * yield a single chunk with the full response).
	 */
	generate(prompt: string, options: GenerateOptions): AsyncIterable<string>;
}
