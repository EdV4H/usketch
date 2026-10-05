// Character controller plugin: a controllable character placed at a chosen screen
// position, moved with customizable keys (WASD by default), with a facing
// direction and a follow camera that can stay upright or turn with the heading
// (via the Core viewport rotation). Other users' characters coexist through
// awareness. The plugin draws NOTHING itself — pass `renderCharacter` for the look.
import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import type { CameraMode } from "./character-camera.js";
import type { ControlScheme, MotionParams } from "./character-physics.js";
import { setupCharacterRuntime } from "./character-runtime.js";
import { characterService, createCharacterApi } from "./character-service.js";
import { createCharacterStore } from "./character-store.js";
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
	/** Broadcast look data for your character (e.g. `{ color: "#e44" }`). */
	appearance?: CharacterAppearance;
	/** Multiplayer: share characters through this provider's awareness. Omitted = solo. */
	wsProvider?: { awareness: CharacterAwareness };
	/** Display name sent with your character. */
	userName?: string;
	/** Movement keys as `KeyboardEvent.code` lists (default WASD). */
	keys?: Partial<CharacterKeys>;
	/** Start with the character on (default `false`). */
	enabledInitially?: boolean;
	/** Default `"fixed"`. */
	cameraMode?: CameraMode;
	/** Default `"directional"`. */
	controlScheme?: ControlScheme;
	/** Speed / turning / vehicle tuning. */
	motion?: Partial<MotionParams>;
	/** Where the character sits on screen, as canvas fractions (default center). */
	screenAnchor?: { x?: number; y?: number };
	/** Follow-camera lag: 0 = rigid (default) … 0.99 = heavy. */
	followSmoothing?: number;
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
				anchor: options.screenAnchor,
				followSmoothing: options.followSmoothing,
				appearance: options.appearance,
				name: options.userName,
				renderer: options.renderCharacter,
			});
			const runtime = setupCharacterRuntime(ctx, store, {
				keys: { ...DEFAULT_KEYS, ...options.keys },
				awareness: options.wsProvider?.awareness,
			});
			const api = createCharacterApi(store, runtime);
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
