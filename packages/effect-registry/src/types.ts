import type { Camera, Effect, Point } from "@usketch/shared-types";
import type { ComponentType } from "react";

/**
 * Props for creating a new effect
 */
export interface CreateEffectProps {
	id: string;
	x: number;
	y: number;
	[key: string]: any;
}

/**
 * Interaction event for effects
 */
export interface InteractionEvent {
	type: "click" | "hover" | "drag";
	x: number;
	y: number;
	target?: HTMLElement;
}

/**
 * Props for effect components
 */
export interface EffectComponentProps<T extends Effect = Effect> {
	effect: T;
	camera: Camera;
	onComplete?: () => void;
	onInteraction?: (event: InteractionEvent) => void;
}

/**
 * Effect plugin definition
 */
export interface EffectPlugin<T extends Effect = Effect> {
	/** Unique identifier for the effect type */
	type: string;

	/** Display name for the effect */
	name?: string;

	/** React component for rendering the effect */
	component: ComponentType<EffectComponentProps<T>>;

	/** Create a default effect with initial properties */
	createDefaultEffect: (props: CreateEffectProps) => T;

	/** Validate effect data */
	validate?: (effect: T) => boolean;

	/** Effect lifecycle management */
	lifecycle?: {
		/** Called when effect is added */
		onMount?: (effect: T) => void;
		/** Called when effect is removed */
		onUnmount?: (effect: T) => void;
		/** Called when effect is updated */
		onUpdate?: (oldEffect: T, newEffect: T) => void;
	};

	/** Whether the effect can be interacted with */
	interactive?: boolean;

	/** Test if a point is inside the effect (for interactive effects) */
	hitTest?: (effect: T, point: Point) => boolean;

	/** Custom animation settings (framer-motion compatible) */
	animation?: {
		initial?: any;
		animate?: any;
		exit?: any;
		transition?: any;
	};
}

/**
 * Registry event types
 */
export type RegistryEventType = "register" | "unregister" | "update";

/**
 * Registry event
 */
export interface RegistryEvent {
	type: RegistryEventType;
	effectType: string;
	plugin?: EffectPlugin;
}

/**
 * Registry event listener
 */
export type RegistryEventListener = (event: RegistryEvent) => void;

/**
 * Props for EffectRegistryProvider (exported for convenience)
 */
export interface EffectRegistryProviderProps {
	children: React.ReactNode;
	plugins?: EffectPlugin[];
	registry?: any; // Avoid circular dependency
}
