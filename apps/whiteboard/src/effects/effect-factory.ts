import type { Effect, Point } from "@usketch/shared-types";
import type { EffectToolConfig } from "@usketch/tools";
import type { AppEffect, FadingPinEffect, PinEffect, RippleEffect } from "./effect-types";

/**
 * Application-specific effect factory
 * Creates effects based on the effect type and configuration
 */
export function createAppEffect(point: Point, config: EffectToolConfig): Effect | null {
	const { x, y } = point;
	const { effectType, effectConfig = {} } = config;

	let effect: AppEffect | null = null;

	switch (effectType) {
		case "ripple": {
			const rippleEffect: RippleEffect = {
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
			effect = rippleEffect;
			break;
		}

		case "pin": {
			const pinEffect: PinEffect = {
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
			effect = pinEffect;
			break;
		}

		case "fading-pin": {
			const fadingPinEffect: FadingPinEffect = {
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
			effect = fadingPinEffect;
			break;
		}

		default:
			// For unknown effect types, return null or create a generic effect
			return {
				id: `${effectType}-${Date.now()}`,
				type: effectType,
				x,
				y,
				createdAt: Date.now(),
				...effectConfig,
			};
	}

	return effect;
}
