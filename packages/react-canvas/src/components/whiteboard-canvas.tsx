import { EffectRegistryProvider } from "@usketch/effect-registry";
import { ShapeRegistryProvider } from "@usketch/shape-registry";
import { useWhiteboardStore } from "@usketch/store";
import type React from "react";
import { useEffect, useRef } from "react";
import { useCanvas } from "../hooks/use-canvas";
import { useInteraction } from "../hooks/use-interaction";
import { useKeyboardShortcuts } from "../hooks/use-keyboard-shortcuts";
import { EffectLayer } from "../layers/effect-layer";
import type { CanvasProps } from "../types";
import { BackgroundLayer } from "./background-layer";
import { InteractionLayer } from "./interaction-layer";
import { SelectionLayer } from "./selection-layer";
import { ShapeLayer } from "./shape-layer";

// Internal canvas component that uses the registry
const WhiteboardCanvasInternal: React.FC<Omit<CanvasProps, "shapes" | "effects">> = ({
	className = "",
	background,
	onReady,
}) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const { shapes, camera, selectedShapeIds } = useWhiteboardStore();
	const canvasManager = useCanvas();
	const interactions = useInteraction();

	useKeyboardShortcuts();

	useEffect(() => {
		if (onReady && canvasManager) {
			onReady(canvasManager);
		}
	}, [onReady, canvasManager]);

	return (
		<div
			ref={containerRef}
			className={`whiteboard-canvas ${className}`.trim()}
			style={{
				position: "relative",
				width: "100%",
				height: "100%",
				overflow: "hidden",
				cursor: interactions.cursor,
			}}
			{...interactions.getCanvasProps()}
		>
			<BackgroundLayer camera={camera} options={background} />
			<ShapeLayer shapes={shapes} camera={camera} activeTool={interactions.activeTool} />
			<SelectionLayer selectedIds={selectedShapeIds} shapes={shapes} camera={camera} />
			<InteractionLayer camera={camera} activeTool={interactions.activeTool} />
			<EffectLayer className="effect-layer" />
		</div>
	);
};

// Public component that optionally sets up ShapeRegistryProvider and EffectRegistryProvider
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
