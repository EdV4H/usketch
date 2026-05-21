import { createOpenAICompatibleProvider } from "./openai-compatible.js";
import type { OpenUIProvider } from "./types.js";

export interface OpenAIProviderOptions {
	apiKey: string;
	baseURL?: string;
	defaultModel?: string;
	availableModels?: string[];
}

/**
 * Thin wrapper around {@link createOpenAICompatibleProvider} pre-configured for
 * `api.openai.com`. Exists as a separate factory so the side panel can list
 * "OpenAI" with a recognizable label without exposing the host to the
 * compatibility plumbing.
 */
export function createOpenAIProvider(options: OpenAIProviderOptions): OpenUIProvider {
	const {
		apiKey,
		baseURL = "https://api.openai.com/v1",
		defaultModel = "gpt-4o",
		availableModels = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
	} = options;
	const provider = createOpenAICompatibleProvider({
		baseURL,
		apiKey,
		defaultModel,
		availableModels,
		supportsVision: true,
		label: "OpenAI",
	});
	return { ...provider, id: "openai" };
}
