import type { EventBus } from "@edv4h/usketch-shared";
import type { VoiceStatusEvent } from "./types.js";

const STYLE_ID = "usketch-ai-voice-styles";

const CSS = `
.usketch-voice-indicator {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: none;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 24px;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  font-size: 14px;
  font-family: sans-serif;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.usketch-voice-indicator--visible {
  display: flex;
}

.usketch-voice-indicator__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ef4444;
  animation: usketch-voice-pulse 1s ease-in-out infinite;
}

.usketch-voice-indicator__text {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes usketch-voice-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}
`;

function injectStyles(): void {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = CSS;
	document.head.appendChild(style);
}

function removeStyles(): void {
	document.getElementById(STYLE_ID)?.remove();
}

export function createVoiceIndicator(events: EventBus): { destroy: () => void } {
	injectStyles();

	const container = document.createElement("div");
	container.className = "usketch-voice-indicator";

	const dot = document.createElement("div");
	dot.className = "usketch-voice-indicator__dot";

	const text = document.createElement("div");
	text.className = "usketch-voice-indicator__text";

	container.appendChild(dot);
	container.appendChild(text);
	document.body.appendChild(container);

	const unsubStatus = events.on<VoiceStatusEvent>("voice:status", (event) => {
		switch (event.status) {
			case "listening":
				container.classList.add("usketch-voice-indicator--visible");
				text.textContent = "Listening...";
				break;
			case "processing":
				text.textContent = event.transcript ?? "Processing...";
				break;
			case "done":
			case "error":
			case "unsupported":
				container.classList.remove("usketch-voice-indicator--visible");
				text.textContent = "";
				break;
		}
	});

	return {
		destroy() {
			unsubStatus();
			container.remove();
			removeStyles();
		},
	};
}
