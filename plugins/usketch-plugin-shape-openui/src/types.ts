import type { ShapeData } from "@edv4h/usketch-shared";

/**
 * Intrinsic data for the `openui` shape — a Generative UI widget rendered
 * via `@openuidev/react-lang`'s `Renderer` from a snippet of OpenUI Lang.
 *
 * The lang source is plain text (OpenUI Lang DSL). The Renderer validates it
 * against the active library's Zod schemas at mount time, so invalid LLM
 * output cannot inject arbitrary HTML or scripts.
 */
export interface OpenUIShapeData extends ShapeData {
	/** Full OpenUI Lang DSL source for this widget. */
	langSource: string;
	/** Original user prompt that produced this widget. Useful for iterate / debug. */
	prompt: string;
	/** Model identifier that generated the response (e.g. `"gpt-4o"`). */
	model: string;
	/**
	 * Identifier of the library used to render this widget. Hosts that swap
	 * libraries between sessions can use this to warn or fall back when a
	 * persisted shape was generated against a different component set.
	 * Defaults to `"openui-default"`.
	 */
	libraryId: string;
}
