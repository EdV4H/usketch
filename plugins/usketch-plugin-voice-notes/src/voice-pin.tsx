import {
	type BoundingBox,
	type CanvasPointerEvent,
	generateId,
	type PluginContext,
	type Point,
	type ShapeData,
	type ToolContext,
} from "@edv4h/usketch-shared";
import { buildSummaryChildren, markdownShape, summaryMarkdownSource } from "./diagram.js";
import type { Recorder } from "./recorder.js";
import { summarizeToDiagram, type VoiceSummary } from "./summarizer.js";

export const VOICE_PIN_TYPE = "voice-pin";
export const VOICE_PIN_TOOL_ID = "voice-pin";
const ACTION_EVENT = "usketch:voice-pin-action";
const PIN_W = 40;
const PIN_H = 52;

type VoicePinStatus = "recording" | "transcribing" | "summarizing" | "error";

export interface VoicePinShapeData extends ShapeData {
	type: typeof VOICE_PIN_TYPE;
	status?: VoicePinStatus;
}

/** The world point the pin marks (bottom-center tip). */
const tipOf = (s: ShapeData) => ({ x: s.x + s.width / 2, y: s.y + s.height });

// ── View ──

function VoicePinView({
	data,
	isLocalRecorder,
}: {
	data: VoicePinShapeData;
	isLocalRecorder: boolean;
}) {
	const status = data.status ?? "recording";
	const recording = status === "recording";
	const color = status === "error" ? "#f97316" : recording ? "#ef4444" : "#2563eb";
	const glyph = status === "error" ? "⚠" : recording ? "🎙" : "⏳";
	const canStop = recording && isLocalRecorder;
	const title =
		status === "transcribing" ? "文字起こし中…" : status === "summarizing" ? "要約中…" : undefined;

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				pointerEvents: "none",
				userSelect: "none",
				fontFamily: "system-ui, sans-serif",
			}}
			title={title}
		>
			<button
				type="button"
				disabled={!canStop}
				onPointerDown={(e) => e.stopPropagation()}
				onClick={(e) => {
					e.stopPropagation();
					if (canStop)
						window.dispatchEvent(
							new CustomEvent(ACTION_EVENT, { detail: { id: data.id, action: "stop" } }),
						);
				}}
				style={{
					width: 32,
					height: 32,
					borderRadius: "50% 50% 50% 0",
					transform: "rotate(-45deg)",
					background: color,
					border: "2px solid #fff",
					boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
					cursor: canStop ? "pointer" : "default",
					pointerEvents: "auto",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					animation: recording ? "usketch-voice-pin-pulse 1.2s ease-in-out infinite" : undefined,
				}}
			>
				<span style={{ transform: "rotate(45deg)", fontSize: 13 }}>{canStop ? "⏹" : glyph}</span>
			</button>
		</div>
	);
}

let styleInjected = false;
function injectStyle() {
	if (styleInjected || typeof document === "undefined") return;
	styleInjected = true;
	const el = document.createElement("style");
	el.textContent =
		"@keyframes usketch-voice-pin-pulse { 0%,100% { box-shadow: 0 2px 6px rgba(0,0,0,0.3), 0 0 0 0 rgba(239,68,68,0.5); } 50% { box-shadow: 0 2px 6px rgba(0,0,0,0.3), 0 0 0 10px rgba(239,68,68,0); } }";
	document.head.appendChild(el);
}

// ── Geometry ──

function getBounds(data: ShapeData): BoundingBox {
	return { x: data.x, y: data.y, width: data.width, height: data.height };
}
function hitTest(data: ShapeData, point: Point): boolean {
	return (
		point.x >= data.x &&
		point.x <= data.x + data.width &&
		point.y >= data.y &&
		point.y <= data.y + data.height
	);
}

function PinIcon() {
	return (
		<svg width="20" height="20" viewBox="0 -960 960 960" aria-label="pin">
			<title>voice pin</title>
			<path
				fill="currentColor"
				d="M480-480q33 0 56.5-23.5T560-560t-23.5-56.5T480-640t-56.5 23.5T400-560t23.5 56.5T480-480M480-80Q319-217 239.5-334.5T160-552q0-150 96.5-239T480-880t223.5 89T800-552q0 100-79.5 217.5T480-80"
			/>
		</svg>
	);
}

export interface VoicePinOptions {
	apiUrl: string;
	boardId?: string;
	extraHeaders?: Record<string, string>;
}

/**
 * Register the "recording pin": the pin tool drops a marker at the clicked point
 * and immediately starts recording (via the shared {@link Recorder}). The pin
 * stays until recording ends; clicking it stops. On stop it transcribes +
 * summarizes, removes the pin, and drops a summary diagram plus a transcript-
 * summary markdown at the pin's location. Modeled on the wevox pins plugin's
 * click-to-place tool.
 */
export function registerVoicePin(
	ctx: PluginContext,
	recorder: Recorder,
	options: VoicePinOptions,
): () => void {
	injectStyle();

	const setStatus = (id: string, status: VoicePinStatus) =>
		ctx.store.updateShape(id, { status } as Partial<ShapeData>);

	const placeOutputs = (
		pin: VoicePinShapeData,
		summary: VoiceSummary | null,
		transcript: string,
	) => {
		const tip = tipOf(pin);
		const diagramBox = {
			x: Math.round(tip.x + 12),
			y: Math.round(tip.y + 12),
			width: 520,
			height: 380,
		};
		const diagram = buildSummaryChildren(null, diagramBox, summary, transcript);
		const md = markdownShape(
			{ x: diagramBox.x + diagramBox.width + 20, y: diagramBox.y, w: 320, h: 380 },
			summaryMarkdownSource(summary, transcript),
		);
		const outputs = [...diagram, md];
		ctx.commands.execute({
			execute: () => {
				ctx.store.deleteShape(pin.id); // pin is replaced by its results
				for (const s of outputs) ctx.store.addShape(s);
				ctx.store.setSelection(outputs.map((s) => s.id));
			},
			undo: () => {
				for (const s of outputs) ctx.store.deleteShape(s.id);
				ctx.store.addShape(pin);
			},
		});
	};

	const finish = async (pinId: string, transcript: string) => {
		const pin = ctx.store.getShape(pinId) as VoicePinShapeData | undefined;
		if (!pin) return;
		if (!transcript) {
			ctx.store.deleteShape(pinId); // nothing captured — remove the pin
			return;
		}
		setStatus(pinId, "summarizing");
		let summary: VoiceSummary | null = null;
		try {
			summary = await summarizeToDiagram(options.apiUrl, transcript, {
				boardId: options.boardId,
				headers: options.extraHeaders,
			});
		} catch {
			summary = null;
		}
		const fresh = ctx.store.getShape(pinId) as VoicePinShapeData | undefined;
		if (fresh) placeOutputs(fresh, summary, transcript);
	};

	const onAction = (e: Event) => {
		const { id, action } = (e as CustomEvent<{ id: string; action: string }>).detail;
		if (action === "stop" && recorder.busyId === id) {
			recorder.stop(id);
			setStatus(id, "transcribing");
		}
	};
	window.addEventListener(ACTION_EVENT, onAction);

	ctx.shapes.register(VOICE_PIN_TYPE, {
		render: (shape) => (
			<VoicePinView
				data={shape as VoicePinShapeData}
				isLocalRecorder={recorder.busyId === shape.id}
			/>
		),
		getBounds,
		hitTest,
		resize: (data) => data, // pins are fixed-size markers
		createDefault: (p: { id: string; x: number; y: number }) =>
			({
				id: p.id,
				type: VOICE_PIN_TYPE,
				x: p.x,
				y: p.y,
				width: PIN_W,
				height: PIN_H,
				style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
				status: "recording",
			}) as VoicePinShapeData,
		renderTarget: "html",
		minSize: { width: PIN_W, height: PIN_H },
	});

	// ── Pin tool: one click drops a pin (tip at the click) and starts recording. ──
	ctx.tools.register(VOICE_PIN_TOOL_ID, {
		icon: PinIcon,
		cursor: "crosshair",
		order: 43,
		onPointerDown(toolCtx: ToolContext, event: CanvasPointerEvent) {
			const id = generateId();
			// Place the tip at the clicked world point.
			const pin: VoicePinShapeData = {
				id,
				type: VOICE_PIN_TYPE,
				x: Math.round(event.worldPoint.x - PIN_W / 2),
				y: Math.round(event.worldPoint.y - PIN_H),
				width: PIN_W,
				height: PIN_H,
				style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
				status: "recording",
			};
			const ok = recorder.start(id, {
				onError: () => setStatus(id, "error"),
				onDone: (transcript) => void finish(id, transcript),
			});
			if (ok) {
				toolCtx.store.addShape(pin);
			} else {
				ctx.events.emit("voice:status", { status: "error", message: "既に録音中です" });
			}
			toolCtx.store.resetToDefaultTool();
		},
		onPointerMove() {},
		onPointerUp() {},
	});

	return () => {
		window.removeEventListener(ACTION_EVENT, onAction);
	};
}
