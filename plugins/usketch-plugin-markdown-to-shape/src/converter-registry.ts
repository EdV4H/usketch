import type {
	MarkdownConverter,
	MarkdownConverterRegistry,
	MarkdownNode,
	PluginContext,
} from "@edv4h/usketch-shared";

/**
 * Service key under which this plugin provides its {@link MarkdownConverterRegistry}
 * on `ctx.services`. Consumers should prefer {@link getMarkdownConverters}.
 */
export const MARKDOWN_CONVERTERS_SERVICE = "markdown-converters";

/** Typed accessor for the Markdown-converter registry provided by this plugin. */
export function getMarkdownConverters(ctx: PluginContext): MarkdownConverterRegistry | undefined {
	return ctx.services.get<MarkdownConverterRegistry>(MARKDOWN_CONVERTERS_SERVICE);
}

/**
 * Registry of Markdown-node → shape converters. Resolution for a node:
 * filter by `nodeTypes`/`match`, then highest `order` wins, ties resolve to the
 * most-recently-registered (last-wins) — mirroring the external-content registry.
 */
export function createMarkdownConverterRegistry(): MarkdownConverterRegistry {
	// Insertion-ordered; re-registering an id removes the old entry and appends.
	const converters: MarkdownConverter[] = [];

	function unregister(id: string): void {
		const i = converters.findIndex((c) => c.id === id);
		if (i !== -1) converters.splice(i, 1);
	}

	return {
		register(converter) {
			unregister(converter.id);
			converters.push(converter);
			return () => unregister(converter.id);
		},
		unregister,
		resolve(node: MarkdownNode) {
			let best: MarkdownConverter | undefined;
			for (const c of converters) {
				if (c.nodeTypes && !c.nodeTypes.includes(node.type)) continue;
				if (c.match && !c.match(node)) continue;
				// Later registration wins on equal order (>= keeps the last one seen).
				if (!best || (c.order ?? 0) >= (best.order ?? 0)) best = c;
			}
			return best;
		},
		getAll() {
			return [...converters];
		},
	};
}
