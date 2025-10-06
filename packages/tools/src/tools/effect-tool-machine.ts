import type { Effect, Point } from "@usketch/shared-types";
import { assign, setup } from "xstate";

// === Effect Tool State Machine ===
export type EffectType = "ripple" | "pin" | "fading-pin";

export interface EffectToolContext {
	effectType: EffectType;
	effectConfig: Record<string, any>;
	previewShape: null; // Effect tool doesn't have preview
}

export type EffectToolEvent =
	| { type: "POINTER_DOWN"; point: Point; position: Point }
	| { type: "POINTER_MOVE"; point: Point; position: Point }
	| { type: "POINTER_UP"; point: Point; position: Point }
	| { type: "ESCAPE" }
	| { type: "SET_EFFECT_TYPE"; effectType: EffectType }
	| { type: "SET_EFFECT_CONFIG"; config: Record<string, any> };

/**
 * Create effect tool state machine
 */
export function createEffectTool() {
	return setup({
		types: {
			context: {} as EffectToolContext,
			events: {} as EffectToolEvent,
		},
		actions: {
			createEffect: ({ context, event }) => {
				if (event.type !== "POINTER_DOWN") return;

				const { x, y } = event.point;
				const config = context.effectConfig || {};

				// Create effect based on type
				let effect: Effect;

				switch (context.effectType) {
					case "ripple":
						effect = {
							id: `ripple-${Date.now()}`,
							type: "ripple",
							x,
							y,
							radius: config.radius || 60,
							color: config.color || "#4ECDC4",
							opacity: config.opacity || 1.0,
							createdAt: Date.now(),
							duration: config.duration || 600,
						};
						break;

					case "pin":
						effect = {
							id: `pin-${Date.now()}`,
							type: "pin",
							x,
							y,
							color: config.color || "#ff6b6b",
							size: config.size || 24,
							message: config.message || "Comment",
							label: config.label || "📌",
							createdAt: Date.now(),
						};
						break;

					case "fading-pin":
						effect = {
							id: `fading-pin-${Date.now()}`,
							type: "fading-pin",
							x,
							y,
							color: config.color || "#9b59b6",
							size: config.size || 24,
							message: config.message || "Temporary note",
							label: config.label || "📍",
							createdAt: Date.now(),
							duration: config.fadeDuration || 5000,
							metadata: {
								fadeDelay: config.fadeDelay || 3000,
							},
						};
						break;

					default:
						return;
				}

				// Store effect in global window object (for compatibility)
				(window as any).__lastCreatedEffect = effect;
			},

			setEffectType: assign(({ event }) => {
				if (event.type !== "SET_EFFECT_TYPE") return {};
				return { effectType: event.effectType };
			}),

			setEffectConfig: assign(({ event }) => {
				if (event.type !== "SET_EFFECT_CONFIG") return {};
				return { effectConfig: event.config };
			}),
		},
	}).createMachine({
		id: "effectTool",
		initial: "idle",
		context: {
			effectType: "ripple",
			effectConfig: {},
			previewShape: null,
		},
		states: {
			idle: {
				on: {
					POINTER_DOWN: {
						target: "idle",
						actions: ["createEffect"],
					},
					SET_EFFECT_TYPE: {
						target: "idle",
						actions: ["setEffectType"],
					},
					SET_EFFECT_CONFIG: {
						target: "idle",
						actions: ["setEffectConfig"],
					},
				},
			},
		},
	});
}
