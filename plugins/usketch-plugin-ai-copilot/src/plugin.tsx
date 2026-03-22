import type { AiStatusEvent } from "@edv4h/usketch-plugin-ai-agent";
import type { PluginContext, ShapeData, UsketchPlugin } from "@edv4h/usketch-shared";
import { generateId } from "@edv4h/usketch-shared";

import { GhostShape } from "./ghost-shape.js";
import type { CopilotOptions, CopilotSuggestion } from "./types.js";

const STYLE_ID = "usketch-ai-copilot-styles";
const STYLES = `
@keyframes ai-ghost-fade-in {
	from { opacity: 0; transform: scale(0.95); }
	to { opacity: 1; transform: scale(1); }
}
div:hover > .ai-ghost-accept-btn {
	opacity: 1 !important;
}
`;

const DEFAULT_SYSTEM_PROMPT = `You are an AI copilot for uSketch whiteboard.
Based on what the user just created or modified, suggest 1-3 logical next shapes.

Rules:
- Suggest shapes that continue the user's pattern or workflow
- Place suggestions near but not overlapping existing shapes
- For flowcharts: suggest the next step or decision
- For diagrams: suggest related components
- Keep suggestions small and contextual
- Use place_shapes to define your suggestions`;

export function createAiCopilotPlugin(options: CopilotOptions): UsketchPlugin {
	const { apiUrl, boardId, extraHeaders, debounceMs = 2000, maxSuggestions = 3 } = options;

	let cleanup: (() => void) | undefined;
	let enabled = options.enabled ?? true;

	return {
		id: "usketch-plugin-ai-copilot",
		name: "AI Copilot",

		setup(ctx: PluginContext) {
			let debounceTimer: ReturnType<typeof setTimeout> | null = null;
			let aiIsBusy = false;
			let requesting = false;
			const activeSuggestionIds = new Set<string>();

			// Inject styles
			if (!document.getElementById(STYLE_ID)) {
				const styleEl = document.createElement("style");
				styleEl.id = STYLE_ID;
				styleEl.textContent = STYLES;
				document.head.appendChild(styleEl);
			}

			// Accept handler: convert suggestion to real shape
			function acceptSuggestion(suggestion: CopilotSuggestion): void {
				const shape: ShapeData = {
					id: generateId(),
					type: suggestion.type,
					x: suggestion.x,
					y: suggestion.y,
					width: suggestion.width,
					height: suggestion.height,
					style: {
						fill: suggestion.style?.fill ?? "#ffffff",
						stroke: suggestion.style?.stroke ?? "#1e1e1e",
						strokeWidth: suggestion.style?.strokeWidth ?? 2,
						opacity: suggestion.style?.opacity ?? 1,
					},
				};
				if (suggestion.text !== undefined) {
					(shape as Record<string, unknown>).text = suggestion.text;
				}
				if (suggestion.type === "text") {
					(shape as Record<string, unknown>).fontSize = 16;
					(shape as Record<string, unknown>).fontFamily = "system-ui, sans-serif";
					(shape as Record<string, unknown>).isEditing = false;
				}
				ctx.store.addShape(shape);
				// Dismiss the accepted suggestion
				ctx.transient.dismiss(suggestion.id);
				activeSuggestionIds.delete(suggestion.id);
			}

			// Register transient renderer
			ctx.transient.registerType("ai-suggestion", {
				render: (obj, renderCtx) => (
					<GhostShape obj={obj} ctx={renderCtx} onAccept={acceptSuggestion} />
				),
			});

			// Dismiss all suggestions
			function dismissAll(): void {
				for (const id of activeSuggestionIds) {
					ctx.transient.dismiss(id);
				}
				activeSuggestionIds.clear();
			}

			// Request suggestions from AI
			async function requestSuggestions(): Promise<void> {
				if (requesting || aiIsBusy || !enabled) return;
				requesting = true;

				try {
					// Serialize recent shapes (last 10 for context)
					const shapes = ctx.store.getShapes();
					const viewport = ctx.store.getViewport();
					const availableTypes = [...ctx.shapes.getAll().keys()];

					// Simple context: last few shapes + viewport
					const shapeList = [...shapes.values()].slice(-10).map((s) => ({
						id: s.id,
						type: s.type,
						x: Math.round(s.x),
						y: Math.round(s.y),
						w: Math.round(s.width),
						h: Math.round(s.height),
						...(s.text ? { text: s.text } : {}),
					}));

					const viewportCenter = {
						x: Math.round(-viewport.x / viewport.zoom + window.innerWidth / 2 / viewport.zoom),
						y: Math.round(-viewport.y / viewport.zoom + window.innerHeight / 2 / viewport.zoom),
					};

					const canvasContext = JSON.stringify({
						viewportCenter,
						availableShapeTypes: availableTypes,
						existingShapes: shapeList,
						shapeCount: shapes.size,
					});

					const controller = new AbortController();
					const response = await fetch(`${apiUrl}/api/ai/suggest`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							...extraHeaders,
						},
						body: JSON.stringify({
							prompt: DEFAULT_SYSTEM_PROMPT,
							canvasContext,
							boardId,
						}),
						credentials: "include",
						signal: controller.signal,
					});

					if (!response.ok || !response.body) return;

					// Parse SSE stream for result
					const reader = response.body.getReader();
					const decoder = new TextDecoder();
					let buffer = "";
					let currentEvent = "";
					let currentData = "";

					while (true) {
						const { done, value } = await reader.read();
						if (done) break;

						buffer += decoder.decode(value, { stream: true });
						const lines = buffer.split("\n");
						buffer = lines.pop() ?? "";

						for (const line of lines) {
							if (line.startsWith("event: ")) {
								currentEvent = line.slice(7).trim();
							} else if (line.startsWith("data: ")) {
								currentData = line.slice(6).trim();
							} else if (line === "" && currentEvent && currentData) {
								if (currentEvent === "result") {
									const parsed = JSON.parse(currentData);
									const suggestions = (parsed.shapes ?? []).slice(0, maxSuggestions);
									showSuggestions(suggestions);
								}
								currentEvent = "";
								currentData = "";
							}
						}
					}

					reader.cancel().catch(() => {});
				} catch {
					// Silently fail — copilot suggestions are best-effort
				} finally {
					requesting = false;
				}
			}

			// Show suggestions as ghost shapes
			function showSuggestions(shapes: CopilotSuggestion[]): void {
				dismissAll();
				for (const shape of shapes) {
					const suggestionId = `ai-suggestion-${generateId()}`;
					activeSuggestionIds.add(suggestionId);
					ctx.transient.emit({
						id: suggestionId,
						type: "ai-suggestion",
						sourceUserId: "ai-copilot",
						position: { x: 0, y: 0 },
						data: { suggestion: { ...shape, id: suggestionId }, interactive: true },
						ttl: 30000,
						createdAt: Date.now(),
					});
				}
			}

			// Debounced trigger
			function scheduleSuggestion(): void {
				if (!enabled) return;
				if (debounceTimer) clearTimeout(debounceTimer);
				debounceTimer = setTimeout(() => {
					requestSuggestions();
				}, debounceMs);
			}

			// Listen to shape events
			const unsubAdded = ctx.events.on("shape:added", () => scheduleSuggestion());
			const unsubUpdated = ctx.events.on("shape:updated", () => scheduleSuggestion());

			// Listen to AI status (don't suggest while AI is busy)
			const unsubStatus = ctx.events.on<AiStatusEvent>("ai:status", (status) => {
				aiIsBusy = status.status === "thinking" || status.status === "placing";
				if (aiIsBusy) {
					// Cancel pending suggestion request
					if (debounceTimer) {
						clearTimeout(debounceTimer);
						debounceTimer = null;
					}
					dismissAll();
				}
			});

			// Escape to dismiss all
			function onKeyDown(e: KeyboardEvent): void {
				if (e.key === "Escape" && activeSuggestionIds.size > 0) {
					dismissAll();
				}
			}
			window.addEventListener("keydown", onKeyDown);

			// Toggle copilot
			const unsubToggle = ctx.events.on<{ enabled: boolean }>("copilot:toggle", (data) => {
				enabled = data.enabled;
				if (!enabled) {
					dismissAll();
					if (debounceTimer) {
						clearTimeout(debounceTimer);
						debounceTimer = null;
					}
				}
			});

			cleanup = () => {
				if (debounceTimer) clearTimeout(debounceTimer);
				dismissAll();
				unsubAdded();
				unsubUpdated();
				unsubStatus();
				unsubToggle();
				window.removeEventListener("keydown", onKeyDown);
				const styleEl = document.getElementById(STYLE_ID);
				if (styleEl) styleEl.remove();
			};
		},

		teardown() {
			cleanup?.();
		},
	};
}
