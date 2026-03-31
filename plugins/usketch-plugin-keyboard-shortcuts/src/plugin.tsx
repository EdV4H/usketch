import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";
import { copyShapes, duplicateShapes, pasteShapes } from "./clipboard.js";
import { type CommandPaletteController, createCommandPalette } from "./command-palette.js";
import { zoomFit, zoomIn, zoomOut, zoomReset } from "./zoom.js";

export interface KeyboardShortcutsPluginOptions {
	wsProvider?: WsProviderHandle;
}

export function createKeyboardShortcutsPlugin(
	options?: KeyboardShortcutsPluginOptions,
): UsketchPlugin {
	let cleanups: (() => void)[] = [];
	let palette: CommandPaletteController | null = null;

	return {
		id: "usketch-plugin-keyboard-shortcuts",
		name: "Keyboard Shortcuts",

		setup(ctx: PluginContext) {
			const { store, shortcuts, events, commands } = ctx;

			// ── Side panel state tracking ──
			let sidePanelOpen = false;
			cleanups.push(
				events.on("side-panel:open", () => {
					sidePanelOpen = true;
				}),
			);
			cleanups.push(
				events.on("side-panel:close", () => {
					sidePanelOpen = false;
				}),
			);
			cleanups.push(
				events.on("side-panel:toggle", () => {
					sidePanelOpen = !sidePanelOpen;
				}),
			);

			// ── Command palette (if wsProvider available) ──
			if (options?.wsProvider) {
				palette = createCommandPalette(ctx.layers, store, options.wsProvider);
			}

			// ── Escape: tiered behavior ──
			cleanups.push(
				shortcuts.register("Escape", () => {
					// 1. Close command palette
					if (palette?.isOpen()) {
						palette.close();
						return;
					}
					// 2. Close side panel
					if (sidePanelOpen) {
						events.emit("side-panel:close", {});
						return;
					}
					// 3. Clear selection
					if (store.getSelection().size > 0) {
						store.clearSelection();
						return;
					}
					// 4. Switch to select tool
					if (store.getActiveToolId() !== "select") {
						store.setActiveToolId("select");
					}
				}),
			);

			// ── Select all ──
			cleanups.push(
				shortcuts.register("Ctrl+A", () => {
					const ids = [...store.getShapes().keys()];
					store.setSelection(ids);
				}),
			);

			// ── Clipboard ──
			cleanups.push(
				shortcuts.register("Ctrl+C", () => {
					void copyShapes(store);
				}),
			);
			cleanups.push(
				shortcuts.register("Ctrl+V", () => {
					void pasteShapes(store, commands);
				}),
			);
			cleanups.push(
				shortcuts.register("Ctrl+D", () => {
					duplicateShapes(store, commands);
				}),
			);

			// ── Zoom ──
			cleanups.push(
				shortcuts.register("=", () => {
					zoomIn(store);
				}),
			);
			cleanups.push(
				shortcuts.register("+", () => {
					zoomIn(store);
				}),
			);
			cleanups.push(
				shortcuts.register("-", () => {
					zoomOut(store);
				}),
			);
			cleanups.push(
				shortcuts.register("Ctrl+0", () => {
					zoomReset(store);
				}),
			);
			cleanups.push(
				shortcuts.register("Ctrl+1", () => {
					zoomFit(store);
				}),
			);

			// ── Side panel toggles ──
			cleanups.push(
				shortcuts.register("Ctrl+B", () => {
					events.emit("side-panel:toggle", { tabId: "board-info" });
				}),
			);
			cleanups.push(
				shortcuts.register("Ctrl+/", () => {
					events.emit("side-panel:toggle", { tabId: "comments" });
				}),
			);
			cleanups.push(
				shortcuts.register("Ctrl+Shift+M", () => {
					events.emit("side-panel:toggle", { tabId: "community-chat" });
				}),
			);

			// ── "/" command palette trigger (raw keydown, not shortcut registry) ──
			if (palette) {
				const handleSlashKey = (e: KeyboardEvent) => {
					if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
					const tag = (e.target as HTMLElement)?.tagName;
					if (
						tag === "INPUT" ||
						tag === "TEXTAREA" ||
						(e.target as HTMLElement)?.isContentEditable
					) {
						return;
					}
					if (palette?.isOpen()) return;
					e.preventDefault();
					palette?.open();
				};
				window.addEventListener("keydown", handleSlashKey);
				cleanups.push(() => window.removeEventListener("keydown", handleSlashKey));
			}
		},

		teardown() {
			for (const fn of cleanups) fn();
			cleanups = [];
			palette?.dispose();
		},
	};
}
