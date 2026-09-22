// Mode 7 plugin: a pseudo-3D "ground plane" VIEW of the Canvas (SNES Mode 7 feel).
// It tilts the real board content layers into a receding perspective via CSS 3D —
// no core coordinate changes — and adds sky/fog + a capture layer that drives the
// camera. It is a view mode (editing is suspended while active), off by default,
// and holds only per-viewer view state (never persisted as shapes). Toggle it via
// the HUD "3Dビュー切替" action, the service, or an emitted `mode7:toggle` event.
import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import type { Camera } from "./mode7-camera.js";
import { setupMode7Runtime } from "./mode7-runtime.js";
import { createMode7Api, mode7Service } from "./mode7-service.js";
import { createMode7Store, type Look } from "./mode7-store.js";
import { type Mode7Shortcuts, registerMode7Actions } from "./register-mode7-actions.js";
import { registerMode7Hud } from "./register-mode7-hud.js";

export interface Mode7PluginOptions {
	/** Start with the 3D view already on (default `false`). */
	enabledInitially?: boolean;
	/** Initial camera geometry (merged over the defaults). */
	camera?: Partial<Camera>;
	/** Initial appearance (sky / fog). */
	look?: Partial<Look>;
	/** Board content layer ids to tilt (default: Shapes + backgrounds). */
	tiltLayerIds?: string[];
	/** Keyboard shortcut bindings (opt-in; no defaults). */
	shortcuts?: Mode7Shortcuts;
}

export function createMode7Plugin(options: Mode7PluginOptions = {}): UsketchPlugin {
	const store = createMode7Store({
		active: options.enabledInitially ?? false,
		camera: options.camera,
		look: options.look,
	});
	const api = createMode7Api(store);

	return {
		id: "usketch-plugin-mode7",
		name: "Mode 7 (3D ビュー)",
		setup(ctx: PluginContext) {
			const stopRuntime = setupMode7Runtime(ctx, store, { tiltLayerIds: options.tiltLayerIds });
			const stopActions = registerMode7Actions(ctx, api, options.shortcuts);
			const stopHud = registerMode7Hud(ctx, api);
			// Provide the service LAST so a failed earlier step can't leak it.
			const unprovideService = mode7Service.provide(ctx.services, api);

			return () => {
				unprovideService();
				stopHud();
				stopActions();
				stopRuntime();
			};
		},
	};
}
