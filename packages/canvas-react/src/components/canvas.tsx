import { DotsRenderer } from "@usketch/backgrounds";
import type { CanvasManager } from "@usketch/canvas-core";
import { whiteboardStore } from "@usketch/store";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useCanvas } from "../hooks/use-canvas";

export interface CanvasProps {
	background?: {
		renderer: any;
		config?: any;
	};
	onReady?: (manager: CanvasManager) => void;
}

export interface CanvasRef {
	setBackground: (background: { renderer: any; config?: any }) => void;
	getManager: () => CanvasManager | null;
}

/**
 * React Canvas component using the new architecture
 * This component uses ReactRenderer instead of DOM manipulation
 */
export const Canvas = forwardRef<CanvasRef, CanvasProps>(({ background, onReady }, ref) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasManager = useCanvas(containerRef, {
		background: background || {
			renderer: new DotsRenderer(),
			config: {
				spacing: 20,
				size: 2,
				color: "#d0d0d0",
			},
		},
	});

	useImperativeHandle(ref, () => ({
		setBackground: (bg: { renderer: any; config?: any }) => {
			if (canvasManager) {
				canvasManager.setBackground(bg);
			}
		},
		getManager: () => canvasManager,
	}));

	useEffect(() => {
		if (canvasManager && onReady) {
			onReady(canvasManager);

			// Expose for debugging
			if (typeof window !== "undefined") {
				(window as any).__whiteboardStore = whiteboardStore;
				(window as any).__canvasManager = canvasManager;
			}
		}
	}, [canvasManager, onReady]);

	return (
		<div
			ref={containerRef}
			style={{
				width: "100%",
				height: "100%",
				position: "relative",
			}}
		/>
	);
});
