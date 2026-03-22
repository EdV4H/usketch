import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { createCommandPalette } from "./command-palette.js";

export interface AiChatOptions {
	boardId: string;
}

export function createAiChatPlugin(options: AiChatOptions): UsketchPlugin {
	let cleanup: (() => void) | undefined;

	return {
		id: "usketch-plugin-ai-chat",
		name: "AI Chat",

		setup(ctx: PluginContext) {
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

			cleanup = () => {
				window.removeEventListener("keydown", handleKeyDown);
				palette.destroy();
			};
		},

		teardown() {
			cleanup?.();
		},
	};
}
