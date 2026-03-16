import type { CanvasPointerEvent, EventBus, Point, UsketchPlugin } from "@edv4h/usketch-shared";
import { createRef } from "react";
import { DebugHud } from "./debug-hud.js";
import { EventLogger } from "./event-logger.js";
import { FpsCounter } from "./fps-counter.js";

// Excluded from event log to avoid noise
const EXCLUDED_EVENTS = new Set(["canvas:pointermove"]);

let teardownFn: (() => void) | null = null;

export const debugHudPlugin: UsketchPlugin = {
	id: "debug-hud",
	name: "Debug HUD",

	setup(ctx) {
		const fpsCounter = new FpsCounter();
		const eventLogger = new EventLogger();
		const pointerRef = createRef<{ world: Point; screen: Point }>() as React.MutableRefObject<{
			world: Point;
			screen: Point;
		}>;
		pointerRef.current = { world: { x: 0, y: 0 }, screen: { x: 0, y: 0 } };

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
			pointerRef.current = {
				world: data.worldPoint,
				screen: data.screenPoint,
			};
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
					pointerRef={pointerRef}
					ctx={renderCtx}
				/>
			),
		});

		teardownFn = () => {
			fpsCounter.stop();
			(ctx.events as { emit: EventBus["emit"] }).emit = originalEmit;
			unsubPointer();
			ctx.layers.unregister("debug-hud");
			teardownFn = null;
		};
	},

	teardown() {
		teardownFn?.();
	},
};
