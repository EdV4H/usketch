import { generateId, type PluginContext, type UsketchPlugin } from "@edv4h/usketch-shared";
import type { ServerClock } from "@edv4h/usketch-sync";
import type * as Y from "yjs";
import {
	createTimer,
	displayMs,
	formatDuration,
	isDone,
	pause,
	reset,
	start,
} from "./timer-model.js";
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
 * Shared, multi-timer plugin. It ships no bespoke UI: every operation is exposed
 * via `ctx.actions.register` so it renders in the Debug HUD's Controls dock
 * (group "Timter"). Global actions add/clear timers; per-timer actions (toggle /
 * reset / remove) are (re)registered whenever the shared state changes, and a 1s
 * tick re-registers running timers so their labels count in the panel.
 */
export function createTimterPlugin(options: TimterPluginOptions): UsketchPlugin {
	return {
		id: "usketch-plugin-timter",
		name: "タイマー",

		setup(ctx: PluginContext) {
			const store = createTimtersStore(options.doc);
			const userId = options.userId ?? "local";
			const now = () => options.serverClock.now();

			// ── Global actions (Controls → "Timter") ──
			const globalOffs = [
				ctx.actions.register({
					id: "timter:new-countdown",
					label: "⏳ カウントダウン追加",
					group: "Timter",
					order: 0,
					params: [{ name: "minutes", type: "number", min: 1, max: 180, step: 1, default: 5 }],
					run: ({ minutes }) => {
						const base = createTimer({
							id: generateId(),
							type: "countdown",
							durationMs: Math.max(1, Number(minutes) || 5) * 60_000,
							userId,
							serverNow: now(),
						});
						store.set(start(base, now(), userId)); // create + start (one action)
					},
				}),
				ctx.actions.register({
					id: "timter:new-stopwatch",
					label: "⏱ ストップウォッチ追加",
					group: "Timter",
					order: 1,
					run: () => {
						const base = createTimer({
							id: generateId(),
							type: "stopwatch",
							userId,
							serverNow: now(),
						});
						store.set(start(base, now(), userId));
					},
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
								store.set(cur.running ? pause(cur, now(), userId) : start(cur, now(), userId));
							},
						}),
						ctx.actions.register({
							id: `timter:${e.id}:reset`,
							group: "Timter",
							order: 10 + idx * 3 + 1,
							label: `↺ #${n} リセット`,
							run: () => {
								const cur = store.get(e.id);
								if (cur) store.set(reset(cur, now(), userId));
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

				// Tick only while something still advances (a running stopwatch, or a
				// running countdown that hasn't hit 0) — a finished countdown shows
				// 0:00 and needs no further re-registration.
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

			return () => {
				for (const off of globalOffs) off();
				clearPerTimer();
				if (tick != null) {
					clearInterval(tick);
					tick = null;
				}
				unsub();
				store.destroy();
			};
		},
	};
}
