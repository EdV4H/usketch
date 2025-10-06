import { type EffectRegistry, globalEffectRegistry } from "@usketch/effect-registry";
import type { Point } from "@usketch/shared-types";
import { whiteboardStore } from "@usketch/store";
import { assign, setup } from "xstate";

/**
 * Effect Tool Context
 */
export interface EffectToolContext {
	effectRegistry: EffectRegistry | null;
}

/**
 * Effect Tool Events
 */
export type EffectToolEvent =
	| { type: "POINTER_DOWN"; point: Point; position: Point }
	| { type: "POINTER_MOVE"; point: Point; position: Point }
	| { type: "POINTER_UP"; point: Point; position: Point }
	| { type: "SET_REGISTRY"; registry: EffectRegistry };

/**
 * Create Effect Tool State Machine
 * Simple machine that creates effects on pointer down
 */
export function createEffectTool(registry?: EffectRegistry) {
	return setup({
		types: {
			context: {} as EffectToolContext,
			events: {} as EffectToolEvent,
		},
		actions: {
			createEffect: ({ context, event }) => {
				if (event.type !== "POINTER_DOWN") return;

				// Use context registry or fallback to global registry
				const registry: EffectRegistry = context.effectRegistry || globalEffectRegistry;

				if (!registry) {
					console.warn("EffectRegistry not available");
					return;
				}

				const { point } = event;
				const { effectToolConfig, addEffect } = whiteboardStore.getState();

				// Get plugin from registry
				const plugin = registry.getPlugin(effectToolConfig.effectType);
				if (!plugin) {
					console.warn(`No plugin registered for effect type: ${effectToolConfig.effectType}`);
					return;
				}

				// Generate unique ID
				const id = `${effectToolConfig.effectType}-${Date.now()}-${Math.random()
					.toString(36)
					.slice(2, 11)}`;

				try {
					// Use plugin's createDefaultEffect
					const effect = plugin.createDefaultEffect({
						id,
						x: point.x,
						y: point.y,
						...effectToolConfig.effectConfig,
					});

					if (effect) {
						addEffect(effect);
					}
				} catch (error) {
					console.error(`Failed to create effect of type ${effectToolConfig.effectType}:`, error);
				}
			},

			setRegistry: assign({
				effectRegistry: ({ event }) => {
					if (event.type === "SET_REGISTRY") {
						return event.registry;
					}
					return null;
				},
			}),
		},
	}).createMachine({
		id: "effectTool",
		initial: "idle",
		context: {
			effectRegistry: registry || null,
		},
		states: {
			idle: {
				on: {
					POINTER_DOWN: {
						actions: ["createEffect"],
					},
					SET_REGISTRY: {
						actions: ["setRegistry"],
					},
				},
			},
		},
	});
}

/**
 * Default effect tool machine (without registry)
 * Registry should be set via SET_REGISTRY event
 */
export const effectToolMachine = createEffectTool();
