import type { AiRequestEvent, AiStatusEvent } from "@edv4h/usketch-plugin-ai-agent";
import type { EventBus } from "@edv4h/usketch-shared";

const PALETTE_ID = "usketch-ai-command-palette";

const STYLES = `
#${PALETTE_ID} {
	position: fixed;
	top: 80px;
	left: 50%;
	transform: translateX(-50%);
	width: 560px;
	max-width: calc(100vw - 32px);
	background: white;
	border-radius: 12px;
	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05);
	z-index: 9999;
	font-family: system-ui, -apple-system, sans-serif;
	overflow: hidden;
}

#${PALETTE_ID} .ai-palette-input-wrap {
	display: flex;
	align-items: center;
	padding: 12px 16px;
	gap: 10px;
}

#${PALETTE_ID} .ai-palette-icon {
	flex-shrink: 0;
	width: 20px;
	height: 20px;
	color: #999;
}

#${PALETTE_ID} input {
	flex: 1;
	border: none;
	outline: none;
	font-size: 15px;
	line-height: 1.5;
	background: transparent;
	color: #1e1e1e;
}

#${PALETTE_ID} input::placeholder {
	color: #aaa;
}

#${PALETTE_ID} .ai-palette-status {
	padding: 8px 16px 12px;
	font-size: 13px;
	color: #666;
	border-top: 1px solid #f0f0f0;
	display: flex;
	align-items: center;
	gap: 8px;
}

#${PALETTE_ID} .ai-palette-spinner {
	width: 14px;
	height: 14px;
	border: 2px solid #ddd;
	border-top-color: #666;
	border-radius: 50%;
	animation: ai-spin 0.6s linear infinite;
}

@keyframes ai-spin {
	to { transform: rotate(360deg); }
}

#${PALETTE_ID} .ai-palette-error {
	color: #c33;
}

#${PALETTE_ID}-backdrop {
	position: fixed;
	inset: 0;
	z-index: 9998;
	background: rgba(0, 0, 0, 0.1);
}
`;

export interface CommandPaletteOptions {
	events: EventBus;
	boardId: string;
}

export function createCommandPalette(options: CommandPaletteOptions): {
	open: () => void;
	close: () => void;
	destroy: () => void;
} {
	const { events, boardId } = options;
	let isOpen = false;
	let paletteEl: HTMLDivElement | null = null;
	let backdropEl: HTMLDivElement | null = null;
	let styleEl: HTMLStyleElement | null = null;
	let statusText = "";
	let isLoading = false;
	let errorMessage = "";

	// ステータス購読
	const unsubStatus = events.on<AiStatusEvent>("ai:status", (status) => {
		switch (status.status) {
			case "thinking":
				isLoading = true;
				errorMessage = "";
				statusText = "AI is thinking...";
				break;
			case "placing":
				statusText = `Placing ${status.shapeCount ?? 0} shapes...`;
				break;
			case "done":
				isLoading = false;
				statusText = "";
				close();
				break;
			case "error":
				isLoading = false;
				errorMessage = status.message ?? "An error occurred";
				statusText = "";
				break;
		}
		updateStatusUI();
	});

	function injectStyles(): void {
		if (styleEl) return;
		styleEl = document.createElement("style");
		styleEl.textContent = STYLES;
		document.head.appendChild(styleEl);
	}

	function updateStatusUI(): void {
		if (!paletteEl) return;
		const statusEl = paletteEl.querySelector(".ai-palette-status") as HTMLDivElement | null;
		if (!statusEl) return;

		// DOM操作で更新（XSS防止のためinnerHTMLは使わない）
		while (statusEl.firstChild) {
			statusEl.removeChild(statusEl.firstChild);
		}

		if (isLoading && statusText) {
			statusEl.style.display = "flex";
			const spinnerEl = document.createElement("div");
			spinnerEl.className = "ai-palette-spinner";
			const textEl = document.createElement("span");
			textEl.textContent = statusText;
			statusEl.appendChild(spinnerEl);
			statusEl.appendChild(textEl);
		} else if (errorMessage) {
			statusEl.style.display = "flex";
			const errorEl = document.createElement("span");
			errorEl.className = "ai-palette-error";
			errorEl.textContent = errorMessage;
			statusEl.appendChild(errorEl);
		} else {
			statusEl.style.display = "none";
		}

		// ロード中はinputを無効化
		const input = paletteEl.querySelector("input") as HTMLInputElement | null;
		if (input) {
			input.disabled = isLoading;
		}
	}

	function open(): void {
		if (isOpen) return;
		isOpen = true;
		errorMessage = "";
		statusText = "";
		isLoading = false;

		injectStyles();

		// Backdrop
		backdropEl = document.createElement("div");
		backdropEl.id = `${PALETTE_ID}-backdrop`;
		backdropEl.addEventListener("click", close);
		document.body.appendChild(backdropEl);

		// Palette
		paletteEl = document.createElement("div");
		paletteEl.id = PALETTE_ID;
		paletteEl.innerHTML = `
			<div class="ai-palette-input-wrap">
				<svg class="ai-palette-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 2L2 7l10 5 10-5-10-5z"/>
					<path d="M2 17l10 5 10-5"/>
					<path d="M2 12l10 5 10-5"/>
				</svg>
				<input type="text" placeholder="Ask AI to draw something..." autofocus />
			</div>
			<div class="ai-palette-status" style="display: none"></div>
		`;
		document.body.appendChild(paletteEl);

		const input = paletteEl.querySelector("input") as HTMLInputElement;
		input.focus();

		// IME対応: compositionendの後のEnterのみ処理
		let isComposing = false;
		input.addEventListener("compositionstart", () => {
			isComposing = true;
		});
		input.addEventListener("compositionend", () => {
			isComposing = false;
		});
		input.addEventListener("keydown", (e) => {
			if (e.key === "Escape") {
				close();
				return;
			}
			if (e.key === "Enter" && !isComposing && !isLoading) {
				const prompt = input.value.trim();
				if (!prompt) return;
				events.emit<AiRequestEvent>("ai:request", {
					prompt,
					boardId,
				});
			}
		});
	}

	function close(): void {
		if (!isOpen) return;
		isOpen = false;
		paletteEl?.remove();
		backdropEl?.remove();
		paletteEl = null;
		backdropEl = null;
	}

	function destroy(): void {
		close();
		unsubStatus();
		styleEl?.remove();
		styleEl = null;
	}

	return { open, close, destroy };
}
