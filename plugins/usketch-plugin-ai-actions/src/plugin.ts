import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { createFloatingActionBar } from "./floating-action-bar.js";

export interface AiActionsOptions {
	boardId: string;
}

export function createAiActionsPlugin(options: AiActionsOptions): UsketchPlugin {
	let cleanup: (() => void) | undefined;

	return {
		id: "usketch-plugin-ai-actions",
		name: "AI Smart Actions",

		setup(ctx: PluginContext) {
			const bar = createFloatingActionBar({
				events: ctx.events,
				store: ctx.store,
				shapes: ctx.shapes,
				boardId: options.boardId,
			});

			cleanup = () => {
				bar.destroy();
			};
		},

		teardown() {
			cleanup?.();
		},
	};
}
