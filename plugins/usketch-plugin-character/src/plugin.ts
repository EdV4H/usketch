// Character controller plugin: a controllable character placed at a chosen screen
// position, moved with customizable keys (WASD by default), with a facing
// direction and a follow camera that can stay upright or turn with the heading
// (via the Core viewport rotation). Other users' characters coexist through
// awareness. The plugin draws NOTHING itself — pass `renderCharacter` for the look.
import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import type { CameraMode } from "./character-camera.js";
import { CHARACTER_KEY_IDS } from "./character-input.js";
import { defaultKeyStorage, loadStoredKeys, saveStoredKeys } from "./character-keys.js";
import type { ControlScheme, DriftParams, MotionParams } from "./character-physics.js";
import { setupCharacterRuntime } from "./character-runtime.js";
import { characterService, createCharacterApi } from "./character-service.js";
import type { CharacterSize } from "./character-size.js";
import { createCharacterStore, type JumpInit } from "./character-store.js";
import type { CharacterAwareness } from "./character-sync.js";
import {
	type CharacterAppearance,
	type CharacterKeys,
	type CharacterRenderer,
	DEFAULT_KEYS,
} from "./character-types.js";
import { registerCharacterHud } from "./register-character-hud.js";

export interface CharacterPluginOptions {
	/** Draws a character (self and others). Omitted = headless (nothing drawn). */
	renderCharacter?: CharacterRenderer;
	/**
	 * Draws a character's shadow, placed on the ground under it (the body stands at its
	 * feet height, so a jump lifts it off the shadow in 3D). Omitted = no shadow.
	 */
	renderShadow?: CharacterRenderer;
	/** Broadcast look data for your character (e.g. `{ color: "#e44" }`). */
	appearance?: CharacterAppearance;
	/** Multiplayer: share characters through this provider's awareness. Omitted = solo. */
	wsProvider?: { awareness: CharacterAwareness };
	/** Display name sent with your character. */
	userName?: string;
	/**
	 * Keys as `KeyboardEvent.code` lists (default WASD, drift Shift, jump Space): the
	 * defaults of the keymap bindings `CHARACTER_KEY_IDS`. Viewers rebind them in the
	 * app's key settings (`usketch-plugin-key-settings`).
	 */
	keys?: Partial<CharacterKeys>;
	/**
	 * Keep each viewer's key settings in localStorage (default `true`). `false` = the HUD
	 * changes last only for the session.
	 * @deprecated With a keymap (current hosts) the app's key settings keep them; this
	 * only stops carrying over keys saved by older versions (and applies to hosts without
	 * a keymap).
	 */
	saveKeys?: boolean;
	/** Start with the character on (default `false`). */
	enabledInitially?: boolean;
	/** Default `"fixed"`. */
	cameraMode?: CameraMode;
	/** Default `"directional"`. */
	controlScheme?: ControlScheme;
	/** Speed / turning / vehicle tuning. */
	motion?: Partial<MotionParams>;
	/**
	 * Vehicle: hold the drift key while steering at speed to drift. `true` = default
	 * tuning, an object = overrides. Default off.
	 */
	drift?: boolean | Partial<DriftParams>;
	/**
	 * Press the jump key (Space) to jump: hop over cliffs taller than `motion.maxStep`.
	 * `true` = default tuning, an object = overrides (`airJumps` for multi-jumps, `hover:
	 * true` / a partial to hover while the key is held in a fall). Default off.
	 */
	jump?: boolean | JumpInit;
	/** Where the character sits on screen, as canvas fractions (default center). */
	screenAnchor?: { x?: number; y?: number };
	/** Follow-camera lag: 0 = rigid (default) … 0.99 = heavy. */
	followSmoothing?: number;
	/**
	 * Under a 3D view (Mode 7) the follow raises the camera with the ground under the
	 * feet; the body pulls it higher only once it is more than this (world units) above
	 * that ground. Default = the jump's height (an ordinary jump doesn't bob the view, a
	 * long hover or a fall stays in view); `0` = follow the body's height exactly.
	 */
	cameraHeightMargin?: number;
	/**
	 * How big the body is drawn, handed to the renderers as `size` (screen px). Default 36 px
	 * at every zoom; `{ scale: "world", value: 24 }` scales it with the ground instead.
	 */
	size?: Partial<CharacterSize>;
}

export function createCharacterPlugin(options: CharacterPluginOptions = {}): UsketchPlugin {
	return {
		id: "usketch-plugin-character",
		name: "キャラクター",
		setup(ctx: PluginContext) {
			const store = createCharacterStore({
				enabled: options.enabledInitially,
				cameraMode: options.cameraMode,
				controlScheme: options.controlScheme,
				motion: options.motion,
				drift: options.drift,
				jump: options.jump,
				anchor: options.screenAnchor,
				followSmoothing: options.followSmoothing,
				cameraHeightMargin: options.cameraHeightMargin,
				size: options.size,
				appearance: options.appearance,
				name: options.userName,
				renderer: options.renderCharacter,
				shadowRenderer: options.renderShadow,
			});
			const defaultKeys: CharacterKeys = { ...DEFAULT_KEYS, ...options.keys };
			const keymap = (ctx as Partial<PluginContext>).keymap ?? null;
			const keyStorage = options.saveKeys === false ? null : defaultKeyStorage();
			// The host's keys are the bindings' defaults; this viewer's rebindings go on top.
			const runtime = setupCharacterRuntime(ctx, store, {
				keys: defaultKeys,
				awareness: options.wsProvider?.awareness,
			});
			const storedKeys = loadStoredKeys(keyStorage, defaultKeys);
			if (storedKeys && keymap) {
				// Carry the keys this plugin used to save itself into the keymap, once: the
				// app's key settings (e.g. usketch-plugin-key-settings) keep them from now on.
				// Rebindings already in the keymap win.
				const overrides = keymap.getOverrides();
				const current = runtime.getKeys();
				const merged = { ...storedKeys };
				for (const name of Object.keys(CHARACTER_KEY_IDS) as (keyof CharacterKeys)[]) {
					if (CHARACTER_KEY_IDS[name] in overrides) merged[name] = current[name] ?? [];
				}
				runtime.setKeys(merged);
				saveStoredKeys(keyStorage, null);
			} else if (storedKeys) {
				runtime.setKeys(storedKeys);
			}
			const api = createCharacterApi(store, runtime, {
				defaults: defaultKeys,
				// With a keymap, the app's key settings keep the viewer's keys.
				storage: keymap ? null : keyStorage,
			});
			const stopHud = registerCharacterHud(ctx, api);
			// Provide the service LAST so a failed earlier step can't leak it.
			const unprovide = characterService.provide(ctx.services, api);

			return () => {
				unprovide();
				stopHud();
				runtime.dispose();
			};
		},
	};
}
