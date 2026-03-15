import type {
	CanvasPointerEvent,
	PluginContext,
	Point,
	ToolContext,
	UsketchPlugin,
} from "@edv4h/usketch-shared";

// ── Icon ──

function PanIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20">
			<path
				d="M10 2L10 18M2 10L18 10M10 2L7 5M10 2L13 5M10 18L7 15M10 18L13 15M2 10L5 7M2 10L5 13M18 10L15 7M18 10L15 13"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

// ── Plugin ──

export const panToolPlugin: UsketchPlugin = {
	id: "usketch-plugin-tool-pan",
	name: "パン",

	setup(ctx: PluginContext) {
		// ── Local pan state (scoped to this setup closure) ──
		let panState: { lastPoint: Point } | null = null;

		function onPointerDown(_toolCtx: ToolContext, event: CanvasPointerEvent) {
			panState = {
				lastPoint: { x: event.screenPoint.x, y: event.screenPoint.y },
			};
		}

		function onPointerMove(toolCtx: ToolContext, event: CanvasPointerEvent) {
			if (!panState) return;

			const dx = event.screenPoint.x - panState.lastPoint.x;
			const dy = event.screenPoint.y - panState.lastPoint.y;

			toolCtx.store.panBy(dx, dy);

			panState.lastPoint = { x: event.screenPoint.x, y: event.screenPoint.y };
		}

		function onPointerUp(_toolCtx: ToolContext, _event: CanvasPointerEvent) {
			panState = null;
		}

		function onDeactivate(_toolCtx: ToolContext) {
			panState = null;
		}

		ctx.tools.register("pan", {
			icon: PanIcon,
			cursor: "grab",
			shortcut: "h",
			order: 1,
			onPointerDown,
			onPointerMove,
			onPointerUp,
			onDeactivate,
		});
	},
};
