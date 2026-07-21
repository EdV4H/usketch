import {
	type BoundingBox,
	type CanvasPointerEvent,
	generateId,
	type PluginContext,
	type Point,
	type ResizeHandle,
	type ShapeData,
	type ToolContext,
} from "@edv4h/usketch-shared";
import { buildSummaryChildren } from "./diagram.js";
import type { Recorder } from "./recorder.js";
import { summarizeToDiagram } from "./summarizer.js";

export const VOICE_FRAME_TYPE = "voice-frame";
const ACTION_EVENT = "usketch:voice-frame-action";
const HEADER_H = 32;

type VoiceFrameStatus = "empty" | "recording" | "transcribing" | "summarizing" | "done" | "error";

export interface VoiceFrameShapeData extends ShapeData {
	type: typeof VOICE_FRAME_TYPE;
	frameTitle?: string;
	status?: VoiceFrameStatus;
	meta?: { transcript?: string; summarizedAt?: number };
}

type Action = "record" | "stop" | "resummarize";

function emit(id: string, action: Action) {
	window.dispatchEvent(new CustomEvent(ACTION_EVENT, { detail: { id, action } }));
}

// ── View ──

const btn: React.CSSProperties = {
	border: "1px solid #d1d5db",
	borderRadius: 6,
	background: "#f5f5f5",
	color: "#333",
	cursor: "pointer",
	fontSize: 13,
	lineHeight: 1,
	padding: "6px 12px",
	pointerEvents: "auto",
};

function stop(e: React.SyntheticEvent) {
	e.stopPropagation();
}

function VoiceFrameView({
	data,
	isLocalRecorder,
}: {
	data: VoiceFrameShapeData;
	isLocalRecorder: boolean;
}) {
	const status = data.status ?? "empty";
	const busy = status === "transcribing" || status === "summarizing";

	let body: React.ReactNode = null;
	if (status === "recording") {
		body = isLocalRecorder ? (
			<button
				type="button"
				style={btn}
				onPointerDown={stop}
				onClick={(e) => (stop(e), emit(data.id, "stop"))}
			>
				⏹ 停止
			</button>
		) : (
			<span style={{ color: "#b91c1c", fontWeight: 600 }}>🔴 録音中…</span>
		);
	} else if (busy) {
		body = (
			<span style={{ color: "#2563eb" }}>
				{status === "transcribing" ? "文字起こし中…" : "要約中…"}
			</span>
		);
	} else if (status === "error") {
		body = (
			<button
				type="button"
				style={btn}
				onPointerDown={stop}
				onClick={(e) => (stop(e), emit(data.id, "record"))}
			>
				⚠ 失敗 — 再録音
			</button>
		);
	} else if (status !== "done") {
		body = (
			<button
				type="button"
				style={{ ...btn, background: "#fee2e2", borderColor: "#fca5a5" }}
				onPointerDown={stop}
				onClick={(e) => (stop(e), emit(data.id, "record"))}
			>
				🎙 録音開始
			</button>
		);
	}

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				boxSizing: "border-box",
				border: `${data.style.strokeWidth}px solid ${data.style.stroke}`,
				borderRadius: 8,
				background: data.style.fill,
				display: "flex",
				flexDirection: "column",
				fontFamily: "system-ui, sans-serif",
				pointerEvents: "none",
				userSelect: "none",
				overflow: "hidden",
			}}
		>
			<div
				style={{
					height: HEADER_H,
					flex: "0 0 auto",
					display: "flex",
					alignItems: "center",
					gap: 6,
					padding: "0 8px",
					background: "#eef2ff",
					borderBottom: "1px solid #e0e7ff",
				}}
			>
				<span style={{ fontSize: 13 }}>🎙</span>
				<span
					style={{
						flex: 1,
						fontSize: 12,
						fontWeight: 700,
						color: "#3730a3",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
					}}
				>
					{data.frameTitle ?? "録音フレーム"}
				</span>
				{status === "done" && (
					<>
						<button
							type="button"
							title="再要約"
							style={{ ...btn, padding: "2px 6px", fontSize: 12 }}
							onPointerDown={stop}
							onClick={(e) => (stop(e), emit(data.id, "resummarize"))}
						>
							↻
						</button>
						<button
							type="button"
							title="再録音"
							style={{ ...btn, padding: "2px 6px", fontSize: 12 }}
							onPointerDown={stop}
							onClick={(e) => (stop(e), emit(data.id, "record"))}
						>
							🎙
						</button>
					</>
				)}
			</div>
			{/* Body: controls when not done. When done, the summary children (separate
			    shapes parented to this frame) render inside these bounds. */}
			{body && (
				<div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
					{body}
				</div>
			)}
		</div>
	);
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
function resize(data: ShapeData, handle: ResizeHandle, delta: Point): ShapeData {
	let { x, y, width, height } = data;
	switch (handle) {
		case "se":
			width += delta.x;
			height += delta.y;
			break;
		case "nw":
			x += delta.x;
			y += delta.y;
			width -= delta.x;
			height -= delta.y;
			break;
		case "ne":
			y += delta.y;
			width += delta.x;
			height -= delta.y;
			break;
		case "sw":
			x += delta.x;
			width -= delta.x;
			height += delta.y;
			break;
		case "e":
			width += delta.x;
			break;
		case "w":
			x += delta.x;
			width -= delta.x;
			break;
		case "n":
			y += delta.y;
			height -= delta.y;
			break;
		case "s":
			height += delta.y;
			break;
	}
	return { ...data, x, y, width: Math.max(240, width), height: Math.max(160, height) };
}
function createDefault(params: { id: string; x: number; y: number }): VoiceFrameShapeData {
	return {
		id: params.id,
		type: VOICE_FRAME_TYPE,
		x: params.x,
		y: params.y,
		width: 520,
		height: 380,
		style: { fill: "#fbfbfe", stroke: "#6366f1", strokeWidth: 2, opacity: 1 },
		frameTitle: "録音フレーム",
		status: "empty",
	};
}

function VoiceFrameIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
			<rect
				x="3"
				y="4"
				width="14"
				height="12"
				rx="2"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			<rect x="9" y="7" width="2" height="4" rx="1" fill="currentColor" />
			<path d="M8 12a2 2 0 004 0" fill="none" stroke="currentColor" strokeWidth="1.2" />
		</svg>
	);
}

export interface VoiceFrameOptions {
	apiUrl: string;
	boardId?: string;
	extraHeaders?: Record<string, string>;
}

/** Child shape ids currently parented to a frame. */
function childIdsOf(ctx: PluginContext, frameId: string): string[] {
	const out: string[] = [];
	for (const [id, s] of ctx.store.getShapes()) {
		if ((s as ShapeData).parentId === frameId) out.push(id);
	}
	return out;
}

/**
 * Register the interactive "recording frame" shape: place it, hit ▶ to record,
 * ⏹ to stop — then it transcribes, summarizes, and fills ITSELF with the summary
 * diagram (children parented to the frame). Raw transcript lives on the frame's
 * `meta`. Recording goes through the shared {@link Recorder} (one mic globally).
 */
export function registerVoiceFrame(
	ctx: PluginContext,
	recorder: Recorder,
	options: VoiceFrameOptions,
): () => void {
	const setStatus = (id: string, status: VoiceFrameStatus) =>
		ctx.store.updateShape(id, { status } as Partial<ShapeData>);

	const applySummary = (
		frameId: string,
		summary: Parameters<typeof buildSummaryChildren>[2],
		transcript: string,
	) => {
		const frame = ctx.store.getShape(frameId) as VoiceFrameShapeData | undefined;
		if (!frame) return;
		const box = { x: frame.x, y: frame.y, width: frame.width, height: frame.height };
		const oldChildren = childIdsOf(ctx, frameId)
			.map((id) => ctx.store.getShape(id))
			.filter(Boolean) as ShapeData[];
		const children = buildSummaryChildren(frameId, box, summary, transcript);
		const title = summary?.title ?? frame.frameTitle ?? "録音フレーム";
		const prevFrame = { ...frame };
		ctx.commands.execute({
			execute: () => {
				for (const c of oldChildren) ctx.store.deleteShape(c.id);
				for (const c of children) ctx.store.addShape(c);
				ctx.store.updateShape(frameId, {
					status: "done",
					frameTitle: title,
					meta: { transcript, summarizedAt: Date.now() },
				} as Partial<ShapeData>);
			},
			undo: () => {
				for (const c of children) ctx.store.deleteShape(c.id);
				for (const c of oldChildren) ctx.store.addShape(c);
				ctx.store.updateShape(frameId, prevFrame as Partial<ShapeData>);
			},
		});
	};

	const runSummarize = async (frameId: string, transcript: string) => {
		setStatus(frameId, "summarizing");
		let summary = null;
		try {
			summary = await summarizeToDiagram(options.apiUrl, transcript, {
				boardId: options.boardId,
				headers: options.extraHeaders,
			});
		} catch {
			summary = null;
		}
		applySummary(frameId, summary, transcript);
	};

	const onAction = (e: Event) => {
		const { id, action } = (e as CustomEvent<{ id: string; action: Action }>).detail;
		const shape = ctx.store.getShape(id) as VoiceFrameShapeData | undefined;
		if (!shape || shape.type !== VOICE_FRAME_TYPE) return;

		if (action === "record") {
			const ok = recorder.start(id, {
				onError: () => setStatus(id, "error"),
				onDone: (transcript) => {
					if (!transcript) {
						setStatus(id, "empty");
						return;
					}
					setStatus(id, "transcribing");
					void runSummarize(id, transcript);
				},
			});
			if (ok) setStatus(id, "recording");
		} else if (action === "stop") {
			if (recorder.busyId === id) {
				recorder.stop(id);
				setStatus(id, "transcribing");
			}
		} else if (action === "resummarize") {
			const transcript = shape.meta?.transcript;
			if (transcript) void runSummarize(id, transcript);
		}
	};
	window.addEventListener(ACTION_EVENT, onAction);

	ctx.shapes.register(VOICE_FRAME_TYPE, {
		render: (shape) => (
			<VoiceFrameView
				data={shape as VoiceFrameShapeData}
				isLocalRecorder={recorder.busyId === shape.id}
			/>
		),
		getBounds,
		hitTest,
		resize,
		createDefault,
		renderTarget: "html",
		minSize: { width: 240, height: 160 },
		container: { selectableChildren: true, autoAttach: false },
	});

	// ── Draw tool ──
	let drawState: { startX: number; startY: number; shapeId: string } | null = null;
	ctx.tools.register("voice-frame-draw", {
		icon: VoiceFrameIcon,
		cursor: "crosshair",
		order: 42,
		onPointerDown(toolCtx: ToolContext, event: CanvasPointerEvent) {
			const id = generateId();
			drawState = { startX: event.worldPoint.x, startY: event.worldPoint.y, shapeId: id };
			const shape = createDefault({ id, x: event.worldPoint.x, y: event.worldPoint.y });
			shape.width = 0;
			shape.height = 0;
			toolCtx.store.addShape(shape);
		},
		onPointerMove(toolCtx: ToolContext, event: CanvasPointerEvent) {
			if (!drawState) return;
			const x = Math.min(drawState.startX, event.worldPoint.x);
			const y = Math.min(drawState.startY, event.worldPoint.y);
			toolCtx.store.updateShape(drawState.shapeId, {
				x,
				y,
				width: Math.abs(event.worldPoint.x - drawState.startX),
				height: Math.abs(event.worldPoint.y - drawState.startY),
			});
		},
		onPointerUp(toolCtx: ToolContext) {
			if (!drawState) return;
			const shape = toolCtx.store.getShape(drawState.shapeId);
			toolCtx.store.deleteShape(drawState.shapeId);
			const def =
				shape && shape.width > 40 && shape.height > 40
					? (shape as VoiceFrameShapeData)
					: createDefault({
							id: drawState.shapeId,
							x: drawState.startX - 260,
							y: drawState.startY - 190,
						});
			toolCtx.commands.execute({
				execute: () => {
					toolCtx.store.addShape(def);
					toolCtx.store.setSelection([def.id]);
				},
				undo: () => toolCtx.store.deleteShape(def.id),
			});
			drawState = null;
			toolCtx.store.resetToDefaultTool();
		},
	});

	return () => {
		window.removeEventListener(ACTION_EVENT, onAction);
	};
}
