// Host-facing API of the liquid background, published on `ctx.services` so a host
// can drive it without the Control HUD (see docs/plugin-system-design.md and the
// reference `usketch-plugin-map` `map-service.ts`).
import { type BoardStore, defineService, type EventBus } from "@edv4h/usketch-shared";
import { isLiquidDisplacer, setLiquidDisplacer, toggleLiquidDisplacer } from "./displacer.js";
import type { LiquidSettings, LiquidState } from "./liquid-state.js";

export interface LiquidBgApi {
	/** Show the liquid (emits `bg:set` `{ type: "liquid" }`, hiding other backgrounds). */
	show(): void;
	/** Switch back to the background that was active before the liquid. */
	hide(): void;
	isVisible(): boolean;
	getSettings(): LiquidSettings;
	setSettings(patch: Partial<LiquidSettings>): void;
	/** Flag / unflag shapes as displacers (used when `mode` is `"marked"`). */
	setDisplacer(ids: Iterable<string>, on: boolean): void;
	/** Toggle the displacer flag on `ids` as a group; returns the applied state. */
	toggleDisplacer(ids: Iterable<string>): boolean;
	isDisplacer(id: string): boolean;
	/** Fire `listener` on visibility / settings changes. Returns an unsubscribe. */
	subscribe(listener: () => void): () => void;
}

export const liquidBgService = defineService<LiquidBgApi>("usketch-plugin-bg-liquid");

/** `bg:set` type this plugin answers to. */
export const LIQUID_BG_TYPE = "liquid";

export function createLiquidBgApi(
	store: BoardStore,
	events: EventBus,
	state: LiquidState,
	previousType: () => string,
): LiquidBgApi {
	return {
		show: () => events.emit("bg:set", { type: LIQUID_BG_TYPE }),
		hide: () => {
			if (state.isVisible()) events.emit("bg:set", { type: previousType() });
		},
		isVisible: state.isVisible,
		getSettings: state.getSettings,
		setSettings: state.setSettings,
		setDisplacer: (ids, on) => setLiquidDisplacer(store, ids, on),
		toggleDisplacer: (ids) => toggleLiquidDisplacer(store, ids),
		isDisplacer: (id) => {
			const shape = store.getShape(id);
			return shape ? isLiquidDisplacer(shape) : false;
		},
		subscribe: state.subscribe,
	};
}
