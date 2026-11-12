import type { UsketchPlugin } from "@edv4h/usketch-shared";
import { createHistoryClient, type HistoryClient } from "./history-client.js";
import { createHistoryController } from "./history-controller.js";
import { HistoryPanel } from "./history-panel.js";
import { historyService } from "./history-service.js";

export interface HistoryPluginOptions {
	/** Board server origin (e.g. `VITE_API_URL`). */
	apiUrl: string;
	boardId: string;
	/** Extra request headers (e.g. the dev-mode `X-User-Id`). */
	extraHeaders?: Record<string, string>;
	/** Inject a client (tests, or a host with its own transport). */
	client?: HistoryClient;
}

/**
 * Board history (Git-like versions kept by the board server): a Control HUD panel
 * to list versions, see what changed since, preview one on the canvas and restore
 * it as one undoable edit. Operations are exported as plain functions
 * (history-ops.ts) and published as a service (`getHistoryApi`).
 */
export function createHistoryPlugin(options: HistoryPluginOptions): UsketchPlugin {
	return {
		id: "usketch-plugin-history",
		name: "履歴",

		setup(ctx) {
			const client =
				options.client ??
				createHistoryClient({
					apiUrl: options.apiUrl,
					boardId: options.boardId,
					extraHeaders: options.extraHeaders,
				});
			const controller = createHistoryController({
				client,
				store: ctx.store,
				commands: ctx.commands,
				events: ctx.events,
			});

			const cleanups = [
				historyService.provide(ctx.services, { client, controller }),
				ctx.hud.registerPanel({
					id: "usketch-plugin-history:panel",
					title: "履歴",
					render: () => <HistoryPanel controller={controller} />,
				}),
				ctx.actions.register({
					id: "history:save-version",
					group: "履歴",
					label: "今の版を保存",
					params: [{ name: "message", label: "版の名前", type: "string", default: "" }],
					run: async (args) => {
						await controller.saveVersion(typeof args.message === "string" ? args.message : "");
					},
				}),
				ctx.actions.register({
					id: "history:exit-preview",
					group: "履歴",
					label: "履歴のプレビューを終了",
					isEnabled: () => controller.getState().previewing !== null,
					run: () => controller.exitPreview(),
				}),
			];

			return () => {
				for (const cleanup of cleanups) cleanup();
				controller.dispose();
			};
		},
	};
}
