import { exportCanvas } from "@edv4h/usketch-plugin-export";
import { sanitizeLangSource, setOpenUILibrary } from "@edv4h/usketch-plugin-shape-openui";
import {
	type BoundingBox,
	DEFAULT_STYLE,
	generateId,
	type PluginContext,
	type ShapeData,
	type UsketchPlugin,
} from "@edv4h/usketch-shared";
import { createAddShapeCommand } from "@edv4h/usketch-store";
import { useCallback, useEffect, useRef, useState } from "react";
import { OPENUI_DEFAULT_LIBRARY_ID, openuiDefaultLibrary } from "./default-library.js";
import { buildSystemPrompt } from "./system-prompt.js";
import type { OpenUIGenerateRequest, OpenUIToolOptions } from "./types.js";

const TOOL_ID = "openui";
const SIDE_PANEL_TAB_ID = "openui";
const GENERATE_EVENT = "openui:generate-request";
const AI_STATUS_EVENT = "ai:status";

interface AiStatusPayload {
	status: "thinking" | "placing" | "done" | "error";
	message?: string;
	shapeCount?: number;
	source?: string;
}

function viewportCenterToWorld(viewport: { x: number; y: number; zoom: number }): {
	x: number;
	y: number;
} {
	if (typeof window === "undefined") return { x: 0, y: 0 };
	return {
		x: (window.innerWidth / 2 - viewport.x) / viewport.zoom,
		y: (window.innerHeight / 2 - viewport.y) / viewport.zoom,
	};
}

function unionBounds(shapes: ShapeData[]): BoundingBox | null {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (const s of shapes) {
		if (s.x < minX) minX = s.x;
		if (s.y < minY) minY = s.y;
		if (s.x + s.width > maxX) maxX = s.x + s.width;
		if (s.y + s.height > maxY) maxY = s.y + s.height;
	}
	if (minX === Number.POSITIVE_INFINITY) return null;
	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function createOpenUIToolPlugin(opts: OpenUIToolOptions): UsketchPlugin {
	const {
		provider,
		library = openuiDefaultLibrary,
		libraryId = OPENUI_DEFAULT_LIBRARY_ID,
		model,
		enableMakeReal = provider.supportsVision,
		systemPrompt,
		timeoutMs = 60_000,
		stream: defaultStream = true,
	} = opts;

	return {
		id: "usketch-plugin-tool-openui",
		name: "OpenUI Tool",

		setup(ctx: PluginContext) {
			setOpenUILibrary(library);
			let activeController: AbortController | null = null;
			let placementBase: { x: number; y: number } | null = null;

			const emitStatus = (payload: AiStatusPayload): void => {
				ctx.events.emit(AI_STATUS_EVENT, { ...payload, source: "openui" });
			};

			async function runGenerate(req: OpenUIGenerateRequest): Promise<void> {
				if (activeController) activeController.abort();
				const controller = new AbortController();
				activeController = controller;
				const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

				// Gate every emit on this generation still being the active one.
				// Without this, a slow-to-unwind cancelled generation could overwrite
				// the "thinking" status of a freshly-started one.
				const safeEmit = (payload: AiStatusPayload): void => {
					if (activeController !== controller) return;
					emitStatus(payload);
				};

				safeEmit({ status: "thinking", message: "Generating UI…" });
				const resolvedSystemPrompt = systemPrompt ?? buildSystemPrompt(library);

				const collect = async (stream: boolean): Promise<string> => {
					let buf = "";
					let lastReport = 0;
					for await (const chunk of provider.generate(req.prompt, {
						stream,
						model,
						vision: req.vision,
						signal: controller.signal,
						systemPrompt: resolvedSystemPrompt,
					})) {
						buf += chunk;
						const now = Date.now();
						if (now - lastReport > 200) {
							lastReport = now;
							safeEmit({
								status: "thinking",
								message: stream
									? `Streaming… (${buf.length} chars)`
									: `Receiving… (${buf.length} chars)`,
							});
						}
					}
					return buf;
				};

				let buffer = "";
				try {
					buffer = await collect(defaultStream);
					// Some OpenAI-compatible endpoints accept `stream: true` but
					// reply with a plain JSON body — the streaming parser yields no
					// deltas and we end up here with an empty buffer. Retry once
					// in non-streaming mode before giving up.
					if (defaultStream && sanitizeLangSource(buffer).length === 0) {
						buffer = await collect(false);
					}
					const cleaned = sanitizeLangSource(buffer);
					if (!cleaned) throw new Error("Empty response from model");

					safeEmit({ status: "placing", message: "Creating shape…", shapeCount: 1 });

					const viewport = ctx.store.getViewport();
					const base = placementBase ?? viewportCenterToWorld(viewport);
					placementBase = null;
					const id = generateId();
					const shape = {
						id,
						type: "openui",
						x: Math.round(base.x - 240),
						y: Math.round(base.y - 180),
						width: 480,
						height: 360,
						style: { ...DEFAULT_STYLE, fill: "#ffffff", stroke: "#e5e7eb", strokeWidth: 1 },
						langSource: cleaned,
						prompt: req.prompt,
						model: model ?? provider.defaultModel,
						libraryId,
					} as ShapeData;
					ctx.commands.execute(createAddShapeCommand(ctx.store, shape));
					ctx.store.setSelection([id]);

					safeEmit({ status: "done", shapeCount: 1, message: "Created!" });
				} catch (err) {
					if (controller.signal.aborted) {
						// User-initiated cancel or timeout — release the busy state
						// so the side panel doesn't stay disabled forever.
						safeEmit({ status: "done", message: "Cancelled" });
						return;
					}
					safeEmit({
						status: "error",
						message: err instanceof Error ? err.message : "Generation failed",
					});
				} finally {
					window.clearTimeout(timeoutId);
					if (activeController === controller) activeController = null;
				}
			}

			ctx.tools.register(TOOL_ID, {
				icon: SparkleIcon,
				cursor: "default",
				shortcut: "u",
				order: 30,
				onActivate: () => {
					ctx.events.emit("side-panel:open", { tabId: SIDE_PANEL_TAB_ID });
				},
				onPointerDown: () => {
					// Prompt-driven, not pointer-driven.
				},
			});

			ctx.events.emit("side-panel:register-tab", {
				tab: {
					id: SIDE_PANEL_TAB_ID,
					label: "OpenUI",
					icon: "✨",
					order: 25,
					render: () => (
						<OpenUISidePanel
							events={ctx.events}
							provider={provider}
							model={model}
							onCancel={() => activeController?.abort()}
						/>
					),
				},
			});

			// 選択から「Make Real」対象の shape 群を取り出す。空 / openui 自身を
			// 含む場合は対象外（自己参照生成を避ける）。
			const selectionForMakeReal = (): ShapeData[] => {
				const shapes = [...ctx.store.getSelection()]
					.map((id) => ctx.store.getShape(id))
					.filter((s): s is ShapeData => Boolean(s));
				if (shapes.length === 0) return [];
				if (shapes.some((s) => s.type === "openui")) return [];
				return shapes;
			};

			async function runMakeReal(): Promise<void> {
				const shapes = selectionForMakeReal();
				if (shapes.length === 0) return;
				try {
					const selectionMap = new Map<string, ShapeData>();
					for (const s of shapes) selectionMap.set(s.id, s);
					const blob = await exportCanvas(selectionMap, ctx.shapes, {
						format: "png",
						pixelRatio: 2,
						background: "#ffffff",
					});
					const imageDataUrl: string = await new Promise((resolve, reject) => {
						const reader = new FileReader();
						reader.onload = () => resolve(reader.result as string);
						reader.onerror = () => reject(new Error("Failed to read screenshot"));
						reader.readAsDataURL(blob);
					});
					// 生成 shape は元選択の右隣に配置する。
					const bounds = unionBounds(shapes);
					placementBase = bounds
						? { x: bounds.x + bounds.width + 280, y: bounds.y + bounds.height / 2 }
						: null;
					ctx.events.emit(GENERATE_EVENT, {
						prompt: "Build a real, polished UI that faithfully matches this sketch.",
						vision: { imageDataUrl },
					});
				} catch (err) {
					emitStatus({
						status: "error",
						message: err instanceof Error ? err.message : "Make Real failed",
					});
				}
			}

			// 追従ボタンではなく Control HUD の Action として提供する。
			let offMakeRealAction: (() => void) | undefined;
			if (enableMakeReal && provider.supportsVision) {
				offMakeRealAction = ctx.actions.register({
					id: "openui:make-real",
					label: "✨ Make Real",
					group: "AI",
					isEnabled: () => selectionForMakeReal().length > 0,
					run: () => {
						void runMakeReal();
					},
				});
			}

			const offGenerate = ctx.events.on(GENERATE_EVENT, (data: unknown) => {
				void runGenerate(data as OpenUIGenerateRequest);
			});

			return () => {
				offGenerate();
				offMakeRealAction?.();
				ctx.events.emit("side-panel:unregister-tab", { tabId: SIDE_PANEL_TAB_ID });
				setOpenUILibrary(null);
				activeController?.abort();
			};
		},
	};
}

function SparkleIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
			<path d="M10 2l1.8 4.2L16 8l-4.2 1.8L10 14l-1.8-4.2L4 8l4.2-1.8L10 2z" fill="currentColor" />
		</svg>
	);
}

// ─── Side panel UI ──────────────────────────────────────────────────────

interface SidePanelProps {
	events: import("@edv4h/usketch-shared").EventBus;
	provider: import("./providers/types.js").OpenUIProvider;
	model?: string;
	onCancel: () => void;
}

function OpenUISidePanel({ events, provider, model, onCancel }: SidePanelProps) {
	const [prompt, setPrompt] = useState("");
	const [status, setStatus] = useState<AiStatusPayload | null>(null);
	const isComposingRef = useRef(false);
	// Track the pending auto-clear timeout so we can cancel it on unmount or
	// when a new terminal status arrives. Otherwise React fires `setStatus(null)`
	// after the panel has been torn down and we leak setTimeout handles.
	const clearTimeoutRef = useRef<number | null>(null);
	const selectedModel = model ?? provider.defaultModel;

	useEffect(() => {
		const off = events.on(AI_STATUS_EVENT, (data: unknown) => {
			const payload = data as AiStatusPayload;
			if (payload.source !== "openui") return;
			// Cancel any pending auto-clear on EVERY status update — otherwise a
			// "done" status quickly followed by a new "thinking" would let the
			// old 3s timer fire and clear the busy state mid-generation.
			if (clearTimeoutRef.current !== null) {
				window.clearTimeout(clearTimeoutRef.current);
				clearTimeoutRef.current = null;
			}
			setStatus(payload);
			if (payload.status === "done" || payload.status === "error") {
				clearTimeoutRef.current = window.setTimeout(() => {
					setStatus(null);
					clearTimeoutRef.current = null;
				}, 3000);
			}
		});
		return () => {
			off();
			if (clearTimeoutRef.current !== null) {
				window.clearTimeout(clearTimeoutRef.current);
				clearTimeoutRef.current = null;
			}
		};
	}, [events]);

	const isBusy = status?.status === "thinking" || status?.status === "placing";

	const handleSubmit = useCallback(() => {
		const trimmed = prompt.trim();
		if (!trimmed || isBusy) return;
		events.emit(GENERATE_EVENT, { prompt: trimmed });
	}, [prompt, isBusy, events]);

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16 }}>
			<div style={{ fontSize: 13, color: "#71717a" }}>
				Describe the UI widget to add to the canvas. Generated via <strong>{provider.label}</strong>
				{selectedModel ? (
					<>
						{" · "}
						<code style={{ fontSize: 12 }}>{selectedModel}</code>
					</>
				) : null}
				.
			</div>
			<textarea
				value={prompt}
				onChange={(e) => setPrompt(e.target.value)}
				onCompositionStart={() => {
					isComposingRef.current = true;
				}}
				onCompositionEnd={() => {
					isComposingRef.current = false;
				}}
				onKeyDown={(e) => {
					if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !isComposingRef.current) {
						e.preventDefault();
						handleSubmit();
					}
				}}
				placeholder="e.g. a pricing card with three tiers"
				rows={5}
				disabled={isBusy}
				style={{
					width: "100%",
					padding: 10,
					border: "1px solid #cbd5e1",
					borderRadius: 6,
					fontSize: 14,
					fontFamily: "inherit",
					resize: "vertical",
					background: isBusy ? "#f4f4f5" : "#ffffff",
				}}
			/>
			<div style={{ display: "flex", gap: 8 }}>
				<button
					type="button"
					onClick={handleSubmit}
					disabled={isBusy || !prompt.trim()}
					style={{
						flex: 1,
						padding: "8px 14px",
						borderRadius: 6,
						border: "1px solid #0f172a",
						background: isBusy || !prompt.trim() ? "#94a3b8" : "#0f172a",
						color: "#ffffff",
						cursor: isBusy || !prompt.trim() ? "not-allowed" : "pointer",
						fontSize: 14,
						fontWeight: 500,
					}}
				>
					{isBusy ? "Generating…" : "Generate (Ctrl/⌘+Enter)"}
				</button>
				{isBusy ? (
					<button
						type="button"
						onClick={onCancel}
						style={{
							padding: "8px 14px",
							borderRadius: 6,
							border: "1px solid #cbd5e1",
							background: "#ffffff",
							cursor: "pointer",
							fontSize: 14,
						}}
					>
						Cancel
					</button>
				) : null}
			</div>
			{status ? (
				<div
					style={{
						padding: 8,
						borderRadius: 6,
						background:
							status.status === "error"
								? "#fee2e2"
								: status.status === "done"
									? "#dcfce7"
									: "#f1f5f9",
						color:
							status.status === "error"
								? "#991b1b"
								: status.status === "done"
									? "#166534"
									: "#0f172a",
						fontSize: 13,
					}}
				>
					{status.message ?? status.status}
				</div>
			) : null}
		</div>
	);
}
