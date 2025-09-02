import { GridRenderer } from "@usketch/backgrounds";
import { Canvas } from "@usketch/canvas-core";
import { whiteboardStore } from "@usketch/store";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export interface WhiteboardRef {
	setBackground: (background: { renderer: any; config?: any }) => void;
}

export const Whiteboard = forwardRef<WhiteboardRef>((_, ref) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<Canvas | null>(null);
	const shapesAddedRef = useRef(false);

	useImperativeHandle(ref, () => ({
		setBackground: (background: { renderer: any; config?: any }) => {
			if (canvasRef.current) {
				canvasRef.current.setBackground(background);
			}
		},
	}));

	useEffect(() => {
		if (!containerRef.current) return;

		// Initialize canvas with grid background
		canvasRef.current = new Canvas(containerRef.current, {
			background: {
				renderer: new GridRenderer(),
				config: {
					size: 20,
					color: "#e0e0e0",
					thickness: 1,
				},
			},
		});

		// Expose store and canvas for debugging
		if (import.meta.env.DEV) {
			(window as any).__whiteboardStore = whiteboardStore;
			(window as any).__canvas = canvasRef.current;
		}

		// Add test shapes only once (protect against StrictMode double render)
		// Skip demo shapes if running E2E tests (when URL has ?e2e=true)
		const isE2E = new URLSearchParams(window.location.search).has("e2e");

		if (!shapesAddedRef.current && !isE2E) {
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
			/>
		</div>
	);
});
