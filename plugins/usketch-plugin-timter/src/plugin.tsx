import { generateId, type PluginContext, type UsketchPlugin } from "@edv4h/usketch-shared";
import type { ServerClock } from "@edv4h/usketch-sync";
import type * as Y from "yjs";
import { type TimterController, TimterHud } from "./hud.js";
import { createTimer, pause, reset, start } from "./timer-model.js";
import { createTimtersStore } from "./timters-store.js";

export interface TimterPluginOptions {
	/** Shared Yjs doc (same one shape sync uses). Timer state lives in its `timters` map. */
	doc: Y.Doc;
	/** Shared server clock so all users agree on "now". */
	serverClock: ServerClock;
	/** Attribution for created/updated-by. Defaults to "local". */
	userId?: string;
}

export function createTimterPlugin(options: TimterPluginOptions): UsketchPlugin {
	return {
		id: "usketch-plugin-timter",
		name: "タイマー",

		setup(ctx: PluginContext) {
			const cleanups: (() => void)[] = [];
			const store = createTimtersStore(options.doc);
			const userId = options.userId ?? "local";
			const now = () => options.serverClock.now();

			const controller: TimterController = {
				createCountdown(minutes) {
					const base = createTimer({
						id: generateId(),
						type: "countdown",
						durationMs: Math.max(1, minutes) * 60_000,
						userId,
						serverNow: now(),
					});
					store.set(start(base, now(), userId)); // create + start (one click)
				},
				createStopwatch() {
					const base = createTimer({
						id: generateId(),
						type: "stopwatch",
						userId,
						serverNow: now(),
					});
					store.set(start(base, now(), userId));
				},
				start(id) {
					const e = store.get(id);
					if (e) store.set(start(e, now(), userId));
				},
				pause(id) {
					const e = store.get(id);
					if (e) store.set(pause(e, now(), userId));
				},
				reset(id) {
					const e = store.get(id);
					if (e) store.set(reset(e, now(), userId));
				},
				remove(id) {
					store.remove(id);
				},
			};

			ctx.layers.register({
				id: "timter-hud",
				order: 98,
				fixed: true,
				render: () => (
					<TimterHud store={store} serverClock={options.serverClock} controller={controller} />
				),
			});
			cleanups.push(() => ctx.layers.unregister("timter-hud"));

			const offActions = [
				ctx.actions.register({
					id: "timter:new-countdown",
					label: "カウントダウン追加",
					group: "Timter",
					params: [{ name: "minutes", type: "number", min: 1, max: 180, step: 1, default: 5 }],
					run: ({ minutes }) => controller.createCountdown(Number(minutes) || 5),
				}),
				ctx.actions.register({
					id: "timter:new-stopwatch",
					label: "ストップウォッチ追加",
					group: "Timter",
					run: () => controller.createStopwatch(),
				}),
				ctx.actions.register({
					id: "timter:clear-all",
					label: "全タイマー削除",
					group: "Timter",
					isEnabled: () => store.getAll().length > 0,
					run: () => store.clear(),
				}),
			];
			cleanups.push(...offActions);

			return () => {
				for (const fn of cleanups) fn();
				cleanups.length = 0;
				store.destroy();
			};
		},
	};
}
