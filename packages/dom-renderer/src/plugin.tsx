import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { DomShapeLayer } from "./dom-shape-layer.js";

export interface DomRendererOptions {
	/**
	 * Render shapes outside the camera viewport in simplified LOD form (perf).
	 * `true` (default) uses a 120% region; pass `{ ratio }` to tune the
	 * full-detail region (1.0 = exactly the viewport, 1.2 = 20% buffer beyond it,
	 * 0.5 = only the central half). `false` disables it (all shapes full-detail).
	 */
	viewportLod?: boolean | { ratio?: number };
}

export function createDomRendererPlugin(options: DomRendererOptions = {}): UsketchPlugin {
	const viewportLodEnabled = options.viewportLod !== false;
	const viewportLodRatio =
		typeof options.viewportLod === "object" ? (options.viewportLod.ratio ?? 1.2) : 1.2;

	return {
		id: "usketch-dom-renderer",
		name: "DOM Renderer",

		setup(ctx: PluginContext) {
			// Track shape IDs claimed by other renderers (e.g. GPU)
			let claimedIds: ReadonlySet<string> = new Set();
			// Track drop target frame (set by select tool during drag)
			let dropTargetId: string | null = null;

			const unsubClaim = ctx.events.on<{ ids: ReadonlySet<string> }>(
				"renderer:claim-shapes",
				(data) => {
					// Only nudge the canvas to re-render if the claim set
					// actually changed — otherwise we'd loop with GpuShapeLayer's
					// post-commit emit.
					const next = data.ids;
					let changed = next.size !== claimedIds.size;
					if (!changed) {
						for (const id of next) {
							if (!claimedIds.has(id)) {
								changed = true;
								break;
							}
						}
					}
					claimedIds = next;
					if (changed) {
						// Re-trigger the canvas layer render so DomShapeLayer
						// picks up the new claimedIds value. Closure state
						// alone would not cause React to re-render.
						ctx.events.emit("layers:changed", {});
					}
				},
			);

			const unsubDropTarget = ctx.events.on<{ id: string | null }>(
				"drop-target:changed",
				(data) => {
					if (dropTargetId !== data.id) {
						dropTargetId = data.id;
						ctx.events.emit("layers:changed", {});
					}
				},
			);

			ctx.layers.register({
				id: "dom-shapes",
				order: 50,
				render: (renderCtx) => (
					<DomShapeLayer
						ctx={renderCtx}
						shapeRegistry={ctx.shapes}
						claimedIds={claimedIds.size > 0 ? claimedIds : undefined}
						dropTargetId={dropTargetId}
						viewportLod={viewportLodEnabled}
						viewportLodRatio={viewportLodRatio}
					/>
				),
			});

			return () => {
				unsubClaim();
				unsubDropTarget();
				ctx.layers.unregister("dom-shapes");
			};
		},
	};
}
