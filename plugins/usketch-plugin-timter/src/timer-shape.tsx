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
import { type ReactElement, useEffect, useReducer } from "react";
import {
	displayMs,
	formatDuration,
	initialCore,
	isDone,
	pause,
	reset,
	resolveTimerKind,
	start,
	type TimerCore,
	type TimerType,
	timerTypes,
} from "./timer-model.js";

export const TIMER_SHAPE_TYPE = "timer";
const DEFAULT_MINUTES = 5;
const ACTION_EVENT = "usketch:timter-shape-action";

/** Default shape sizing / duration floor — overridable via {@link TimterPluginOptions}. */
export const DEFAULT_TIMER_MIN_SIZE = { width: 120, height: 90 };
export const DEFAULT_TIMER_SIZE = { width: 160, height: 120 };
export const DEFAULT_MIN_DURATION_MS = 60_000;

/** Host-tunable sizing / duration config threaded into the timer shape. */
export interface TimerShapeConfig {
	minSize: { width: number; height: number };
	defaultSize: { width: number; height: number };
	minDurationMs: number;
}

const DEFAULT_TIMER_CONFIG: TimerShapeConfig = {
	minSize: DEFAULT_TIMER_MIN_SIZE,
	defaultSize: DEFAULT_TIMER_SIZE,
	minDurationMs: DEFAULT_MIN_DURATION_MS,
};

/** A timer as a placeable canvas shape. Timing state mirrors {@link TimerCore}. */
export interface TimerShapeData extends ShapeData {
	type: typeof TIMER_SHAPE_TYPE;
	timerType: TimerType;
	running: boolean;
	anchorAt: number | null;
	accumMs: number;
	durationMs: number;
}

export type ShapeAction =
	| { id: string; action: "toggle" | "reset" | "switch-type" }
	/** `value` is a delta in **milliseconds** applied to the configured duration. */
	| { id: string; action: "adjust"; value: number }
	/** `value` is an **absolute** target duration in milliseconds (clamped to the
	 * configured `minDurationMs`). Lets a host UI set e.g. 0:30 directly. */
	| { id: string; action: "set-duration"; value: number };

export const coreOf = (s: TimerShapeData): TimerCore => ({
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

/** Dispatch a timer-shape action (toggle/reset/…) — used by the Controls actions too. */
export const dispatchTimerShapeAction = emit;

// ── Render customization (host escape hatch) ──

/**
 * Live actions handed to a timer-shape renderer. Each dispatches the same event
 * the built-in buttons use, so a custom renderer stays in sync with the Controls
 * dock and never touches the store directly.
 */
export interface TimerShapeActions {
	/** Start if paused, pause if running. */
	toggle(): void;
	/** Return to the configured, stopped state. */
	reset(): void;
	/** Advance to the next registered timer kind (only while paused). */
	switchType(): void;
	/** Change the configured duration by `deltaMs` (duration-based kinds, while paused). */
	adjust(deltaMs: number): void;
	/** Set the configured duration to an absolute `ms` (clamped to `minDurationMs`,
	 * while paused). Use for a host "分:秒" input. */
	setDuration(ms: number): void;
}

/**
 * Everything a timer-shape renderer needs. `core` / `serverNow` are recomputed on
 * every self-tick while running, so a renderer can read `displayMs(core, serverNow)`
 * / `isDone(core, serverNow)` straight from the model without its own clock.
 */
export interface TimerRenderContext {
	shape: TimerShapeData;
	core: TimerCore;
	serverNow: number;
	actions: TimerShapeActions;
}

/**
 * Replaces the built-in timer-shape visual. Supplied via
 * `TimterPluginOptions.renderShape`; when omitted the plugin uses
 * {@link defaultRenderTimerShape}. Wrap the default to extend rather than replace.
 */
export type TimerShapeRenderer = (ctx: TimerRenderContext) => ReactElement;

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

const stopEvent = (e: React.SyntheticEvent) => e.stopPropagation();

/** The built-in timer-shape renderer. Exported so hosts can wrap/extend it. */
export function defaultRenderTimerShape({
	shape,
	core,
	serverNow,
	actions,
}: TimerRenderContext): ReactElement {
	const running = shape.running;
	const done = isDone(core, serverNow);
	const icon = resolveTimerKind(shape.timerType).icon ?? "⏱";
	const durationBased = core.durationMs > 0;

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
						onPointerDown={stopEvent}
						onClick={(e) => {
							stopEvent(e);
							actions.switchType();
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

			{!running && durationBased && (
				<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
					<button
						type="button"
						title="−1分"
						style={btn}
						onPointerDown={stopEvent}
						onClick={(e) => {
							stopEvent(e);
							actions.adjust(-60_000);
						}}
					>
						−
					</button>
					<button
						type="button"
						title="+1分"
						style={btn}
						onPointerDown={stopEvent}
						onClick={(e) => {
							stopEvent(e);
							actions.adjust(60_000);
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
					onPointerDown={stopEvent}
					onClick={(e) => {
						stopEvent(e);
						actions.toggle();
					}}
				>
					{running ? "⏸" : "▶"}
				</button>
				<button
					type="button"
					title="リセット"
					style={btn}
					onPointerDown={stopEvent}
					onClick={(e) => {
						stopEvent(e);
						actions.reset();
					}}
				>
					↺
				</button>
			</div>
		</div>
	);
}

// ── View ──

/**
 * Host wrapper around a timer-shape renderer. Owns the self-tick (so the display
 * counts down without writing to the store), recomputes `core`/`serverNow` each
 * render, and builds the {@link TimerShapeActions} that emit the shared action
 * event. Delegates the actual visual to `render` (a host `renderShape` or the
 * built-in {@link defaultRenderTimerShape}).
 */
function TimerShapeView({
	shape,
	serverClock,
	render,
}: {
	shape: TimerShapeData;
	serverClock: ServerClock;
	render: TimerShapeRenderer;
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
	const actions: TimerShapeActions = {
		toggle: () => emit({ id: shape.id, action: "toggle" }),
		reset: () => emit({ id: shape.id, action: "reset" }),
		switchType: () => emit({ id: shape.id, action: "switch-type" }),
		adjust: (deltaMs) => emit({ id: shape.id, action: "adjust", value: deltaMs }),
		setDuration: (ms) => emit({ id: shape.id, action: "set-duration", value: ms }),
	};

	return render({ shape, core, serverNow, actions });
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
			{resolveTimerKind(s.timerType).icon ?? "⏱"} {formatDuration(s.accumMs)}
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

function resize(
	data: ShapeData,
	handle: ResizeHandle,
	delta: Point,
	minSize: { width: number; height: number } = DEFAULT_TIMER_MIN_SIZE,
): ShapeData {
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
	return {
		...data,
		x,
		y,
		width: Math.max(minSize.width, width),
		height: Math.max(minSize.height, height),
	};
}

function createDefault(
	params: { id: string; x: number; y: number },
	size: { width: number; height: number } = DEFAULT_TIMER_SIZE,
): TimerShapeData {
	return {
		id: params.id,
		type: TIMER_SHAPE_TYPE,
		x: params.x,
		y: params.y,
		width: size.width,
		height: size.height,
		style: { fill: "#ffffff", stroke: "#1e1e1e", strokeWidth: 2, opacity: 1 },
		timerType: "countdown",
		running: false,
		anchorAt: null,
		accumMs: DEFAULT_MINUTES * 60_000,
		durationMs: DEFAULT_MINUTES * 60_000,
	};
}

/** Build a started timer shape of a given type/duration (used by Controls "add"). */
export function makeTimerShape(params: {
	id: string;
	x: number;
	y: number;
	timerType: TimerType;
	durationMs?: number;
	serverNow: number;
	/** Initial shape size. Defaults to {@link DEFAULT_TIMER_SIZE}. */
	size?: { width: number; height: number };
}): TimerShapeData {
	const base = createDefault({ id: params.id, x: params.x, y: params.y }, params.size);
	// The kind's `initial` decides how (or whether) the duration is used —
	// non-duration kinds like stopwatch ignore it.
	const dur = params.durationMs ?? DEFAULT_MINUTES * 60_000;
	const core = start(initialCore(params.timerType, dur), params.serverNow);
	return { ...base, ...corePatch(core) };
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
 * remaining/elapsed time against the shared server clock. `renderShape`
 * overrides the built-in visual (defaults to {@link defaultRenderTimerShape}).
 */
export function registerTimerShape(
	ctx: PluginContext,
	serverClock: ServerClock,
	_userId: string,
	renderShape: TimerShapeRenderer = defaultRenderTimerShape,
	config: TimerShapeConfig = DEFAULT_TIMER_CONFIG,
): () => void {
	const now = () => serverClock.now();
	const { minSize, defaultSize, minDurationMs } = config;

	ctx.shapes.register(TIMER_SHAPE_TYPE, {
		render: (shape) => (
			<TimerShapeView
				shape={shape as TimerShapeData}
				serverClock={serverClock}
				render={renderShape}
			/>
		),
		getBounds,
		hitTest,
		resize: (data, handle, delta) => resize(data, handle, delta, minSize),
		createDefault: (params) => createDefault(params, defaultSize),
		renderTarget: "html",
		minSize,
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
				// Cycle through every registered kind (built-ins + host-registered).
				const types = timerTypes();
				const idx = types.indexOf(core.type);
				// Unknown/removed kind: don't silently switch to the first kind — leave
				// the shape untouched (the model treats unregistered types as an error).
				if (idx < 0) return;
				const nextType = types[(idx + 1) % types.length] ?? core.type;
				// Carry a sensible duration forward; non-duration kinds (e.g. stopwatch)
				// ignore it via their own `initial`.
				next = initialCore(nextType, core.durationMs || DEFAULT_MINUTES * 60_000);
				break;
			}
			case "adjust": {
				// `value` is a millisecond delta; only duration-based kinds respond.
				if (core.running || core.durationMs <= 0) return;
				next = initialCore(core.type, Math.max(minDurationMs, core.durationMs + detail.value));
				break;
			}
			case "set-duration": {
				// `value` is an absolute target duration; only duration-based kinds respond.
				if (core.running || core.durationMs <= 0) return;
				next = initialCore(core.type, Math.max(minDurationMs, detail.value));
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
			const shape = createDefault(
				{ id, x: event.worldPoint.x, y: event.worldPoint.y },
				defaultSize,
			);
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
				const def = createDefault(
					{
						id: drawState.shapeId,
						x: drawState.startX - defaultSize.width / 2,
						y: drawState.startY - defaultSize.height / 2,
					},
					defaultSize,
				);
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
