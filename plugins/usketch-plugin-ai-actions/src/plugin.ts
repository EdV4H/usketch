import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { createContextMenu } from "./context-menu.js";

export interface AiActionsOptions {
	boardId: string;
}

export function createAiActionsPlugin(options: AiActionsOptions): UsketchPlugin {
	let cleanup: (() => void) | undefined;

	return {
		id: "usketch-plugin-ai-actions",
		name: "AI Smart Actions",

		setup(ctx: PluginContext) {
			const menu = createContextMenu({
				events: ctx.events,
				store: ctx.store,
				boardId: options.boardId,
			});

			cleanup = () => {
				menu.destroy();
			};
		},

		teardown() {
			cleanup?.();
		},
	};
}
