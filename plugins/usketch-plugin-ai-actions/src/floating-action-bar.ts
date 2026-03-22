import type { AiStatusEvent } from "@edv4h/usketch-plugin-ai-agent";
import type { BoardStore, EventBus, ShapeRegistry } from "@edv4h/usketch-shared";
import { boundsToScreenRect, getSelectionBounds } from "@edv4h/usketch-shared";
import type { SmartActionRequestEvent } from "./types.js";

const STYLE_ID = "usketch-ai-action-bar-styles";
const BAR_ID = "usketch-ai-action-bar";

const STYLES = `
#${BAR_ID} {
	position: fixed;
	z-index: 150;
	display: flex;
	align-items: center;
	background: #fff;
	border-radius: 10px;
	box-shadow: 0 2px 12px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04);
	padding: 4px;
	gap: 2px;
	font-family: system-ui, -apple-system, sans-serif;
	font-size: 13px;
	user-select: none;
	transition: opacity 0.15s, transform 0.15s;
}

#${BAR_ID}.hidden {
	opacity: 0;
	pointer-events: none;
	transform: translateY(4px);
}

#${BAR_ID} .ab-btn {
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 6px 10px;
	border: none;
	background: none;
	border-radius: 7px;
	cursor: pointer;
	font: inherit;
	color: #333;
	white-space: nowrap;
}

#${BAR_ID} .ab-btn:hover {
	background: #f0f0f0;
}

#${BAR_ID} .ab-sep {
	width: 1px;
	height: 20px;
	background: #e5e5e5;
	flex-shrink: 0;
}

#${BAR_ID} .ab-input-wrap {
	display: flex;
	align-items: center;
	gap: 4px;
	flex: 1;
	min-width: 0;
}

#${BAR_ID} .ab-input {
	flex: 1;
	min-width: 180px;
	border: none;
	outline: none;
	font: inherit;
	font-size: 13px;
	padding: 6px 8px;
	background: transparent;
	color: #333;
}

#${BAR_ID} .ab-input::placeholder {
	color: #aaa;
}

#${BAR_ID} .ab-back {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	border: none;
	background: none;
	border-radius: 6px;
	cursor: pointer;
	color: #666;
	font-size: 16px;
	flex-shrink: 0;
}

#${BAR_ID} .ab-back:hover {
	background: #f0f0f0;
}

#${BAR_ID} .ab-status {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 6px 10px;
	font-size: 13px;
	color: #666;
	white-space: nowrap;
}

#${BAR_ID} .ab-spinner {
	width: 14px;
	height: 14px;
	border: 2px solid #ddd;
	border-top-color: #666;
	border-radius: 50%;
	animation: ab-spin 0.6s linear infinite;
	flex-shrink: 0;
}

@keyframes ab-spin {
	to { transform: rotate(360deg); }
}

#${BAR_ID} .ab-status-done {
	color: #16a34a;
}

#${BAR_ID} .ab-status-error {
	color: #dc2626;
}

#${BAR_ID} .ab-stop {
	padding: 4px 8px;
	border: 1px solid #ddd;
	background: #fff;
	border-radius: 5px;
	cursor: pointer;
	font: inherit;
	font-size: 12px;
	color: #666;
	flex-shrink: 0;
}

#${BAR_ID} .ab-stop:hover {
	background: #f5f5f5;
}
`;

export interface FloatingActionBarOptions {
	events: EventBus;
	store: BoardStore;
	shapes: ShapeRegistry;
	boardId: string;
}

type BarMode = "actions" | "input" | "thinking" | "done" | "error";

export function createFloatingActionBar(options: FloatingActionBarOptions): {
	destroy: () => void;
} {
	const { events, store, shapes, boardId } = options;

	let barEl: HTMLDivElement | null = null;
	let styleEl: HTMLStyleElement | null = null;
	let mode: BarMode = "actions";
	let lastSelectionSize = 0;
	let dismissTimer: ReturnType<typeof setTimeout> | null = null;

	function injectStyles(): void {
		if (document.getElementById(STYLE_ID)) return;
		styleEl = document.createElement("style");
		styleEl.id = STYLE_ID;
		styleEl.textContent = STYLES;
		document.head.appendChild(styleEl);
	}

	function getShapeBounds(id: string) {
		const shape = store.getShape(id);
		if (!shape) return null;
		const def = shapes.get(shape.type);
		return def
			? def.getBounds(shape)
			: { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
	}

	function getSelectionScreenBounds(): {
		centerX: number;
		bottomY: number;
	} | null {
		const selection = store.getSelection();
		if (selection.size === 0) return null;

		const bounds = getSelectionBounds(selection, getShapeBounds);
		if (!bounds) return null;

		const vp = store.getViewport();
		const screen = boundsToScreenRect(bounds, vp);
		return { centerX: screen.centerX, bottomY: screen.bottom };
	}

	function emitAction(
		action: SmartActionRequestEvent["action"],
		extra?: Partial<SmartActionRequestEvent>,
	): void {
		const selectedShapeIds = Array.from(store.getSelection());
		events.emit("ai:smart-action", {
			action,
			selectedShapeIds,
			boardId,
			...extra,
		} satisfies SmartActionRequestEvent);
	}

	function setMode(newMode: BarMode): void {
		mode = newMode;
		render();
	}

	function positionBar(): void {
		if (!barEl) return;
		const bounds = getSelectionScreenBounds();
		if (!bounds) return;

		const barRect = barEl.getBoundingClientRect();
		let left = bounds.centerX - barRect.width / 2;
		let top = bounds.bottomY + 12;

		// ビューポートクランプ
		left = Math.max(8, Math.min(left, window.innerWidth - barRect.width - 8));
		top = Math.min(top, window.innerHeight - barRect.height - 8);

		barEl.style.left = `${Math.round(left)}px`;
		barEl.style.top = `${Math.round(top)}px`;
	}

	function render(): void {
		if (!barEl) return;

		// Clear
		while (barEl.firstChild) barEl.removeChild(barEl.firstChild);

		switch (mode) {
			case "actions":
				renderActions();
				break;
			case "input":
				renderInput();
				break;
			case "thinking":
				renderStatus("thinking");
				break;
			case "done":
				renderStatus("done");
				break;
			case "error":
				renderStatus("error");
				break;
		}

		// 位置調整（コンテンツが変わるとサイズが変わるため）
		requestAnimationFrame(() => positionBar());
	}

	function renderActions(): void {
		if (!barEl) return;

		const tidyBtn = document.createElement("button");
		tidyBtn.className = "ab-btn";
		tidyBtn.textContent = "✨ Tidy";
		tidyBtn.addEventListener("click", () => {
			emitAction("tidy");
		});
		barEl.appendChild(tidyBtn);

		const labelBtn = document.createElement("button");
		labelBtn.className = "ab-btn";
		labelBtn.textContent = "🏷 Label";
		labelBtn.addEventListener("click", () => {
			emitAction("label");
		});
		barEl.appendChild(labelBtn);

		const sep = document.createElement("div");
		sep.className = "ab-sep";
		barEl.appendChild(sep);

		const askBtn = document.createElement("button");
		askBtn.className = "ab-btn";
		askBtn.textContent = "⌨ Ask AI";
		askBtn.addEventListener("click", () => {
			setMode("input");
		});
		barEl.appendChild(askBtn);
	}

	function renderInput(): void {
		if (!barEl) return;

		const backBtn = document.createElement("button");
		backBtn.className = "ab-back";
		backBtn.textContent = "←";
		backBtn.addEventListener("click", () => {
			setMode("actions");
		});
		barEl.appendChild(backBtn);

		const wrap = document.createElement("div");
		wrap.className = "ab-input-wrap";

		const input = document.createElement("input");
		input.className = "ab-input";
		input.type = "text";
		input.placeholder = "What do you want to do with these shapes?";

		let isComposing = false;
		input.addEventListener("compositionstart", () => {
			isComposing = true;
		});
		input.addEventListener("compositionend", () => {
			isComposing = false;
		});
		input.addEventListener("keydown", (e) => {
			e.stopPropagation();
			if (e.key === "Enter" && !isComposing) {
				const text = input.value.trim();
				if (text) {
					emitAction("custom", { customPrompt: text });
				}
			}
			if (e.key === "Escape") {
				setMode("actions");
			}
		});

		wrap.appendChild(input);
		barEl.appendChild(wrap);

		requestAnimationFrame(() => input.focus());
	}

	let statusMessage = "";
	let statusShapeCount = 0;
	let errorMsg = "";

	function renderStatus(type: "thinking" | "done" | "error"): void {
		if (!barEl) return;

		const statusEl = document.createElement("div");
		statusEl.className = "ab-status";

		if (type === "thinking") {
			const spinner = document.createElement("div");
			spinner.className = "ab-spinner";
			statusEl.appendChild(spinner);

			const text = document.createElement("span");
			text.textContent = statusMessage || "AI is thinking...";
			statusEl.appendChild(text);
		} else if (type === "done") {
			statusEl.classList.add("ab-status-done");
			const text = document.createElement("span");
			text.textContent = statusShapeCount > 0 ? `✓ Done — ${statusShapeCount} shapes` : "✓ Done";
			statusEl.appendChild(text);
		} else {
			statusEl.classList.add("ab-status-error");
			const text = document.createElement("span");
			text.textContent = `✗ ${errorMsg || "Failed"}`;
			statusEl.appendChild(text);
		}

		barEl.appendChild(statusEl);
	}

	// --- Lifecycle ---

	function ensureBar(): void {
		if (barEl) return;
		injectStyles();
		barEl = document.createElement("div");
		barEl.id = BAR_ID;
		barEl.classList.add("hidden");
		document.body.appendChild(barEl);
	}

	function showBar(): void {
		ensureBar();
		if (!barEl) return;
		// thinking/done/error中はモードを維持
		if (mode !== "thinking" && mode !== "done" && mode !== "error") {
			mode = "actions";
		}
		render();
		barEl.classList.remove("hidden");
	}

	function hideBar(): void {
		if (!barEl) return;
		// thinking中は非表示にしない
		if (mode === "thinking") return;
		barEl.classList.add("hidden");
		mode = "actions";
	}

	function updateVisibility(): void {
		const selection = store.getSelection();
		const newSize = selection.size;

		// done/error中はタイマーに任せて再描画しない
		if (mode === "done" || mode === "error") {
			lastSelectionSize = newSize;
			return;
		}

		if (
			newSize > 0 &&
			(mode === "thinking" ||
				newSize !== lastSelectionSize ||
				!barEl ||
				barEl.classList.contains("hidden"))
		) {
			showBar();
		} else if (newSize === 0 && mode !== "thinking") {
			hideBar();
		} else if (newSize > 0) {
			positionBar();
		}

		lastSelectionSize = newSize;
	}

	// ストア変更を監視
	const unsubStore = store.subscribe(() => {
		updateVisibility();
	});

	// AI ステータス監視
	const unsubStatus = events.on<AiStatusEvent>("ai:status", (status) => {
		if (dismissTimer) {
			clearTimeout(dismissTimer);
			dismissTimer = null;
		}

		switch (status.status) {
			case "thinking":
				statusMessage = "AI is thinking...";
				setMode("thinking");
				break;
			case "placing":
				statusMessage = `Placing ${status.shapeCount ?? 0} shapes...`;
				statusShapeCount = status.shapeCount ?? 0;
				setMode("thinking");
				break;
			case "done":
				setMode("done");
				dismissTimer = setTimeout(() => {
					if (mode === "done") {
						const selection = store.getSelection();
						if (selection.size > 0) {
							setMode("actions");
						} else {
							hideBar();
						}
					}
				}, 3000);
				break;
			case "error":
				errorMsg = status.message ?? "Failed";
				setMode("error");
				dismissTimer = setTimeout(() => {
					if (mode === "error") {
						const selection = store.getSelection();
						if (selection.size > 0) {
							setMode("actions");
						} else {
							hideBar();
						}
					}
				}, 5000);
				break;
		}
	});

	return {
		destroy() {
			unsubStore();
			unsubStatus();
			if (dismissTimer) clearTimeout(dismissTimer);
			barEl?.remove();
			barEl = null;
			const el = document.getElementById(STYLE_ID);
			if (el) el.remove();
		},
	};
}
