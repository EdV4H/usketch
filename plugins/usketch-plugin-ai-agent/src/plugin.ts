import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { requestAiCompletion } from "./ai-client.js";
import { canvasToPrompt } from "./canvas-serializer.js";
import type {
	AiRequestEvent,
	AiSmartActionRequestEvent,
	AiStatusEvent,
	SmartActionType,
} from "./types.js";

export interface AiAgentOptions {
	apiUrl: string;
	extraHeaders?: Record<string, string>;
}

/** Smart Actionタイプ → プロンプトテンプレート（網羅性を型で保証） */
const ACTION_PROMPTS: Record<
	SmartActionType,
	(opts?: { targetLanguage?: string; customPrompt?: string }) => string
> = {
	tidy: () =>
		"Tidy up the selected shapes: align edges, equalize spacing, arrange into a clean grid or flow layout. Use modify_shapes to update positions.",
	label: () =>
		"Add descriptive text labels near each unlabeled shape in the selection. Use place_shapes to add new text shapes.",
	translate: (opts) =>
		`Translate all text content in the selected shapes to ${opts?.targetLanguage ?? "English"}. Use modify_shapes to update the text field.`,
	custom: (opts) =>
		`Apply the following instruction to the selected shapes: ${opts?.customPrompt ?? ""}`,
};

export function createAiAgentPlugin(options: AiAgentOptions): UsketchPlugin {
	const { apiUrl, extraHeaders } = options;
	let busy = false;
	let cleanup: (() => void) | undefined;

	return {
		id: "usketch-plugin-ai-agent",
		name: "AI Agent",

		setup(ctx: PluginContext) {
			/** 共通の AI リクエスト実行 */
			async function executeAiRequest(
				prompt: string,
				boardId: string,
				selectedIds?: ReadonlySet<string>,
				image?: string,
			): Promise<void> {
				if (busy) return;
				busy = true;

				try {
					const shapes = ctx.store.getShapes();
					const viewport = ctx.store.getViewport();
					const availableTypes = [...ctx.shapes.getAll().keys()];
					const canvasContext = canvasToPrompt(
						shapes,
						viewport,
						availableTypes,
						ctx.shapes,
						selectedIds,
					);

					const onStatus = (status: AiStatusEvent) => {
						ctx.events.emit("ai:status", status);
					};

					onStatus({ status: "thinking" });

					const response = await requestAiCompletion(
						apiUrl,
						{ prompt, canvasContext, boardId, image },
						onStatus,
						extraHeaders,
					);

					ctx.events.emit("ai:response", response);
				} catch (err) {
					ctx.events.emit("ai:status", {
						status: "error",
						message: err instanceof Error ? err.message : "Unknown error",
					} satisfies AiStatusEvent);
				} finally {
					busy = false;
				}
			}

			// ai:request イベントを購読（Cmd+Kパレット）
			const unsubRequest = ctx.events.on<AiRequestEvent>("ai:request", (event) => {
				executeAiRequest(event.prompt, event.boardId, undefined, event.image);
			});

			// ai:smart-action イベントを購読（コンテキストメニュー）
			const unsubSmartAction = ctx.events.on<AiSmartActionRequestEvent>(
				"ai:smart-action",
				(event) => {
					const prompt = ACTION_PROMPTS[event.action]({
						targetLanguage: event.targetLanguage,
						customPrompt: event.customPrompt,
					});
					const selectedIds = new Set(event.selectedShapeIds);
					executeAiRequest(prompt, event.boardId, selectedIds);
				},
			);

			cleanup = () => {
				unsubRequest();
				unsubSmartAction();
			};
		},

		teardown() {
			cleanup?.();
		},
	};
}
