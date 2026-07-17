import { generateId, type PluginContext, type UsketchPlugin } from "@edv4h/usketch-shared";
import type { ServerClock } from "@edv4h/usketch-sync";
import type * as Y from "yjs";
import {
	displayMs,
	formatDuration,
	initialCore,
	isDone,
	pause,
	reset,
	start,
	type TimerCore,
	type TimerEntry,
} from "./timer-model.js";
import { registerTimerShape } from "./timer-shape.js";
import { createTimtersStore } from "./timters-store.js";

export interface TimterPluginOptions {
	/** Shared Yjs doc (same one shape sync uses). Timer state lives in its `timters` map. */
	doc: Y.Doc;
	/** Shared server clock so all users agree on "now". */
	serverClock: ServerClock;
	/** Attribution for created/updated-by. Defaults to "local". */
	userId?: string;
}

/**
 * Shared timers. Two representations, one model ({@link TimerCore}):
 * - **Controls timers** — global timers managed via `ctx.actions` (Debug HUD
 *   Controls, group "Timter"), stored in the shared `timters` Y.Map.
 * - **Timer shape** — a placeable, movable canvas shape (see `timer-shape`),
 *   stored in the normal shapes map.
 * Both keep time on the shared server clock so all users agree on "now".
 */
export function createTimterPlugin(options: TimterPluginOptions): UsketchPlugin {
	return {
		id: "usketch-plugin-timter",
		name: "タイマー",

		setup(ctx: PluginContext) {
			const store = createTimtersStore(options.doc);
			const userId = options.userId ?? "local";
			const now = () => options.serverClock.now();

			const stampNew = (core: TimerCore, id: string): TimerEntry => ({
				id,
				...core,
				createdBy: userId,
				updatedBy: userId,
				updatedAt: now(),
			});
			const stampUpd = (entry: TimerEntry, core: TimerCore): TimerEntry => ({
				...entry,
				...core,
				updatedBy: userId,
				updatedAt: now(),
			});

			// ── Global actions (Controls → "Timter") ──
			const globalOffs = [
				ctx.actions.register({
					id: "timter:new-countdown",
					label: "⏳ カウントダウン追加",
					group: "Timter",
					order: 0,
					params: [{ name: "minutes", type: "number", min: 1, max: 180, step: 1, default: 5 }],
					run: ({ minutes }) => {
						const core = start(
							initialCore("countdown", Math.max(1, Number(minutes) || 5) * 60_000),
							now(),
						);
						store.set(stampNew(core, generateId()));
					},
				}),
				ctx.actions.register({
					id: "timter:new-stopwatch",
					label: "⏱ ストップウォッチ追加",
					group: "Timter",
					order: 1,
					run: () => store.set(stampNew(start(initialCore("stopwatch", 0), now()), generateId())),
				}),
				ctx.actions.register({
					id: "timter:clear-all",
					label: "✕ 全タイマー削除",
					group: "Timter",
					order: 2,
					isEnabled: () => store.getAll().length > 0,
					run: () => store.clear(),
				}),
			];

			// ── Per-timer actions, rebuilt on change + ticked while running ──
			let perTimerOffs: (() => void)[] = [];
			let tick: ReturnType<typeof setInterval> | null = null;

			const clearPerTimer = () => {
				for (const off of perTimerOffs) off();
				perTimerOffs = [];
			};

			const rebuild = () => {
				clearPerTimer();
				const entries = store.getAll();
				const serverNow = now();

				entries.forEach((e, idx) => {
					const n = idx + 1;
					const icon = e.type === "countdown" ? "⏳" : "⏱";
					const done = e.type === "countdown" && isDone(e, serverNow);
					const time = formatDuration(displayMs(e, serverNow));
					perTimerOffs.push(
						ctx.actions.register({
							id: `timter:${e.id}:toggle`,
							group: "Timter",
							order: 10 + idx * 3,
							label: `${e.running ? "⏸" : "▶"} ${icon} #${n} ${time}${done ? " ⏰終了" : ""}`,
							isActive: () => store.get(e.id)?.running ?? false,
							run: () => {
								const cur = store.get(e.id);
								if (!cur) return;
								store.set(stampUpd(cur, cur.running ? pause(cur, now()) : start(cur, now())));
							},
						}),
						ctx.actions.register({
							id: `timter:${e.id}:reset`,
							group: "Timter",
							order: 10 + idx * 3 + 1,
							label: `↺ #${n} リセット`,
							run: () => {
								const cur = store.get(e.id);
								if (cur) store.set(stampUpd(cur, reset(cur)));
							},
						}),
						ctx.actions.register({
							id: `timter:${e.id}:remove`,
							group: "Timter",
							order: 10 + idx * 3 + 2,
							label: `✕ #${n} 削除`,
							run: () => store.remove(e.id),
						}),
					);
				});

				const needsTick = entries.some(
					(e) => e.running && !(e.type === "countdown" && isDone(e, serverNow)),
				);
				if (needsTick && tick == null) tick = setInterval(rebuild, 1000);
				else if (!needsTick && tick != null) {
					clearInterval(tick);
					tick = null;
				}
			};

			const unsub = store.subscribe(rebuild);
			rebuild();

			// ── Timer shape (placeable, movable canvas object) ──
			const disposeShape = registerTimerShape(ctx, options.serverClock, userId);

			return () => {
				for (const off of globalOffs) off();
				clearPerTimer();
				if (tick != null) {
					clearInterval(tick);
					tick = null;
				}
				unsub();
				store.destroy();
				disposeShape();
			};
		},
	};
}
