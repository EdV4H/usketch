import type { Library } from "@openuidev/react-lang";

/**
 * Module-scoped registry for the active OpenUI component library.
 *
 * The shape plugin needs a `Library` at render time to pass to `<Renderer>`,
 * but the library is configured by the *tool* plugin (which knows what
 * components the host wants to expose to the LLM). To avoid a circular
 * dependency between the two plugins, the shape plugin exports
 * `setOpenUILibrary` and the tool plugin calls it during `setup`.
 *
 * This pattern assumes the two plugins live in the same process (true for
 * a single `createApp(...)` invocation). It does NOT support multiple
 * `createApp` instances with different libraries — file a follow-up if that
 * matters.
 */
let activeLibrary: Library | null = null;

export function setOpenUILibrary(library: Library | null): void {
	activeLibrary = library;
}

export function getOpenUILibrary(): Library | null {
	return activeLibrary;
}
