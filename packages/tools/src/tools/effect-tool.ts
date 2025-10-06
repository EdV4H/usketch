import type { EffectRegistry } from "@usketch/effect-registry";
import type { Effect, Point } from "@usketch/shared-types";

export interface EffectToolConfig {
	effectType: string;
	effectConfig?: Record<string, any>;
}

/**
 * Registry-based Effect Tool
 * Decoupled from effect creation logic - uses EffectRegistry plugins
 */
export class EffectTool {
	private config: EffectToolConfig;
	private registry: EffectRegistry;

	constructor(config: EffectToolConfig, registry: EffectRegistry) {
		this.config = config;
		this.registry = registry;
	}

	updateConfig(config: EffectToolConfig): void {
		this.config = config;
	}

	setRegistry(registry: EffectRegistry): void {
		this.registry = registry;
	}

	/**
	 * Create an effect at the given point using registered plugin
	 * @param point World coordinates where to create the effect
	 * @returns The created effect or null if creation failed
	 */
	createEffect(point: Point): Effect | null {
		const { x, y } = point;
		const { effectType, effectConfig = {} } = this.config;

		// Get plugin from registry
		const plugin = this.registry.getPlugin(effectType);
		if (!plugin) {
			console.warn(`No plugin registered for effect type: ${effectType}`);
			return null;
		}

		// Generate unique ID
		const id = `${effectType}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

		// Use plugin's createDefaultEffect
		try {
			const effect = plugin.createDefaultEffect({
				id,
				x,
				y,
				...effectConfig,
			});
			return effect;
		} catch (error) {
			console.error(`Failed to create effect of type ${effectType}:`, error);
			return null;
		}
	}

	/**
	 * Get current effect type
	 */
	getCurrentEffectType(): string {
		return this.config.effectType;
	}

	/**
	 * Check if the current effect type is registered
	 */
	isCurrentEffectTypeRegistered(): boolean {
		return this.registry.hasPlugin(this.config.effectType);
	}
}
