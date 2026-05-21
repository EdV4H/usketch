import type { Library } from "@openuidev/react-lang";
import type { OpenUIProvider } from "./providers/types.js";

/**
 * Options for {@link createOpenUIToolPlugin}.
 *
 * The plugin connects the host to an LLM provider, registers a toolbar tool
 * plus a side-panel tab for prompt input, and (optionally) a "Make Real"
 * button anchored to the current selection.
 */
export interface OpenUIToolOptions {
	/** Concrete provider (created via one of the `createXxxProvider` helpers). */
	provider: OpenUIProvider;
	/**
	 * Override the default component library that defines what UI primitives
	 * the LLM is allowed to emit. Pass `createLibrary([...])` from
	 * `@openuidev/react-lang`. When omitted, the plugin uses its bundled
	 * default library (~12 generic components).
	 */
	library?: Library;
	/** Identifier persisted alongside generated shapes. Defaults to `"openui-default"`. */
	libraryId?: string;
	/** Override the provider's default model. */
	model?: string;
	/**
	 * Show the "Make Real" button on the current selection. Requires the
	 * provider to support vision input. Defaults to `provider.supportsVision`.
	 */
	enableMakeReal?: boolean;
	/** Replace the generated system prompt with a custom one. Advanced. */
	systemPrompt?: string;
	/** Hard timeout for in-flight generation, in milliseconds. Defaults to 60_000. */
	timeoutMs?: number;
}

/** Payload of the internal `openui:generate-request` event. */
export interface OpenUIGenerateRequest {
	prompt: string;
	vision?: { imageDataUrl: string; width?: number; height?: number };
}
