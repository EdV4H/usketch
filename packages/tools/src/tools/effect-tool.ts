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
		console.log("[EffectTool] createEffect called");

		if (this.effectFactory) {
			console.log("[EffectTool] Using custom effectFactory");
			return this.effectFactory(point, this.config);
		}

		// Default generic effect creation
		const { x, y } = point;
		const { effectType, effectConfig = {} } = this.config;

		console.log("[EffectTool] Creating default effect with type:", effectType, "at position:", {
			x,
			y,
		});

		const newEffect = {
			id: `${effectType}-${Date.now()}`,
			type: effectType,
			x,
			y,
			createdAt: Date.now(),
			...effectConfig,
		};

		console.log("[EffectTool] Created effect object:", newEffect);
		return newEffect;
	}

	/**
	 * Handle pointer down event for effect creation
	 * @param point World coordinates
	 * @returns true if effect was created
	 */
	handlePointerDown(point: Point): boolean {
		console.log("[EffectTool] handlePointerDown called with point:", point);
		console.log("[EffectTool] Current config:", this.config);

		const effect = this.createEffect(point);
		console.log("[EffectTool] Created effect:", effect);

		if (effect) {
			const { addEffect } = whiteboardStore.getState();
			console.log("[EffectTool] Calling addEffect with effect:", effect);
			addEffect(effect);
			console.log("[EffectTool] Effect added to store successfully");
			return true;
		}

		console.log("[EffectTool] No effect created, returning false");
		return false;
	}
}

// Singleton instance for the effect tool
let effectToolInstance: EffectTool | null = null;

/**
 * Get or create the effect tool instance
 */
export function getEffectTool(): EffectTool {
	console.log("[EffectTool] getEffectTool called");

	if (!effectToolInstance) {
		console.log("[EffectTool] Creating new EffectTool instance");
		const { effectToolConfig } = whiteboardStore.getState();
		console.log("[EffectTool] effectToolConfig from store:", effectToolConfig);
		effectToolInstance = new EffectTool(effectToolConfig);

		// Subscribe to config changes
		whiteboardStore.subscribe((state, prevState) => {
			if (state.effectToolConfig !== prevState.effectToolConfig) {
				console.log("[EffectTool] Config changed, updating:", state.effectToolConfig);
				effectToolInstance?.updateConfig(state.effectToolConfig);
			}
		});
	} else {
		console.log("[EffectTool] Returning existing instance");
	}

	return effectToolInstance;
}
