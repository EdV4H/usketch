import type { CanvasPointerEvent, EventBus, UsketchPlugin } from "@edv4h/usketch-shared";
import { DebugHud } from "./debug-hud.js";
import { EventLogger } from "./event-logger.js";
import { FpsCounter } from "./fps-counter.js";
import { PointerTracker } from "./pointer-tracker.js";

// Excluded from event log to avoid noise
const EXCLUDED_EVENTS = new Set(["canvas:pointermove"]);

export const debugHudPlugin: UsketchPlugin = {
	id: "debug-hud",
	name: "Debug HUD",

	setup(ctx) {
		const fpsCounter = new FpsCounter();
		const eventLogger = new EventLogger();
		const pointerTracker = new PointerTracker();

		// Start FPS counter
		fpsCounter.start();

		// Monkey-patch emit to capture events
		const originalEmit = ctx.events.emit.bind(ctx.events);
		(ctx.events as { emit: EventBus["emit"] }).emit = <T = unknown>(event: string, data: T) => {
			if (!EXCLUDED_EVENTS.has(event)) {
				eventLogger.push({ event, timestamp: Date.now() });
			}
			originalEmit(event, data);
		};

		// Track pointer coordinates
		const unsubPointer = ctx.events.on<CanvasPointerEvent>("canvas:pointermove", (data) => {
			pointerTracker.update(data.worldPoint, data.screenPoint);
		});

		// Register the fixed layer — always renders, visibility toggled inside component
		ctx.layers.register({
			id: "debug-hud",
			order: 9999,
			renderTarget: "html",
			fixed: true,
			render: (renderCtx) => (
				<DebugHud
					store={ctx.store}
					fpsCounter={fpsCounter}
					eventLogger={eventLogger}
					pointerTracker={pointerTracker}
					ctx={renderCtx}
				/>
			),
		});

		// Store teardown in closure — no module-level state
		this.teardown = () => {
			fpsCounter.stop();
			pointerTracker.dispose();
			(ctx.events as { emit: EventBus["emit"] }).emit = originalEmit;
			unsubPointer();
			ctx.layers.unregister("debug-hud");
		};
	},

	teardown() {
		// overwritten by setup()
	},
};
