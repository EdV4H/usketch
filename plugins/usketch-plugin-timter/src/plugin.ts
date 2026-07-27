import {
	generateId,
	type PluginContext,
	type ShapeData,
	type UsketchPlugin,
} from "@edv4h/usketch-shared";
import { createAddShapeCommand } from "@edv4h/usketch-store";
import type { ServerClock } from "@edv4h/usketch-sync";
import {
	displayMs,
	formatDuration,
	isDone,
	resolveTimerKind,
	type TimerType,
} from "./timer-model.js";
import {
	coreOf,
	DEFAULT_MIN_DURATION_MS,
	DEFAULT_TIMER_MIN_SIZE,
	DEFAULT_TIMER_SIZE,
	dispatchTimerShapeAction,
	makeTimerShape,
	registerTimerShape,
	TIMER_SHAPE_TYPE,
	type TimerShapeData,
	type TimerShapeRenderer,
} from "./timer-shape.js";

export interface TimterPluginOptions {
	/** Shared server clock so all users agree on "now". */
	serverClock: ServerClock;
	/** Attribution for created-by (reserved). Defaults to "local". */
	userId?: string;
	/**
	 * Replace the built-in timer-shape visual with a host renderer (theme /
	 * hand-drawn look / design tokens). Receives the shape, its live
	 * {@link TimerCore}, a fresh `serverNow`, and toggle/reset/switchType/adjust
	 * actions. Omit to use the built-in renderer (`defaultRenderTimerShape`),
	 * which you can also import and wrap.
	 */
	renderShape?: TimerShapeRenderer;
	/**
	 * Minimum size the timer shape can be resized to. Defaults to `120×90`.
	 * Raise it when a custom {@link renderShape} needs more room (e.g. a row of
	 * controls that would otherwise wrap).
	 */
	minSize?: { width: number; height: number };
	/** Size of a newly created timer shape (`createDefault` / timer-draw). Defaults to `160×120`. */
	defaultSize?: { width: number; height: number };
	/**
	 * Lower bound (ms) for a countdown's configured duration, enforced by the
	 * `adjust` / `set-duration` actions. Defaults to `60_000` (1 min). Set e.g.
	 * `1_000` to allow sub-minute durations (0:01–).
	 */
	minDurationMs?: number;
}

/**
 * Shared timers as **canvas shapes** (single source of truth). The `timer` shape
 * (see `timer-shape`) is placeable/movable and syncs via the normal shapes map;
 * this plugin additionally surfaces every timer shape in the Debug HUD's Controls
 * dock (group "Timter") — add / per-timer toggle-reset-remove / clear-all — so
 * timers created either way (canvas tool or Controls) appear in one list. All
 * timing is on the shared server clock so users agree on "now".
 */
export function createTimterPlugin(options: TimterPluginOptions): UsketchPlugin {
	return {
		id: "usketch-plugin-timter",
		name: "タイマー",

		setup(ctx: PluginContext) {
			const now = () => options.serverClock.now();
			const minSize = options.minSize ?? DEFAULT_TIMER_MIN_SIZE;
			const defaultSize = options.defaultSize ?? DEFAULT_TIMER_SIZE;
			const minDurationMs = options.minDurationMs ?? DEFAULT_MIN_DURATION_MS;

			// ── Timer shape (placeable, movable) — the source of truth ──
			const disposeShape = registerTimerShape(
				ctx,
				options.serverClock,
				options.userId ?? "local",
				options.renderShape,
				{ minSize, defaultSize, minDurationMs },
			);

			const listTimers = (): TimerShapeData[] =>
				[...ctx.store.getShapes().values()]
					.filter((s): s is TimerShapeData => s.type === TIMER_SHAPE_TYPE)
					.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.id.localeCompare(b.id));

			const addTimer = (timerType: TimerType, durationMs?: number) => {
				// Place at the current viewport center.
				const vp = ctx.store.getViewport();
				const cx = (window.innerWidth / 2 - vp.x) / vp.zoom;
				const cy = (window.innerHeight / 2 - vp.y) / vp.zoom;
				const shape = makeTimerShape({
					id: generateId(),
					x: cx - defaultSize.width / 2,
					y: cy - defaultSize.height / 2,
					timerType,
					durationMs,
					serverNow: now(),
					size: defaultSize,
				});
				ctx.commands.execute(createAddShapeCommand(ctx.store, shape as ShapeData));
				ctx.store.setSelection([shape.id]);
			};

			// ── Global actions (Controls → "Timter") ──
			const globalOffs = [
				ctx.actions.register({
					id: "timter:new-countdown",
					label: "⏳ カウントダウン追加",
					group: "Timter",
					order: 0,
					params: [{ name: "minutes", type: "number", min: 1, max: 180, step: 1, default: 5 }],
					run: ({ minutes }) => addTimer("countdown", Math.max(1, Number(minutes) || 5) * 60_000),
				}),
				ctx.actions.register({
					id: "timter:new-stopwatch",
					label: "⏱ ストップウォッチ追加",
					group: "Timter",
					order: 1,
					run: () => addTimer("stopwatch"),
				}),
				ctx.actions.register({
					id: "timter:clear-all",
					label: "✕ 全タイマー削除",
					group: "Timter",
					order: 2,
					isEnabled: () => listTimers().length > 0,
					run: () => {
						for (const t of listTimers()) ctx.store.deleteShape(t.id);
					},
				}),
			];

			// ── Per-timer actions, rebuilt on store change + ticked while running ──
			let perTimerOffs: (() => void)[] = [];
			let tick: ReturnType<typeof setInterval> | null = null;

			const clearPerTimer = () => {
				for (const off of perTimerOffs) off();
				perTimerOffs = [];
			};

			const rebuild = () => {
				clearPerTimer();
				const timers = listTimers();
				const serverNow = now();

				timers.forEach((s, idx) => {
					const n = idx + 1;
					const icon = resolveTimerKind(s.timerType).icon ?? "⏱";
					const done = isDone(coreOf(s), serverNow);
					const time = formatDuration(displayMs(coreOf(s), serverNow));
					perTimerOffs.push(
						ctx.actions.register({
							id: `timter:${s.id}:toggle`,
							group: "Timter",
							order: 10 + idx * 3,
							label: `${s.running ? "⏸" : "▶"} ${icon} #${n} ${time}${done ? " ⏰終了" : ""}`,
							isActive: () =>
								(ctx.store.getShape(s.id) as TimerShapeData | undefined)?.running ?? false,
							run: () => dispatchTimerShapeAction({ id: s.id, action: "toggle" }),
						}),
						ctx.actions.register({
							id: `timter:${s.id}:reset`,
							group: "Timter",
							order: 10 + idx * 3 + 1,
							label: `↺ #${n} リセット`,
							run: () => dispatchTimerShapeAction({ id: s.id, action: "reset" }),
						}),
						ctx.actions.register({
							id: `timter:${s.id}:remove`,
							group: "Timter",
							order: 10 + idx * 3 + 2,
							label: `✕ #${n} 削除`,
							run: () => ctx.store.deleteShape(s.id),
						}),
					);
				});

				const needsTick = timers.some(
					(s) => s.running && !(s.timerType === "countdown" && isDone(coreOf(s), serverNow)),
				);
				if (needsTick && tick == null) tick = setInterval(rebuild, 1000);
				else if (!needsTick && tick != null) {
					clearInterval(tick);
					tick = null;
				}
			};

			const unsub = ctx.store.subscribe(rebuild);
			rebuild();

			return () => {
				for (const off of globalOffs) off();
				clearPerTimer();
				if (tick != null) {
					clearInterval(tick);
					tick = null;
				}
				unsub();
				disposeShape();
			};
		},
	};
}
