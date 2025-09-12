import type { Effect, Point } from "@usketch/shared-types";
import { whiteboardStore } from "@usketch/store";

export interface EffectToolConfig {
	effectType: string;
	effectConfig?: Record<string, any>;
}

/**
 * Effect tool handler for creating effects
 * This abstracts the effect creation logic from the canvas
 */
export class EffectTool {
	private config: EffectToolConfig;

	constructor(config: EffectToolConfig) {
		this.config = config;
	}

	updateConfig(config: EffectToolConfig): void {
		this.config = config;
	}

	/**
	 * Create an effect at the given point
	 * @param point World coordinates where to create the effect
	 * @returns The created effect or null if creation failed
	 */
	createEffect(point: Point): Effect | null {
		const { x, y } = point;
		const { effectType, effectConfig = {} } = this.config;

		let effect: Effect | null = null;

		switch (effectType) {
			case "ripple":
				effect = {
					id: `ripple-${Date.now()}`,
					type: "ripple",
					x,
					y,
					radius: effectConfig["radius"] || 60,
					color: effectConfig["color"] || "#4ECDC4",
					opacity: effectConfig["opacity"] || 1.0,
					createdAt: Date.now(),
					duration: effectConfig["duration"] || 600,
				};
				break;

			case "pin":
				effect = {
					id: `pin-${Date.now()}`,
					type: "pin",
					x,
					y,
					color: effectConfig["color"] || "#ff6b6b",
					size: effectConfig["size"] || 24,
					message: effectConfig["message"] || "Comment",
					label: effectConfig["label"] || "📌",
					createdAt: Date.now(),
				};
				break;

			case "fading-pin":
				effect = {
					id: `fading-pin-${Date.now()}`,
					type: "fading-pin",
					x,
					y,
					color: effectConfig["color"] || "#9b59b6",
					size: effectConfig["size"] || 24,
					message: effectConfig["message"] || "Temporary note",
					label: effectConfig["label"] || "📍",
					createdAt: Date.now(),
					duration: effectConfig["fadeDuration"] || 5000,
					metadata: {
						fadeDelay: effectConfig["fadeDelay"] || 3000,
					},
				};
				break;

			default:
				// For custom effect types, create a generic effect
				effect = {
					id: `${effectType}-${Date.now()}`,
					type: effectType,
					x,
					y,
					createdAt: Date.now(),
					...effectConfig,
				};
				break;
		}

		return effect;
	}

	/**
	 * Handle pointer down event for effect creation
	 * @param point World coordinates
	 * @returns true if effect was created
	 */
	handlePointerDown(point: Point): boolean {
		const effect = this.createEffect(point);

		if (effect) {
			console.log(`Adding ${this.config.effectType} effect at`, { x: point.x, y: point.y });
			const { addEffect } = whiteboardStore.getState();
			addEffect(effect);
			return true;
		}

		return false;
	}
}

// Singleton instance for the effect tool
let effectToolInstance: EffectTool | null = null;

/**
 * Get or create the effect tool instance
 */
export function getEffectTool(): EffectTool {
	if (!effectToolInstance) {
		const { effectToolConfig } = whiteboardStore.getState();
		effectToolInstance = new EffectTool(effectToolConfig);

		// Subscribe to config changes
		whiteboardStore.subscribe((state, prevState) => {
			if (state.effectToolConfig !== prevState.effectToolConfig) {
				effectToolInstance?.updateConfig(state.effectToolConfig);
			}
		});
	}
	return effectToolInstance;
}
