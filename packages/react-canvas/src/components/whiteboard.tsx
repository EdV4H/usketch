import { EffectRegistryProvider, type EffectRegistryProviderProps } from "@usketch/effect-registry";
import { ShapeRegistryProvider, type ShapeRegistryProviderProps } from "@usketch/shape-registry";
import type React from "react";
import type { PropsWithChildren } from "react";
import type { CanvasProps } from "../types";
import { WhiteboardCanvasInternal } from "./whiteboard-canvas-internal";

/**
 * Whiteboard Root Component
 *
 * Base container for the Whiteboard component tree.
 * This is the top-level component when using the Anatomy pattern.
 */
export interface WhiteboardRootProps extends PropsWithChildren {
	className?: string;
}

export const WhiteboardRoot: React.FC<WhiteboardRootProps> = ({ children, className }) => {
	return <div className={className}>{children}</div>;
};

/**
 * Whiteboard ShapeRegistry Component
 *
 * Wrapper for ShapeRegistryProvider to fit the Anatomy pattern.
 */
export type WhiteboardShapeRegistryProps = ShapeRegistryProviderProps;

export const WhiteboardShapeRegistry: React.FC<WhiteboardShapeRegistryProps> = (props) => {
	return <ShapeRegistryProvider {...props} />;
};

/**
 * Whiteboard EffectRegistry Component
 *
 * Wrapper for EffectRegistryProvider to fit the Anatomy pattern.
 */
export type WhiteboardEffectRegistryProps = EffectRegistryProviderProps;

export const WhiteboardEffectRegistry: React.FC<WhiteboardEffectRegistryProps> = (props) => {
	return <EffectRegistryProvider {...props} />;
};

/**
 * Whiteboard Canvas Component
 *
 * The core canvas component without any provider wrappers.
 * Use this with the Anatomy pattern for maximum flexibility.
 */
export type WhiteboardCanvasProps = Omit<CanvasProps, "shapes" | "effects">;

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = (props) => {
	return <WhiteboardCanvasInternal {...props} />;
};

/**
 * Whiteboard Compound Component
 *
 * Main export with Anatomy pattern support.
 *
 * @example
 * // Anatomy Pattern (flexible)
 * <Whiteboard.Root>
 *   <Whiteboard.ShapeRegistry plugins={plugins}>
 *     <Whiteboard.EffectRegistry plugins={effects}>
 *       <Whiteboard.Canvas />
 *     </Whiteboard.EffectRegistry>
 *   </Whiteboard.ShapeRegistry>
 * </Whiteboard.Root>
 */
export const Whiteboard = {
	Root: WhiteboardRoot,
	ShapeRegistry: WhiteboardShapeRegistry,
	EffectRegistry: WhiteboardEffectRegistry,
	Canvas: WhiteboardCanvas,
} as const;
