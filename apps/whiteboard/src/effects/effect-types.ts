import type { Effect } from "@usketch/shared-types";

/**
 * Ripple effect for click feedback
 */
export interface RippleEffect extends Effect {
	type: "ripple";
	radius: number;
	color: string;
	opacity: number;
}

/**
 * Pin effect for comments and annotations
 */
export interface PinEffect extends Effect {
	type: "pin";
	label?: string;
	color: string;
	authorId?: string;
	message?: string;
	size?: number;
}

/**
 * Fading pin effect for temporary comments
 */
export interface FadingPinEffect extends Effect {
	type: "fading-pin";
	label?: string;
	color: string;
	authorId?: string;
	message?: string;
	size?: number;
}

/**
 * Union type of all application effects
 */
export type AppEffect = RippleEffect | PinEffect | FadingPinEffect;
