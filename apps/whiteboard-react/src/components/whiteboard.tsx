import { Canvas } from "@usketch/canvas-core";
import { whiteboardStore } from "@usketch/store";
import type React from "react";
import { useEffect, useRef } from "react";

export const Whiteboard: React.FC = () => {
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<Canvas | null>(null);
	const shapesAddedRef = useRef(false);

	useEffect(() => {
		if (!containerRef.current) return;

		// Initialize canvas
		canvasRef.current = new Canvas(containerRef.current);

		// Expose store and canvas for debugging
		if (import.meta.env.DEV) {
			(window as any).__whiteboardStore = whiteboardStore;
			(window as any).__canvas = canvasRef.current;
		}

		// Add test shapes only once (protect against StrictMode double render)
		if (!shapesAddedRef.current) {
			shapesAddedRef.current = true;

			// Add some test shapes for demonstration (matching vanilla version)
			setTimeout(() => {
				canvasRef.current?.addTestShape();
			}, 100);

			// Add another test shape
			setTimeout(() => {
				const testShape2 = {
					id: `test-ellipse-${Date.now()}`,
					type: "ellipse" as const,
					x: 350,
					y: 200,
					width: 150,
					height: 100,
					rotation: 0,
					opacity: 1,
					strokeColor: "#d63384",
					fillColor: "#ffe0e6",
					strokeWidth: 3,
				};
				whiteboardStore.getState().addShape(testShape2);
			}, 200);
		}

		// Cleanup on unmount
		return () => {
			if (canvasRef.current) {
				canvasRef.current.destroy();
				canvasRef.current = null;
			}
		};
	}, []);

	return (
		<div className="whiteboard-container">
			<div
				ref={containerRef}
				style={{
					width: "100%",
					height: "100%",
					position: "relative",
				}}
			>
				<div className="grid-background" />
			</div>
		</div>
	);
};
