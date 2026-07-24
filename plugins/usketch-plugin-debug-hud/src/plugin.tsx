import type { CanvasPointerEvent, EventBus, UsketchPlugin } from "@edv4h/usketch-shared";
import { DebugHud } from "./debug-hud.js";
import { EventLogger } from "./event-logger.js";
import { FpsCounter } from "./fps-counter.js";
import { PointerTracker } from "./pointer-tracker.js";
import { createVisibilityStore } from "./visibility-store.js";

// Excluded from event log to avoid noise
const EXCLUDED_EVENTS = new Set(["canvas:pointermove"]);

const VISIBILITY_STORAGE_KEY = "usketch-debug-hud-visible";

function formatEventLabel(event: string, data: unknown): string {
	if (data == null || typeof data !== "object") return event;
	const obj = data as Record<string, unknown>;
	if ("id" in obj && typeof obj.id === "string") {
		return `${event} → ${obj.id}`;
	}
	return event;
}

export function createDebugHudPlugin(): UsketchPlugin {
	return {
		id: "debug-hud",
		name: "Debug HUD",

		setup(ctx) {
			const fpsCounter = new FpsCounter();
			const eventLogger = new EventLogger();
			const pointerTracker = new PointerTracker();
			const visibility = createVisibilityStore(VISIBILITY_STORAGE_KEY);

			// Start FPS counter
			fpsCounter.start();

			// Monkey-patch emit to capture events. Push is skipped while the HUD is hidden
			// so the drag path stays free of EventLogger work when no UI is observing it.
			const originalEmit = ctx.events.emit.bind(ctx.events);
			(ctx.events as { emit: EventBus["emit"] }).emit = <T = unknown>(event: string, data: T) => {
				if (visibility.get() && !EXCLUDED_EVENTS.has(event)) {
					const label = formatEventLabel(event, data);
					eventLogger.push({ event: label, timestamp: Date.now() });
				}
				originalEmit(event, data);
			};

			// Track pointer coordinates
			const unsubPointer = ctx.events.on<CanvasPointerEvent>("canvas:pointermove", (data) => {
				pointerTracker.update(data.worldPoint, data.screenPoint);
			});

			// Pick up sync status tracker from window (set by app.tsx)
			const syncStatus = (globalThis as Record<string, unknown>).__usketchSyncStatus as
				| import("./sync-status-types.js").SyncStatusTrackerLike
				| undefined;

			// Register the fixed layer — always renders, visibility toggled inside component
			ctx.layers.register({
				id: "debug-hud",
				order: 9999,
				fixed: true,
				render: (renderCtx) => (
					<DebugHud
						store={ctx.store}
						fpsCounter={fpsCounter}
						eventLogger={eventLogger}
						pointerTracker={pointerTracker}
						commands={ctx.commands}
						tools={ctx.tools}
						layers={ctx.layers}
						shapes={ctx.shapes}
						actions={ctx.actions}
						hud={ctx.hud}
						pluginInfo={ctx.plugins}
						syncStatus={syncStatus}
						events={ctx.events}
						ctx={renderCtx}
						visibility={visibility}
					/>
				),
			});

			return () => {
				fpsCounter.stop();
				pointerTracker.dispose();
				eventLogger.dispose();
				(ctx.events as { emit: EventBus["emit"] }).emit = originalEmit;
				unsubPointer();
				ctx.layers.unregister("debug-hud");
			};
		},
	};
}
