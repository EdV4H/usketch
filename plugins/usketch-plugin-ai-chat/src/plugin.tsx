import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { createCommandPalette } from "./command-palette.js";

export interface AiChatOptions {
	boardId: string;
	/**
	 * Cmd+K で開くコマンドパレット UI をこのプラグインから登録するかどうか。
	 * apps/web 側で独自のコマンドパレットを提供する場合は false を渡して無効化する。
	 * 既定は true（後方互換）。
	 */
	enableCommandPalette?: boolean;
}

export function createAiChatPlugin(options: AiChatOptions): UsketchPlugin {
	let cleanup: (() => void) | undefined;
	const paletteEnabled = options.enableCommandPalette !== false;

	return {
		id: "usketch-plugin-ai-chat",
		name: "AI Chat",

		async setup(ctx: PluginContext) {
			let paletteCleanup: (() => void) | undefined;
			if (paletteEnabled) {
				const palette = createCommandPalette({
					events: ctx.events,
					boardId: options.boardId,
				});

				const handleKeyDown = (e: KeyboardEvent) => {
					// Cmd+K (Mac) / Ctrl+K (Windows/Linux)
					if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
						e.preventDefault();
						palette.open();
					}
				};

				window.addEventListener("keydown", handleKeyDown);
				paletteCleanup = () => {
					window.removeEventListener("keydown", handleKeyDown);
					palette.destroy();
				};
			}

			// サイドパネルにAIチャットタブを登録（遅延インポートでReact依存を分離）
			const { AiChatTab } = await import("./ai-chat-tab.js");
			ctx.events.emit("side-panel:register-tab", {
				tab: {
					id: "ai-chat",
					label: "AI Chat",
					icon: "🤖",
					order: 2,
					render: () => <AiChatTab events={ctx.events} boardId={options.boardId} />,
				},
			});

			cleanup = () => {
				paletteCleanup?.();
				ctx.events.emit("side-panel:unregister-tab", { tabId: "ai-chat" });
			};
		},

		teardown() {
			cleanup?.();
		},
	};
}
