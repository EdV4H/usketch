/**
 * Base interface for all effects
 * Effects are visual overlays on the canvas that can be temporary or permanent
 */
export interface Effect {
	id: string;
	type: string;
	x: number;
	y: number;
	duration?: number; // milliseconds, undefined means permanent
	createdAt: number; // timestamp
	zIndex?: number; // display order
	metadata?: Record<string, any>;
	[key: string]: any; // Allow additional properties for extensibility
}
