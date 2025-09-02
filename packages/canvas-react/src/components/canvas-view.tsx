import type { BackgroundOptions } from "@usketch/backgrounds";
import type { Camera, Shape } from "@usketch/shared-types";
import type React from "react";
import { useEffect, useRef } from "react";
import { BackgroundLayer } from "./layers/background-layer";
import { PreviewLayer } from "./layers/preview-layer";
import { SelectionLayer } from "./layers/selection-layer";
import { ShapeLayer } from "./layers/shape-layer";

interface CanvasViewProps {
	shapes: Shape[];
	camera: Camera;
	selectedShapes: Shape[];
	previewShape: Shape | null;
	background: BackgroundOptions | null;
	onPointerDown?: (event: React.PointerEvent) => void;
	onPointerMove?: (event: React.PointerEvent) => void;
	onPointerUp?: (event: React.PointerEvent) => void;
	onWheel?: (event: React.WheelEvent) => void;
}

export const CanvasView: React.FC<CanvasViewProps> = ({
	shapes,
	camera,
	selectedShapes,
	previewShape,
	background,
	onPointerDown,
	onPointerMove,
	onPointerUp,
	onWheel,
}) => {
	const containerRef = useRef<HTMLDivElement>(null);

	// Handle keyboard events globally
	useEffect(() => {
		const handleKeyDown = (_e: KeyboardEvent) => {
			// This will be handled by CanvasManager
		};

		const handleKeyUp = (_e: KeyboardEvent) => {
			// This will be handled by CanvasManager
		};

		document.addEventListener("keydown", handleKeyDown);
		document.addEventListener("keyup", handleKeyUp);

		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			document.removeEventListener("keyup", handleKeyUp);
		};
	}, []);

	return (
		<div
			ref={containerRef}
			className="canvas-view"
			role="application"
			aria-label="Canvas drawing area"
			style={{
				position: "relative",
				width: "100%",
				height: "100%",
				overflow: "hidden",
				cursor: "default",
			}}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onWheel={onWheel}
			onContextMenu={(e) => e.preventDefault()}
		>
			<BackgroundLayer background={background} camera={camera} />
			<ShapeLayer shapes={shapes} camera={camera} />
			<PreviewLayer shape={previewShape} camera={camera} />
			<SelectionLayer shapes={selectedShapes} camera={camera} />
		</div>
	);
};
