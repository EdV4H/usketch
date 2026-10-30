import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { DomShapeLayer } from "./dom-shape-layer.js";

export interface DomRendererOptions {
	/**
	 * Render shapes outside the camera viewport in simplified LOD form (perf).
	 * `true` (default) uses a 120% region; pass `{ ratio }` to tune the
	 * full-detail region (1.0 = exactly the viewport, 1.2 = 20% buffer beyond it,
	 * 0.5 = only the central half). `false` disables it (all shapes full-detail).
	 * While on, shapes beyond `cullRatio` × the viewport (default 2) are not rendered.
	 */
	viewportLod?: boolean | { ratio?: number; cullRatio?: number };
}

/** Runtime override of the viewport-LOD setting (emit to adjust from a UI control). */
export interface SetViewportLodEvent {
	enabled?: boolean;
	ratio?: number;
}
export const SET_VIEWPORT_LOD_EVENT = "renderer:set-viewport-lod";

/**
 * Event a 3D view (Mode 7) emits with how many screen px of the board it shows past the
 * viewport (`{ px }`); the cull region grows by that much so those shapes stay drawn.
 * Shared with the background grid and the map ground, which follow the same event.
 */
export const VIEWPORT_OVERSCAN_EVENT = "bg-grid:set-overscan";

const DEFAULT_VIEWPORT_LOD_RATIO = 1.2;
const DEFAULT_VIEWPORT_CULL_RATIO = 2;

/** Clamp a user-provided ratio to a finite positive number (else the default). */
function sanitizeRatio(ratio: number | undefined, fallback = DEFAULT_VIEWPORT_LOD_RATIO): number {
	if (typeof ratio !== "number" || !Number.isFinite(ratio) || ratio <= 0) {
		return fallback;
	}
	return ratio;
}

export function createDomRendererPlugin(options: DomRendererOptions = {}): UsketchPlugin {
	// `let` so a runtime control (SET_VIEWPORT_LOD_EVENT) can update them; the
	// render closure below reads the latest values.
	let viewportLodEnabled = options.viewportLod !== false;
	let viewportLodRatio = sanitizeRatio(
		typeof options.viewportLod === "object" ? options.viewportLod.ratio : undefined,
	);
	const viewportCullRatio = sanitizeRatio(
		typeof options.viewportLod === "object" ? options.viewportLod.cullRatio : undefined,
		DEFAULT_VIEWPORT_CULL_RATIO,
	);

	return {
		id: "usketch-dom-renderer",
		name: "DOM Renderer",

		setup(ctx: PluginContext) {
			// Track shape IDs claimed by other renderers (e.g. GPU)
			let claimedIds: ReadonlySet<string> = new Set();
			// Track drop target frame (set by select tool during drag)
			let dropTargetId: string | null = null;
			// Screen px a 3D view shows past the viewport (see VIEWPORT_OVERSCAN_EVENT)
			let overscanPx = 0;

			// Runtime viewport-LOD adjustment from a UI control (Control HUD).
			const unsubViewportLod = ctx.events.on<SetViewportLodEvent>(SET_VIEWPORT_LOD_EVENT, (d) => {
				if (typeof d.enabled === "boolean") viewportLodEnabled = d.enabled;
				if (typeof d.ratio === "number") viewportLodRatio = sanitizeRatio(d.ratio);
				ctx.events.emit("layers:changed", {});
			});

			const unsubOverscan = ctx.events.on<{ px: number }>(VIEWPORT_OVERSCAN_EVENT, ({ px }) => {
				const next = Number.isFinite(px) && px > 0 ? px : 0;
				if (next === overscanPx) return;
				overscanPx = next;
				ctx.events.emit("layers:changed", {});
			});

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
						viewportCullRatio={viewportCullRatio}
						cullPadPx={overscanPx}
					/>
				),
			});

			return () => {
				unsubClaim();
				unsubDropTarget();
				unsubViewportLod();
				unsubOverscan();
				ctx.layers.unregister("dom-shapes");
			};
		},
	};
}
