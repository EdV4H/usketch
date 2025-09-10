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
 * Cursor effect for multi-user collaboration
 */
export interface CursorEffect extends BaseEffect {
	type: "cursor";
	userId: string;
	userName: string;
	color: string;
	size?: number;
}

/**
 * Highlight effect for emphasis
 */
export interface HighlightEffect extends BaseEffect {
	type: "highlight";
	width: number;
	height: number;
	color: string;
	opacity: number;
	pulseAnimation?: boolean;
}

/**
 * Tooltip effect for hover information
 */
export interface TooltipEffect extends BaseEffect {
	type: "tooltip";
	content: string;
	backgroundColor?: string;
	textColor?: string;
	fontSize?: number;
	maxWidth?: number;
}

/**
 * Fade effect for transitions
 */
export interface FadeEffect extends BaseEffect {
	type: "fade";
	targetOpacity: number;
	fadeIn?: boolean;
	fadeOut?: boolean;
}

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
export type StandardEffect =
	| RippleEffect
	| PinEffect
	| CursorEffect
	| HighlightEffect
	| TooltipEffect
	| FadeEffect;

/**
 * Union type of all effects including custom
 */
export type Effect = StandardEffect | CustomEffect;
