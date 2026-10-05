// createScatterPlugin — registers the "spill out related shapes" (ぶちまける)
// controls on the Control HUD and publishes the host-facing scatter service. The
// operation logic lives in `scatter()` (engine.ts); this only wires it up.
import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { registerScatterHud } from "./hud/register-scatter-hud.js";
import { createScatterApi, scatterService } from "./scatter-service.js";

export function createScatterPlugin(): UsketchPlugin {
	return {
		id: "usketch-plugin-scatter",
		name: "Scatter",

		setup(ctx: PluginContext) {
			const unregisterHud = registerScatterHud(ctx);
			// Provided last so a HUD registration failure can't leak the service.
			const unprovide = scatterService.provide(
				ctx.services,
				createScatterApi({ store: ctx.store, shapes: ctx.shapes, commands: ctx.commands }),
			);
			return () => {
				unprovide();
				unregisterHud();
			};
		},
	};
}
