import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { ActionBar } from "./action-bar.js";

export interface AiActionsOptions {
	boardId: string;
}

export function createAiActionsPlugin(options: AiActionsOptions): UsketchPlugin {
	return {
		id: "usketch-plugin-ai-actions",
		name: "AI Smart Actions",

		setup(ctx: PluginContext) {
			ctx.layers.register({
				id: "ai-action-bar",
				order: 85,
				fixed: true,
				render: () => <ActionBar store={ctx.store} events={ctx.events} boardId={options.boardId} />,
			});
		},

		teardown() {
			// Layer is automatically cleaned up when the app is destroyed
		},
	};
}
