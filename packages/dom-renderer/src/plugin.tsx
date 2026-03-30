import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { DomShapeLayer } from "./dom-shape-layer.js";

export function createDomRendererPlugin(): UsketchPlugin {
	let cleanup: (() => void) | undefined;

	return {
		id: "usketch-dom-renderer",
		name: "DOM Renderer",

		setup(ctx: PluginContext) {
			// Track shape IDs claimed by other renderers (e.g. GPU)
			let claimedIds: ReadonlySet<string> = new Set();

			const unsubClaim = ctx.events.on<{ ids: ReadonlySet<string> }>(
				"renderer:claim-shapes",
				(data) => {
					claimedIds = data.ids;
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
					/>
				),
			});

			cleanup = () => {
				unsubClaim();
				ctx.layers.unregister("dom-shapes");
			};
		},

		teardown() {
			cleanup?.();
		},
	};
}
