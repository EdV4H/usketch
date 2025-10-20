import { EffectRegistryProvider } from "@usketch/effect-registry";
import { ShapeRegistryProvider } from "@usketch/shape-registry";
import type React from "react";
import type { CanvasProps } from "../types";
import { WhiteboardCanvasInternal } from "./whiteboard-canvas-internal";

/**
 * Whiteboard Canvas Component (Bundle Pattern)
 *
 * This is a convenience wrapper that automatically sets up ShapeRegistryProvider
 * and EffectRegistryProvider based on the provided props.
 *
 * For more flexibility, consider using the Anatomy pattern with Whiteboard.Root,
 * Whiteboard.ShapeRegistry, Whiteboard.EffectRegistry, and Whiteboard.Canvas.
 *
 * @example
 * // Bundle Pattern (convenient)
 * <WhiteboardCanvas shapes={plugins} effects={effects} />
 *
 * @see Whiteboard for the Anatomy pattern
 */
export const WhiteboardCanvas: React.FC<CanvasProps> = ({ shapes, effects, ...props }) => {
	// Build the component tree based on what's provided
	let canvas = <WhiteboardCanvasInternal {...props} />;

	// Wrap with EffectRegistryProvider if effects are provided
	if (effects && effects.length > 0) {
		canvas = <EffectRegistryProvider plugins={[...effects]}>{canvas}</EffectRegistryProvider>;
	}

	// Wrap with ShapeRegistryProvider if shapes are provided
	if (shapes && shapes.length > 0) {
		canvas = <ShapeRegistryProvider plugins={shapes}>{canvas}</ShapeRegistryProvider>;
	}

	return canvas;
};
