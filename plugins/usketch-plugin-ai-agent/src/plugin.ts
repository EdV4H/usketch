import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { requestAiCompletion } from "./ai-client.js";
import { canvasToPrompt } from "./canvas-serializer.js";
import type { AiRequestEvent, AiStatusEvent } from "./types.js";

export interface AiAgentOptions {
	apiUrl: string;
	extraHeaders?: Record<string, string>;
}

export function createAiAgentPlugin(options: AiAgentOptions): UsketchPlugin {
	const { apiUrl, extraHeaders } = options;
	let busy = false;
	let cleanup: (() => void) | undefined;

	return {
		id: "usketch-plugin-ai-agent",
		name: "AI Agent",

		setup(ctx: PluginContext) {
			// ai:request イベントを購読
			const unsubRequest = ctx.events.on<AiRequestEvent>("ai:request", async (event) => {
				if (busy) return;
				busy = true;

				try {
					// キャンバスの状態をシリアライズ
					const shapes = ctx.store.getShapes();
					const viewport = ctx.store.getViewport();
					const availableTypes = [...ctx.shapes.getAll().keys()];
					const canvasContext = canvasToPrompt(shapes, viewport, availableTypes);

					// ステータスコールバック
					const onStatus = (status: AiStatusEvent) => {
						ctx.events.emit("ai:status", status);
					};

					onStatus({ status: "thinking" });

					const response = await requestAiCompletion(
						apiUrl,
						{
							prompt: event.prompt,
							canvasContext,
							boardId: event.boardId,
						},
						onStatus,
						extraHeaders,
					);

					// シェイプはサーバー側でYjsに書き込み済み → Yjs同期で自動的にストアに反映
					ctx.events.emit("ai:response", response);
				} catch (err) {
					ctx.events.emit("ai:status", {
						status: "error",
						message: err instanceof Error ? err.message : "Unknown error",
					} satisfies AiStatusEvent);
				} finally {
					busy = false;
				}
			});

			cleanup = unsubRequest;
		},

		teardown() {
			cleanup?.();
		},
	};
}
