import { getAnchorPoint } from "@edv4h/usketch-connector-anchor";
import {
	generateId,
	type PluginContext,
	type ShapeData,
	type UsketchPlugin,
} from "@edv4h/usketch-shared";
import { useEffect, useSyncExternalStore } from "react";
import { type FrameBox, layoutDiagram } from "./layout.js";
import { summarizeToDiagram, type VoiceSummary } from "./summarizer.js";
import { createWebSpeechTranscriber, type Transcriber } from "./transcriber.js";

export interface VoiceNotesPluginOptions {
	/** API origin for the AI proxy (e.g. http://localhost:8787). */
	apiUrl: string;
	boardId?: string;
	/** Extra request headers (dev `X-User-Id` shim). */
	extraHeaders?: Record<string, string>;
	/** Recognition language. Default "ja-JP". */
	lang?: string;
	/** Swap the transcriber (e.g. a future server Whisper impl). Default = Web Speech. */
	createTranscriber?: () => Transcriber;
}

type Phase = "idle" | "recording" | "summarizing" | "error";
interface UiState {
	phase: Phase;
	interim: string;
	error?: string;
}

const boxShape = (b: { x: number; y: number; w: number; h: number }): ShapeData =>
	({ x: b.x, y: b.y, width: b.w, height: b.h, id: "", type: "rectangle", style: {} }) as ShapeData;

export function createVoiceNotesPlugin(options: VoiceNotesPluginOptions): UsketchPlugin {
	return {
		id: "usketch-plugin-voice-notes",
		name: "Voice Notes",

		setup(ctx: PluginContext) {
			const transcriber = (
				options.createTranscriber ?? (() => createWebSpeechTranscriber({ lang: options.lang }))
			)();

			let ui: UiState = { phase: "idle", interim: "" };
			const listeners = new Set<() => void>();
			let errorTimer: ReturnType<typeof setTimeout> | null = null;
			// Re-registering the actions is how the Control HUD is nudged to re-evaluate
			// isActive/isEnabled after an ASYNC phase change (it only re-renders on the
			// actions registry's notify) — otherwise the toggle button stays lit after
			// recording ends on its own. Assigned once `mountActions` exists below.
			let refreshActions = () => {};
			const setUi = (next: Partial<UiState>) => {
				const prevPhase = ui.phase;
				ui = { ...ui, ...next };
				for (const cb of listeners) cb();
				if (next.phase !== undefined && next.phase !== prevPhase) refreshActions();
			};

			let segments: string[] = [];

			const start = () => {
				if (ui.phase === "recording" || ui.phase === "summarizing") return;
				if (errorTimer) {
					clearTimeout(errorTimer);
					errorTimer = null;
				}
				segments = [];
				setUi({ phase: "recording", interim: "", error: undefined });
				transcriber.start({
					onInterim: (t) => setUi({ interim: t }),
					onFinal: (t) => {
						if (t) segments.push(t);
						setUi({ interim: "" });
					},
					onError: (msg) => {
						ctx.events.emit("voice:status", { status: "error", message: msg });
						// Surface the reason instead of silently vanishing; the mic-blinking
						// culprits (network to Google / mic permission) land here.
						setUi({ phase: "error", interim: "", error: msg });
						errorTimer = setTimeout(() => {
							if (ui.phase === "error") setUi({ phase: "idle", error: undefined });
						}, 6000);
					},
					onEnd: () => {
						// onEnd fires on user stop AND on unexpected end; only summarize
						// from the user-stop path (phase still "recording"). An error has
						// already moved us to "error", so we won't summarize a broken run.
						if (ui.phase === "recording") void finish();
					},
				});
			};

			const stop = () => {
				if (ui.phase === "recording") transcriber.stop();
			};

			const finish = async () => {
				const transcript = segments.join("\n").trim();
				if (!transcript) {
					setUi({ phase: "idle", interim: "" });
					return;
				}
				setUi({ phase: "summarizing", interim: "" });
				let summary: VoiceSummary | null = null;
				try {
					summary = await summarizeToDiagram(options.apiUrl, transcript, {
						boardId: options.boardId,
						headers: options.extraHeaders,
					});
				} catch {
					summary = null;
				}
				createNotesFrame(ctx, transcript, summary);
				setUi({ phase: "idle", interim: "" });
			};

			// ── Actions (Control HUD → "Voice Notes") ──
			const actionDefs = [
				{
					id: "voice-notes:toggle",
					label: "🎙 音声メモ（録音/停止）",
					group: "Voice Notes",
					order: 0,
					isEnabled: () => transcriber.available && ui.phase !== "summarizing",
					isActive: () => ui.phase === "recording",
					run: () => (ui.phase === "recording" ? stop() : start()),
				},
				{
					id: "voice-notes:resummarize",
					label: "↻ 選択メモを再要約",
					group: "Voice Notes",
					order: 1,
					isEnabled: () => selectedTranscript(ctx) !== null,
					run: async () => {
						const sel = selectedTranscript(ctx);
						if (!sel) return;
						setUi({ phase: "summarizing", interim: "" });
						let summary: VoiceSummary | null = null;
						try {
							summary = await summarizeToDiagram(options.apiUrl, sel.transcript, {
								boardId: options.boardId,
								headers: options.extraHeaders,
							});
						} catch {
							summary = null;
						}
						createNotesFrame(ctx, sel.transcript, summary, { near: sel.frame });
						setUi({ phase: "idle", interim: "" });
					},
				},
			];
			// Re-registering (same ids) replaces + notifies the HUD → it re-reads
			// isActive/isEnabled. Used by setUi on async phase changes.
			const mountActions = () => actionDefs.map((a) => ctx.actions.register(a));
			let offActions = mountActions();
			refreshActions = () => {
				for (const off of offActions) off();
				offActions = mountActions();
			};

			// ── Indicator (fixed screen overlay) ──
			ctx.layers.register({
				id: "voice-notes-indicator",
				order: 99,
				fixed: true,
				render: () => (
					<VoiceIndicator
						subscribe={(cb) => (listeners.add(cb), () => listeners.delete(cb))}
						get={() => ui}
					/>
				),
			});
			ctx.events.emit("layers:changed", {});

			return () => {
				transcriber.stop();
				if (errorTimer) clearTimeout(errorTimer);
				for (const off of offActions) off();
				ctx.layers.unregister("voice-notes-indicator");
				ctx.events.emit("layers:changed", {});
				listeners.clear();
			};
		},
	};
}

// ── Frame + diagram construction ──

const FRAME_W = 520;
const FRAME_H = 380;

function createNotesFrame(
	ctx: PluginContext,
	transcript: string,
	summary: VoiceSummary | null,
	opts: { near?: ShapeData } = {},
): void {
	const vp = ctx.store.getViewport();
	const base = opts.near
		? { x: opts.near.x + opts.near.width + 40, y: opts.near.y }
		: {
				x: (window.innerWidth / 2 - vp.x) / vp.zoom - FRAME_W / 2,
				y: (window.innerHeight / 2 - vp.y) / vp.zoom - FRAME_H / 2,
			};

	const frameId = generateId();
	const frame: ShapeData = {
		id: frameId,
		type: "frame",
		x: Math.round(base.x),
		y: Math.round(base.y),
		width: FRAME_W,
		height: FRAME_H,
		style: { fill: "#f8f8f8", stroke: "#1e1e1e", strokeWidth: 2, opacity: 1 },
		// The raw transcript is the source of truth; the visible children are the summary.
		meta: { kind: "voice-notes", transcript, summarizedAt: Date.now() },
		frameTitle: summary?.title ?? "音声メモ",
	} as ShapeData;

	const shapes: ShapeData[] = [frame];

	const frameBox: FrameBox = { x: frame.x, y: frame.y, width: FRAME_W, height: FRAME_H };

	if (summary && summary.points.length > 0) {
		const { boxes, edges } = layoutDiagram(summary.points, summary.links, frameBox);
		const ids = boxes.map(() => generateId());
		boxes.forEach((b, i) => {
			shapes.push({
				id: ids[i],
				type: "rounded-rect",
				parentId: frameId,
				x: b.x,
				y: b.y,
				width: b.w,
				height: b.h,
				style: { fill: "#ffffff", stroke: "#1e1e1e", strokeWidth: 2, opacity: 1 },
				text: b.detail ? `${b.label}\n${b.detail}` : b.label,
				fontSize: 13,
				isEditing: false,
			} as ShapeData);
		});
		for (const e of edges) {
			const a = boxes[e.from];
			const b = boxes[e.to];
			const aC = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
			const bC = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
			const sp = getAnchorPoint(boxShape(a), "auto", bC);
			const tp = getAnchorPoint(boxShape(b), "auto", aC);
			shapes.push({
				id: generateId(),
				type: "connector",
				parentId: frameId,
				x: Math.min(sp.x, tp.x),
				y: Math.min(sp.y, tp.y),
				width: Math.abs(tp.x - sp.x),
				height: Math.abs(tp.y - sp.y),
				style: { fill: "transparent", stroke: "#1e1e1e", strokeWidth: 2, opacity: 1 },
				sourceId: ids[e.from],
				targetId: ids[e.to],
				sourceAnchor: "auto",
				targetAnchor: "auto",
				sourcePoint: sp,
				targetPoint: tp,
				arrowHead: "forward",
				pathType: "straight",
			} as ShapeData);
		}
	} else {
		// Fallback: no diagram — drop the transcript as a markdown note inside the frame.
		shapes.push({
			id: generateId(),
			type: "markdown",
			parentId: frameId,
			x: frame.x + 20,
			y: frame.y + 48,
			width: FRAME_W - 40,
			height: FRAME_H - 68,
			style: { fill: "transparent", strokeWidth: 0, stroke: "#1e1e1e", opacity: 1 },
			meta: { source: `### 音声メモ\n\n${transcript}`, isEditing: false },
		} as ShapeData);
	}

	// One undoable step for the whole notes frame.
	ctx.commands.execute({
		execute: () => {
			for (const s of shapes) ctx.store.addShape(s);
			ctx.store.setSelection([frameId]);
		},
		undo: () => {
			for (const s of shapes) ctx.store.deleteShape(s.id);
		},
	});
}

function selectedTranscript(ctx: PluginContext): { transcript: string; frame: ShapeData } | null {
	const sel = [...ctx.store.getSelection()];
	if (sel.length !== 1) return null;
	const shape = ctx.store.getShape(sel[0]);
	const meta = shape?.meta as { kind?: string; transcript?: string } | undefined;
	if (
		shape?.type === "frame" &&
		meta?.kind === "voice-notes" &&
		typeof meta.transcript === "string"
	) {
		return { transcript: meta.transcript, frame: shape };
	}
	return null;
}

// ── Indicator component ──

function VoiceIndicator({
	subscribe,
	get,
}: {
	subscribe: (cb: () => void) => () => void;
	get: () => UiState;
}) {
	const ui = useSyncExternalStore(subscribe, get);
	// biome-ignore lint/correctness/useExhaustiveDependencies: pulse keyframes injected once
	useEffect(() => injectStyle(), []);
	if (ui.phase === "idle") return null;
	const recording = ui.phase === "recording";
	const error = ui.phase === "error";
	const palette = error
		? { bg: "#fff7ed", border: "#fdba74", dot: "#f97316" }
		: recording
			? { bg: "#fef2f2", border: "#fca5a5", dot: "#ef4444" }
			: { bg: "#eff6ff", border: "#93c5fd", dot: "#3b82f6" };
	const label = error ? "音声認識エラー" : recording ? "録音中" : "要約中…";
	const detail = error ? errorHint(ui.error) : ui.interim;
	return (
		<div
			style={{
				position: "fixed",
				bottom: 16,
				left: "50%",
				transform: "translateX(-50%)",
				display: "flex",
				alignItems: "center",
				gap: 8,
				maxWidth: "60vw",
				padding: "8px 14px",
				borderRadius: 20,
				background: palette.bg,
				border: `1px solid ${palette.border}`,
				boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
				fontFamily: "system-ui, sans-serif",
				fontSize: 13,
				color: "#1f2937",
				pointerEvents: "none",
			}}
		>
			<span
				style={{
					width: 10,
					height: 10,
					borderRadius: "50%",
					background: palette.dot,
					animation: recording ? "usketch-voice-pulse 1.2s ease-in-out infinite" : undefined,
				}}
			/>
			<span style={{ fontWeight: 600 }}>{label}</span>
			{detail && (
				<span
					style={{
						color: "#6b7280",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
					}}
				>
					{detail}
				</span>
			)}
		</div>
	);
}

/** Human-friendly hint for a Web Speech API error code. */
function errorHint(err?: string): string {
	switch (err) {
		case "network":
			return "network — ネットワーク/拡張機能が音声認識をブロックしている可能性";
		case "not-allowed":
		case "service-not-allowed":
			return `${err} — マイクの権限を許可してください`;
		case "audio-capture":
			return "audio-capture — マイクが見つかりません";
		default:
			return err ?? "";
	}
}

let styleInjected = false;
function injectStyle() {
	if (styleInjected || typeof document === "undefined") return;
	styleInjected = true;
	const el = document.createElement("style");
	el.textContent =
		"@keyframes usketch-voice-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }";
	document.head.appendChild(el);
}
