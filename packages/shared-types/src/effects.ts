/**
 * Base interface for all effects
 */
export interface BaseEffect {
	id: string;
	type: string;
	x: number;
	y: number;
	duration?: number; // milliseconds, undefined means permanent
	createdAt: number; // timestamp
	zIndex?: number; // display order
	metadata?: Record<string, any>;
}

/**
 * Ripple effect for click feedback
 */
export interface RippleEffect extends BaseEffect {
	type: "ripple";
	radius: number;
	color: string;
	opacity: number;
}

/**
 * Pin effect for comments and annotations
 */
export interface PinEffect extends BaseEffect {
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
export interface FadingPinEffect extends BaseEffect {
	type: "fading-pin";
	label?: string;
	color: string;
	authorId?: string;
	message?: string;
	size?: number;
}

// Future effect types can be added here as needed
// Example:
// export interface CursorEffect extends BaseEffect {
//   type: "cursor";
//   userId: string;
//   userName: string;
//   color: string;
// }

/**
 * Custom effect for extensions
 */
export interface CustomEffect extends BaseEffect {
	type: string; // Any custom type
	[key: string]: any; // Additional properties
}

/**
 * Union type of all standard effects
 */
export type StandardEffect = RippleEffect | PinEffect | FadingPinEffect;

/**
 * Union type of all effects including custom
 */
export type Effect = StandardEffect | CustomEffect;
