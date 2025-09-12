import type { Effect, Point } from "@usketch/shared-types";
import { whiteboardStore } from "@usketch/store";

export interface EffectToolConfig {
	effectType: string;
	effectConfig?: Record<string, any>;
}

export type EffectFactory = (point: Point, config: EffectToolConfig) => Effect | null;

/**
 * Effect tool handler for creating effects
 * This abstracts the effect creation logic from the canvas
 */
export class EffectTool {
	private config: EffectToolConfig;
	private effectFactory?: EffectFactory;

	constructor(config: EffectToolConfig, effectFactory?: EffectFactory) {
		this.config = config;
		this.effectFactory = effectFactory;
	}

	updateConfig(config: EffectToolConfig): void {
		this.config = config;
	}

	setEffectFactory(factory: EffectFactory): void {
		this.effectFactory = factory;
	}

	/**
	 * Create an effect at the given point
	 * @param point World coordinates where to create the effect
	 * @returns The created effect or null if creation failed
	 */
	createEffect(point: Point): Effect | null {
		if (this.effectFactory) {
			return this.effectFactory(point, this.config);
		}

		// Default generic effect creation
		const { x, y } = point;
		const { effectType, effectConfig = {} } = this.config;

		return {
			id: `${effectType}-${Date.now()}`,
			type: effectType,
			x,
			y,
			createdAt: Date.now(),
			...effectConfig,
		};
	}

	/**
	 * Handle pointer down event for effect creation
	 * @param point World coordinates
	 * @returns true if effect was created
	 */
	handlePointerDown(point: Point): boolean {
		const effect = this.createEffect(point);

		if (effect) {
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
