import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { PERMISSIONS } from "@edv4h/usketch-shared";
import {
	createMarkdownConverterRegistry,
	MARKDOWN_CONVERTERS_SERVICE,
} from "./converter-registry.js";
import { explodeMarkdownShape, selectedMarkdownShapeId } from "./orchestrator.js";

/**
 * Decomposes a selected `markdown` shape into native shapes. This plugin owns
 * the {@link MarkdownConverterRegistry} and provides it on `ctx.services` under
 * {@link MARKDOWN_CONVERTERS_SERVICE}; concrete converters (heading→text, …) are
 * registered by consumers (e.g. the host app's adapters) so this plugin depends
 * on no shape plugin. Ships only the orchestration + a Control HUD action.
 * Unregistered block types fall back to a `markdown` shape carrying their raw
 * source.
 */
export function createMarkdownToShapePlugin(): UsketchPlugin {
	return {
		id: "usketch-plugin-markdown-to-shape",
		name: "Markdown to Shape",

		setup(ctx: PluginContext) {
			// Own the registry and expose it for consumers to register converters into.
			const registry = createMarkdownConverterRegistry();
			const offService = ctx.services.provide(MARKDOWN_CONVERTERS_SERVICE, registry);

			const off = ctx.actions.register({
				id: "markdown:explode",
				requires: PERMISSIONS.pageEdit,
				label: "🧩 Markdown を図形に分解",
				group: "Markdown",
				isEnabled: () => selectedMarkdownShapeId(ctx.store) !== null,
				run: () => {
					const id = selectedMarkdownShapeId(ctx.store);
					if (!id) return;
					explodeMarkdownShape(
						{ store: ctx.store, registry, shapes: ctx.shapes, commands: ctx.commands },
						id,
					);
				},
			});

			return () => {
				off();
				offService();
			};
		},
	};
}
