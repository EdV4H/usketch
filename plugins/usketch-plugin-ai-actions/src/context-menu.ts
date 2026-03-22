import type { BoardStore, EventBus } from "@edv4h/usketch-shared";
import type { SmartActionRequestEvent } from "./types.js";

export interface ContextMenuOptions {
	events: EventBus;
	store: BoardStore;
	boardId: string;
}

const STYLE_ID = "usketch-ai-context-menu-styles";

const LANGUAGES = [
	{ code: "en", label: "English" },
	{ code: "ja", label: "\u65E5\u672C\u8A9E" },
	{ code: "zh", label: "\u4E2D\u6587" },
	{ code: "ko", label: "\uD55C\uAD6D\uC5B4" },
	{ code: "es", label: "Espa\u00F1ol" },
] as const;

function injectStyles(): void {
	if (document.getElementById(STYLE_ID)) return;

	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = `
.usketch-ai-ctx-menu {
	position: fixed;
	z-index: 9999;
	min-width: 200px;
	background: #fff;
	border-radius: 8px;
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15), 0 1px 4px rgba(0, 0, 0, 0.1);
	padding: 4px 0;
	font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
	font-size: 14px;
	color: #1a1a1a;
	user-select: none;
}

.usketch-ai-ctx-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 8px 12px;
	cursor: pointer;
	border: none;
	background: none;
	width: 100%;
	text-align: left;
	font: inherit;
	color: inherit;
	position: relative;
}

.usketch-ai-ctx-item:hover {
	background: #f0f0f0;
}

.usketch-ai-ctx-submenu {
	display: none;
	position: absolute;
	left: 100%;
	top: 0;
	min-width: 140px;
	background: #fff;
	border-radius: 8px;
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15), 0 1px 4px rgba(0, 0, 0, 0.1);
	padding: 4px 0;
}

.usketch-ai-ctx-item:hover > .usketch-ai-ctx-submenu {
	display: block;
}

.usketch-ai-ctx-submenu-item {
	display: block;
	padding: 8px 12px;
	cursor: pointer;
	border: none;
	background: none;
	width: 100%;
	text-align: left;
	font: inherit;
	color: inherit;
}

.usketch-ai-ctx-submenu-item:hover {
	background: #f0f0f0;
}
`;
	document.head.appendChild(style);
}

function getSelectedIds(store: BoardStore): string[] {
	return Array.from(store.getSelection());
}

export function createContextMenu(options: ContextMenuOptions): {
	destroy: () => void;
} {
	const { events, store, boardId } = options;
	let menuEl: HTMLDivElement | null = null;

	injectStyles();

	function closeMenu(): void {
		if (menuEl) {
			menuEl.remove();
			menuEl = null;
		}
	}

	function emitAction(action: SmartActionRequestEvent["action"], targetLanguage?: string): void {
		const selectedShapeIds = getSelectedIds(store);
		const payload: SmartActionRequestEvent = {
			action,
			selectedShapeIds,
			boardId,
		};
		if (targetLanguage !== undefined) {
			payload.targetLanguage = targetLanguage;
		}
		events.emit("ai:smart-action", payload);
		closeMenu();
	}

	function buildMenu(x: number, y: number): HTMLDivElement {
		const menu = document.createElement("div");
		menu.className = "usketch-ai-ctx-menu";
		menu.style.left = `${x}px`;
		menu.style.top = `${y}px`;

		// Tidy up
		const tidyItem = document.createElement("button");
		tidyItem.className = "usketch-ai-ctx-item";
		tidyItem.textContent = "\u2728 Tidy up";
		tidyItem.addEventListener("click", () => emitAction("tidy"));
		menu.appendChild(tidyItem);

		// Add labels
		const labelItem = document.createElement("button");
		labelItem.className = "usketch-ai-ctx-item";
		labelItem.textContent = "\uD83C\uDFF7 Add labels";
		labelItem.addEventListener("click", () => emitAction("label"));
		menu.appendChild(labelItem);

		// Translate (with sub-menu)
		const translateItem = document.createElement("div");
		translateItem.className = "usketch-ai-ctx-item";

		const translateLabel = document.createElement("span");
		translateLabel.textContent = "\uD83C\uDF10 Translate";
		translateItem.appendChild(translateLabel);

		const arrow = document.createElement("span");
		arrow.textContent = "\u25B8";
		translateItem.appendChild(arrow);

		const submenu = document.createElement("div");
		submenu.className = "usketch-ai-ctx-submenu";

		for (const lang of LANGUAGES) {
			const langItem = document.createElement("button");
			langItem.className = "usketch-ai-ctx-submenu-item";
			langItem.textContent = lang.label;
			langItem.addEventListener("click", () => emitAction("translate", lang.code));
			submenu.appendChild(langItem);
		}

		translateItem.appendChild(submenu);
		menu.appendChild(translateItem);

		return menu;
	}

	function onContextMenu(e: MouseEvent): void {
		const selection = store.getSelection();
		if (selection.size === 0) return;

		e.preventDefault();
		closeMenu();

		menuEl = buildMenu(e.clientX, e.clientY);
		document.body.appendChild(menuEl);

		// Clamp to viewport
		const rect = menuEl.getBoundingClientRect();
		if (rect.right > window.innerWidth) {
			menuEl.style.left = `${window.innerWidth - rect.width - 4}px`;
		}
		if (rect.bottom > window.innerHeight) {
			menuEl.style.top = `${window.innerHeight - rect.height - 4}px`;
		}
	}

	function onClickOutside(e: MouseEvent): void {
		if (menuEl && !menuEl.contains(e.target as Node)) {
			closeMenu();
		}
	}

	function onKeyDown(e: KeyboardEvent): void {
		if (e.key === "Escape") {
			closeMenu();
		}
	}

	window.addEventListener("contextmenu", onContextMenu, true);
	document.addEventListener("click", onClickOutside);
	document.addEventListener("keydown", onKeyDown);

	return {
		destroy() {
			closeMenu();
			window.removeEventListener("contextmenu", onContextMenu, true);
			document.removeEventListener("click", onClickOutside);
			document.removeEventListener("keydown", onKeyDown);

			const styleEl = document.getElementById(STYLE_ID);
			if (styleEl) {
				styleEl.remove();
			}
		},
	};
}
