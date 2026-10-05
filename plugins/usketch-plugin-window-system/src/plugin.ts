// Window System plugin: turns the Canvas into a browser-resident window manager.
// It has two responsibilities — (1) a FIXED SCREEN (viewport lock: camera frozen
// at 100%/origin) and (2) a placement MODE toggle between free (floating) and tile
// (an i3/sway-style tree that fills the screen). Top-level shapes are "windows".
// Every operation is exposed as an ACTION on four paths (event / HUD / keyboard /
// service). Like dashboard, it registers only a DATA-ONLY config singleton (no user
// widget shape) and is opt-in: `autoEnable` is false so the main board isn't
// converted unless a host enables it (or the user clicks the HUD "ウィンドウ化").
// Register it AFTER the container / free-position plugins so its tiling is the last
// writer on top-level moves.
import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { ensureWindowConfig } from "./config-ops.js";
import { registerWindowActions, type WindowShortcuts } from "./register-window-actions.js";
import { registerWindowHud } from "./register-window-hud.js";
import { setupViewportLock } from "./viewport-lock.js";
import { WINDOW_CONFIG_TYPE, type WindowDefaults } from "./window-config-shape.js";
import { createWindowConfigShapeDefinition } from "./window-config-shape-def.js";
import { applyTile, setupWindowRuntime } from "./window-runtime.js";
import { createWindowApi, windowSystemService } from "./window-service.js";

export interface WindowSystemPluginOptions extends WindowDefaults {
	/**
	 * Create the config singleton on setup so the board becomes a window board
	 * immediately (default `false`). Left off, activation is a host calling the
	 * service `enable()` / the HUD "ウィンドウ化" action.
	 */
	autoEnable?: boolean;
	/** Keyboard shortcut overrides (combo string binds, `null` disables, omit keeps
	 *  the default). Only arrow-based focus/move are bound by default. */
	shortcuts?: WindowShortcuts;
}

export function createWindowSystemPlugin(options: WindowSystemPluginOptions = {}): UsketchPlugin {
	const { autoEnable = false, shortcuts, ...defaults } = options;
	return {
		id: "usketch-plugin-window-system",
		name: "ウィンドウシステム",
		setup(ctx: PluginContext) {
			ctx.shapes.register(WINDOW_CONFIG_TYPE, createWindowConfigShapeDefinition(defaults));

			const api = createWindowApi(ctx, defaults);

			// Disposed guard: the autoEnable task WRITES to the store, and a microtask
			// can't be cancelled — without this it could run after teardown and mutate
			// a destroyed app's store.
			let disposed = false;

			// Defer to a microtask so shapes hydrated synchronously on load (incl. a
			// synced config from another client) are visible first — `ensure` is a
			// no-op when a config already exists, avoiding a duplicate singleton.
			if (autoEnable) {
				queueMicrotask(() => {
					if (disposed) return;
					ensureWindowConfig(ctx.store, defaults);
					applyTile(ctx);
				});
			}

			const stopRuntime = setupWindowRuntime(ctx);
			const stopViewportLock = setupViewportLock(ctx);
			const stopActions = registerWindowActions(ctx, api, shortcuts);
			const stopHud = registerWindowHud(ctx, api);
			// Provide the service LAST: `createApp` can only roll back a failed setup
			// via the teardown we return, so if an earlier step throws the service was
			// never registered and can't leak. (Same ordering as dashboard / map.)
			const unprovideService = windowSystemService.provide(ctx.services, api);

			return () => {
				disposed = true;
				unprovideService();
				stopHud();
				stopActions();
				stopViewportLock();
				stopRuntime();
			};
		},
	};
}
