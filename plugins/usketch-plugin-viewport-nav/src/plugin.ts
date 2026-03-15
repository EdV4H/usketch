import type {
	CanvasPointerEvent,
	CanvasWheelEvent,
	PluginContext,
	Point,
	UsketchPlugin,
} from "@edv4h/usketch-shared";

export const viewportNavPlugin: UsketchPlugin = {
	id: "usketch-plugin-viewport-nav",
	name: "ビューポートナビゲーション",

	setup(ctx: PluginContext) {
		// ── Local pan state (scoped to this setup closure) ──
		let middlePanState: { lastPoint: Point } | null = null;

		// ── Wheel: zoom & pan ──
		ctx.events.on<CanvasWheelEvent>("canvas:wheel", (event) => {
			if (event.ctrlKey || event.metaKey) {
				// Zoom toward cursor
				const viewport = ctx.store.getViewport();
				const factor = event.deltaY > 0 ? 0.9 : 1.1;
				ctx.store.zoomTo(viewport.zoom * factor, event.screenPoint);
			} else {
				// Pan
				ctx.store.panBy(-event.deltaX, -event.deltaY);
			}
		});

		// ── Middle-click pan ──
		ctx.events.on<CanvasPointerEvent>("canvas:middle-down", (event) => {
			middlePanState = {
				lastPoint: { x: event.screenPoint.x, y: event.screenPoint.y },
			};
		});

		ctx.events.on<CanvasPointerEvent>("canvas:pointermove", (event) => {
			if (!middlePanState) return;

			const dx = event.screenPoint.x - middlePanState.lastPoint.x;
			const dy = event.screenPoint.y - middlePanState.lastPoint.y;

			ctx.store.panBy(dx, dy);

			middlePanState.lastPoint = {
				x: event.screenPoint.x,
				y: event.screenPoint.y,
			};
		});

		ctx.events.on<CanvasPointerEvent>("canvas:pointerup", (_event) => {
			middlePanState = null;
		});
	},
};
