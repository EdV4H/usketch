import type { AiStatusEvent } from "@edv4h/usketch-plugin-ai-agent";
import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { generateId } from "@edv4h/usketch-shared";

import { GhostShape } from "./ghost-shape.js";
import type { CopilotOptions, CopilotSuggestion } from "./types.js";

const STYLE_ID = "usketch-ai-copilot-styles";
const STYLES = `
@keyframes ai-ghost-fade-in {
	from { opacity: 0; transform: scale(0.95); }
	to { opacity: 1; transform: scale(1); }
}
button:hover > .ai-ghost-accept-btn {
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
	let enabled = options.enabled ?? false;

	return {
		id: "usketch-plugin-ai-copilot",
		name: "AI Copilot",

		setup(ctx: PluginContext) {
			let debounceTimer: ReturnType<typeof setTimeout> | null = null;
			let aiIsBusy = false;
			let requesting = false;
			let activeController: AbortController | null = null;
			const activeSuggestionIds = new Set<string>();

			// Inject styles
			if (!document.getElementById(STYLE_ID)) {
				const styleEl = document.createElement("style");
				styleEl.id = STYLE_ID;
				styleEl.textContent = STYLES;
				document.head.appendChild(styleEl);
			}

			// Accept handler: ShapeDefinition.createDefault を使って正しいデフォルトで生成
			function acceptSuggestion(suggestion: CopilotSuggestion): void {
				const id = generateId();
				const def = ctx.shapes.get(suggestion.type);

				let shape: import("@edv4h/usketch-shared").ShapeData;
				if (def) {
					// ShapeDefinitionのcreateDefaultで正しいデフォルトを取得
					shape = def.createDefault({ id, x: suggestion.x, y: suggestion.y });
					shape.width = suggestion.width;
					shape.height = suggestion.height;
					if (suggestion.text !== undefined) {
						(shape as { text?: string }).text = suggestion.text;
					}
					if (suggestion.fontSize !== undefined) {
						(shape as { fontSize?: number }).fontSize = suggestion.fontSize;
					}
					if (suggestion.style) {
						shape.style = { ...shape.style, ...suggestion.style };
					}
				} else {
					shape = {
						id,
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
				}

				// Command経由でUndo可能に
				const snapshot = { ...shape };
				ctx.commands.execute({
					execute: () => ctx.store.addShape(snapshot),
					undo: () => ctx.store.deleteShape(id),
				});

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

			// Abort active request
			function abortActiveRequest(): void {
				if (activeController) {
					activeController.abort();
					activeController = null;
				}
			}

			// Request suggestions from AI
			async function requestSuggestions(): Promise<void> {
				if (requesting || aiIsBusy || !enabled) return;
				requesting = true;
				abortActiveRequest();

				const controller = new AbortController();
				activeController = controller;

				try {
					const shapes = ctx.store.getShapes();
					const viewport = ctx.store.getViewport();
					const availableTypes = [...ctx.shapes.getAll().keys()];

					const shapeList = [...shapes.values()].slice(-10).map((s) => {
						const ai = ctx.shapes
							.get(s.type)
							?.serializeForAi?.(s, { shapes, registry: ctx.shapes });
						const text = typeof ai?.text === "string" ? (ai.text as string) : "";
						return {
							id: s.id,
							type: s.type,
							x: Math.round(s.x),
							y: Math.round(s.y),
							w: Math.round(s.width),
							h: Math.round(s.height),
							...(text ? { text } : {}),
						};
					});

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

					const reader = response.body.getReader();
					const decoder = new TextDecoder();
					let buffer = "";
					let currentEvent = "";
					let currentData = "";

					try {
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
					} finally {
						reader.cancel().catch(() => {});
					}
				} catch {
					// Silently fail — copilot suggestions are best-effort
				} finally {
					requesting = false;
					if (activeController === controller) {
						activeController = null;
					}
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
				if (shapes.length > 0) {
					const first = shapes[0];
					const text = first?.text
						? `"${first.text}" を追加しませんか？`
						: `${shapes.length} 件のシェイプを提案`;
					ctx.events.emit("copilot:notice", { text });
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
					if (debounceTimer) {
						clearTimeout(debounceTimer);
						debounceTimer = null;
					}
					abortActiveRequest();
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
					abortActiveRequest();
					if (debounceTimer) {
						clearTimeout(debounceTimer);
						debounceTimer = null;
					}
				}
			});

			cleanup = () => {
				if (debounceTimer) clearTimeout(debounceTimer);
				abortActiveRequest();
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
