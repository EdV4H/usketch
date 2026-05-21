import type { Library } from "@openuidev/react-lang";
import { openuiDefaultLibrary } from "./default-library.js";

/**
 * Build the system prompt for OpenUI Lang generation. Delegates to the
 * library's own `prompt()` builder, which injects the component grammar,
 * Zod schema-derived prop docs, and reserved keywords automatically.
 *
 * Adding rules here is preferred over overriding the whole prompt because
 * the library-generated parts must stay in sync with the active component
 * set — drift causes the LLM to emit components the Renderer rejects.
 */
export function buildSystemPrompt(library: Library = openuiDefaultLibrary): string {
	return library.prompt({
		preamble:
			"You are a UI engineer building widget previews for a digital whiteboard. " +
			"Generate one self-contained widget per request — a single root component with sensible defaults.",
		additionalRules: [
			"- Output OpenUI Lang only. No prose, no markdown fences.",
			"- Prefer concrete copy and realistic placeholder content over Lorem Ipsum.",
			"- If a reference image is supplied, reproduce its structure, content, and color palette faithfully.",
			"- Default to compact widgets that fit comfortably in a 480x360 canvas card.",
		],
	});
}
