import type { CanvasPointerEvent, EventBus, UsketchPlugin } from "@edv4h/usketch-shared";
import { DebugHud } from "./debug-hud.js";
import { EventLogger } from "./event-logger.js";
import { FpsCounter } from "./fps-counter.js";
import { PointerTracker } from "./pointer-tracker.js";

// Excluded from event log to avoid noise
const EXCLUDED_EVENTS = new Set(["canvas:pointermove"]);

function setsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
	if (a.size !== b.size) return false;
	for (const v of a) {
		if (!b.has(v)) return false;
	}
	return true;
}

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

		// Watch store changes and generate synthetic events
		let prevShapeCount = ctx.store.getShapes().size;
		let prevSelection: ReadonlySet<string> = ctx.store.getSelection();
		let prevToolId = ctx.store.getActiveToolId();
		let prevViewport = ctx.store.getViewport();
		let viewportThrottleTimer: ReturnType<typeof setTimeout> | null = null;

		const unsubStore = ctx.store.subscribe(() => {
			const now = Date.now();
			const shapes = ctx.store.getShapes();
			const selection = ctx.store.getSelection();
			const toolId = ctx.store.getActiveToolId();
			const viewport = ctx.store.getViewport();

			// Collect events, then push asynchronously to avoid
			// triggering React re-renders during store notification
			const pending: string[] = [];

			if (shapes.size !== prevShapeCount) {
				const diff = shapes.size - prevShapeCount;
				pending.push(diff > 0 ? "shape:added" : "shape:removed");
				prevShapeCount = shapes.size;
			}

			if (!setsEqual(selection, prevSelection)) {
				pending.push("selection:changed");
				prevSelection = selection;
			}

			if (toolId !== prevToolId) {
				pending.push(`tool:changed → ${toolId}`);
				prevToolId = toolId;
			}

			if (
				viewport.x !== prevViewport.x ||
				viewport.y !== prevViewport.y ||
				viewport.zoom !== prevViewport.zoom
			) {
				prevViewport = viewport;
				if (!viewportThrottleTimer) {
					pending.push("viewport:changed");
					viewportThrottleTimer = setTimeout(() => {
						viewportThrottleTimer = null;
					}, 200);
				}
			}

			if (pending.length > 0) {
				queueMicrotask(() => {
					for (const event of pending) {
						eventLogger.push({ event, timestamp: now });
					}
				});
			}
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
					commands={ctx.commands}
					tools={ctx.tools}
					layers={ctx.layers}
					shapes={ctx.shapes}
					ctx={renderCtx}
				/>
			),
		});

		// Store teardown in closure — no module-level state
		this.teardown = () => {
			fpsCounter.stop();
			pointerTracker.dispose();
			if (viewportThrottleTimer) clearTimeout(viewportThrottleTimer);
			(ctx.events as { emit: EventBus["emit"] }).emit = originalEmit;
			unsubPointer();
			unsubStore();
			ctx.layers.unregister("debug-hud");
		};
	},

	teardown() {
		// overwritten by setup()
	},
};
