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
import { createAddShapeCommand } from "@edv4h/usketch-store";
import type { ServerClock } from "@edv4h/usketch-sync";
import { useEffect, useReducer } from "react";
import {
	displayMs,
	formatDuration,
	initialCore,
	isDone,
	pause,
	reset,
	start,
	type TimerCore,
	type TimerType,
} from "./timer-model.js";

export const TIMER_SHAPE_TYPE = "timer";
const DEFAULT_MINUTES = 5;
const ACTION_EVENT = "usketch:timter-shape-action";

/** A timer as a placeable canvas shape. Timing state mirrors {@link TimerCore}. */
export interface TimerShapeData extends ShapeData {
	type: typeof TIMER_SHAPE_TYPE;
	timerType: TimerType;
	running: boolean;
	anchorAt: number | null;
	accumMs: number;
	durationMs: number;
}

type ShapeAction =
	| { id: string; action: "toggle" | "reset" | "switch-type" }
	| { id: string; action: "adjust"; value: number };

const coreOf = (s: TimerShapeData): TimerCore => ({
	type: s.timerType,
	running: s.running,
	anchorAt: s.anchorAt,
	accumMs: s.accumMs,
	durationMs: s.durationMs,
});

const corePatch = (c: TimerCore): Partial<TimerShapeData> => ({
	timerType: c.type,
	running: c.running,
	anchorAt: c.anchorAt,
	accumMs: c.accumMs,
	durationMs: c.durationMs,
});

function emit(detail: ShapeAction) {
	window.dispatchEvent(new CustomEvent(ACTION_EVENT, { detail }));
}

// ── View ──

const btn: React.CSSProperties = {
	border: "1px solid #d1d5db",
	borderRadius: 6,
	background: "#f5f5f5",
	color: "#333",
	cursor: "pointer",
	fontSize: 14,
	lineHeight: 1,
	padding: "4px 8px",
};

function TimerShapeView({
	shape,
	serverClock,
}: {
	shape: TimerShapeData;
	serverClock: ServerClock;
}) {
	const [, force] = useReducer((n: number) => n + 1, 0);
	const running = shape.running;

	// Self-tick while running so the display counts without writing to the store.
	useEffect(() => {
		if (!running) return;
		const id = setInterval(force, 250);
		return () => clearInterval(id);
	}, [running]);

	const core = coreOf(shape);
	const serverNow = serverClock.now();
	const done = shape.timerType === "countdown" && isDone(core, serverNow);
	const icon = shape.timerType === "countdown" ? "⏳" : "⏱";
	const stop = (e: React.SyntheticEvent) => e.stopPropagation();

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				boxSizing: "border-box",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				gap: 6,
				padding: 8,
				background: done ? "#fee2e2" : shape.style.fill,
				border: `${shape.style.strokeWidth}px solid ${done ? "#ef4444" : shape.style.stroke}`,
				borderRadius: 10,
				fontFamily: "system-ui, sans-serif",
				userSelect: "none",
			}}
		>
			<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
				{!running && (
					<button
						type="button"
						title="種別を切替"
						style={btn}
						onPointerDown={stop}
						onClick={(e) => {
							stop(e);
							emit({ id: shape.id, action: "switch-type" });
						}}
					>
						{icon}
					</button>
				)}
				{running && <span style={{ fontSize: 16 }}>{icon}</span>}
				<span
					style={{
						fontVariantNumeric: "tabular-nums",
						fontSize: 30,
						fontWeight: 700,
						color: done ? "#b91c1c" : "#1e1e1e",
					}}
				>
					{formatDuration(displayMs(core, serverNow))}
				</span>
			</div>

			{!running && shape.timerType === "countdown" && (
				<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
					<button
						type="button"
						title="−1分"
						style={btn}
						onPointerDown={stop}
						onClick={(e) => {
							stop(e);
							emit({ id: shape.id, action: "adjust", value: -1 });
						}}
					>
						−
					</button>
					<button
						type="button"
						title="+1分"
						style={btn}
						onPointerDown={stop}
						onClick={(e) => {
							stop(e);
							emit({ id: shape.id, action: "adjust", value: 1 });
						}}
					>
						＋
					</button>
				</div>
			)}

			<div style={{ display: "flex", gap: 8 }}>
				<button
					type="button"
					title={running ? "一時停止" : "開始"}
					style={btn}
					onPointerDown={stop}
					onClick={(e) => {
						stop(e);
						emit({ id: shape.id, action: "toggle" });
					}}
				>
					{running ? "⏸" : "▶"}
				</button>
				<button
					type="button"
					title="リセット"
					style={btn}
					onPointerDown={stop}
					onClick={(e) => {
						stop(e);
						emit({ id: shape.id, action: "reset" });
					}}
				>
					↺
				</button>
			</div>
		</div>
	);
}

function SimplifiedTimer({ shape }: { shape: ShapeData }) {
	// LOD: static time, no controls (LOD is non-interactive).
	const s = shape as TimerShapeData;
	const rotation = typeof s.rotation === "number" ? s.rotation : 0;
	return (
		<div
			style={{
				position: "absolute",
				left: s.x,
				top: s.y,
				width: s.width,
				height: s.height,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background: (s.style?.fill as string) || "#fff",
				border: `1px solid ${(s.style?.stroke as string) || "#999"}`,
				borderRadius: 6,
				fontSize: Math.max(12, Math.min(s.width, s.height) * 0.32),
				fontWeight: 700,
				color: "#222",
				pointerEvents: "none",
				overflow: "hidden",
				transform: rotation ? `rotate(${rotation}deg)` : undefined,
				transformOrigin: "center center",
			}}
		>
			{s.timerType === "countdown" ? "⏳" : "⏱"} {formatDuration(s.accumMs)}
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
	return { ...data, x, y, width: Math.max(120, width), height: Math.max(90, height) };
}

function createDefault(params: { id: string; x: number; y: number }): TimerShapeData {
	return {
		id: params.id,
		type: TIMER_SHAPE_TYPE,
		x: params.x,
		y: params.y,
		width: 160,
		height: 120,
		style: { fill: "#ffffff", stroke: "#1e1e1e", strokeWidth: 2, opacity: 1 },
		timerType: "countdown",
		running: false,
		anchorAt: null,
		accumMs: DEFAULT_MINUTES * 60_000,
		durationMs: DEFAULT_MINUTES * 60_000,
	};
}

function TimerToolIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
			<circle cx="10" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
			<path d="M10 11V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
			<path d="M8 2.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
		</svg>
	);
}

/**
 * Register the timer shape, its draw tool, and the button-action listener.
 * `serverClock` is closed over by the renderer so every client computes the
 * remaining/elapsed time against the shared server clock.
 */
export function registerTimerShape(
	ctx: PluginContext,
	serverClock: ServerClock,
	_userId: string,
): () => void {
	const now = () => serverClock.now();

	ctx.shapes.register(TIMER_SHAPE_TYPE, {
		render: (shape) => <TimerShapeView shape={shape as TimerShapeData} serverClock={serverClock} />,
		getBounds,
		hitTest,
		resize,
		createDefault,
		renderTarget: "html",
		minSize: { width: 120, height: 90 },
		simplifiedComponent: SimplifiedTimer,
	});

	// Button actions from the rendered shape mutate the shape via updateShape
	// (live, non-undoable — matching other interactive shapes like counter).
	const onAction = (e: Event) => {
		const detail = (e as CustomEvent<ShapeAction>).detail;
		const shape = ctx.store.getShape(detail.id) as TimerShapeData | undefined;
		if (!shape || shape.type !== TIMER_SHAPE_TYPE) return;
		const core = coreOf(shape);

		let next: TimerCore;
		switch (detail.action) {
			case "toggle":
				next = core.running ? pause(core, now()) : start(core, now());
				break;
			case "reset":
				next = reset(core);
				break;
			case "switch-type": {
				if (core.running) return;
				const nextType: TimerType = core.type === "countdown" ? "stopwatch" : "countdown";
				const dur = nextType === "countdown" ? core.durationMs || DEFAULT_MINUTES * 60_000 : 0;
				next = initialCore(nextType, dur);
				break;
			}
			case "adjust": {
				if (core.running || core.type !== "countdown") return;
				next = initialCore("countdown", Math.max(60_000, core.durationMs + detail.value * 60_000));
				break;
			}
			default:
				return;
		}
		ctx.store.updateShape(detail.id, corePatch(next) as Partial<ShapeData>);
	};
	window.addEventListener(ACTION_EVENT, onAction);

	// ── Draw tool: drag to size, or click for default size ──
	let drawState: { startX: number; startY: number; shapeId: string } | null = null;

	ctx.tools.register("timer-draw", {
		icon: TimerToolIcon,
		cursor: "crosshair",
		order: 41,
		onPointerDown(_toolCtx: ToolContext, event: CanvasPointerEvent) {
			const id = generateId();
			drawState = { startX: event.worldPoint.x, startY: event.worldPoint.y, shapeId: id };
			const shape = createDefault({ id, x: event.worldPoint.x, y: event.worldPoint.y });
			shape.width = 0;
			shape.height = 0;
			_toolCtx.store.addShape(shape);
		},
		onPointerMove(toolCtx: ToolContext, event: CanvasPointerEvent) {
			if (!drawState) return;
			const x = Math.min(drawState.startX, event.worldPoint.x);
			const y = Math.min(drawState.startY, event.worldPoint.y);
			const width = Math.abs(event.worldPoint.x - drawState.startX);
			const height = Math.abs(event.worldPoint.y - drawState.startY);
			toolCtx.store.updateShape(drawState.shapeId, { x, y, width, height });
		},
		onPointerUp(toolCtx: ToolContext) {
			if (!drawState) return;
			const shape = toolCtx.store.getShape(drawState.shapeId);
			toolCtx.store.deleteShape(drawState.shapeId);
			if (shape && shape.width > 10 && shape.height > 10) {
				toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, shape));
				toolCtx.store.setSelection([shape.id]);
			} else {
				const def = createDefault({
					id: drawState.shapeId,
					x: drawState.startX - 80,
					y: drawState.startY - 60,
				});
				toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, def));
				toolCtx.store.setSelection([def.id]);
			}
			drawState = null;
			toolCtx.store.resetToDefaultTool();
		},
	});

	// Note: the shape/tool registries are register-only (like other shape plugins,
	// e.g. counter), so teardown just drops the window listener.
	return () => {
		window.removeEventListener(ACTION_EVENT, onAction);
	};
}
