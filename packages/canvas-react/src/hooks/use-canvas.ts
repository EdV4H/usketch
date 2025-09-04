import { CanvasManager } from "@usketch/canvas-core";
import { type RefObject, useEffect, useRef, useState } from "react";
import { ReactRenderer } from "../renderers/react-renderer";

export interface UseCanvasOptions {
	background?: {
		renderer: any;
		config?: any;
	};
}

export const useCanvas = (containerRef: RefObject<HTMLDivElement>, options?: UseCanvasOptions) => {
	const [canvasManager, setCanvasManager] = useState<CanvasManager | null>(null);
	const rendererRef = useRef<ReactRenderer | null>(null);

	useEffect(() => {
		if (!containerRef.current) return;

		// Create React renderer
		rendererRef.current = new ReactRenderer();

		// Create canvas manager with React renderer
		const manager = new CanvasManager(rendererRef.current, containerRef.current);

		// Set initial background if provided
		if (options?.background) {
			manager.setBackground(options.background);
		}

		setCanvasManager(manager);

		// Cleanup
		return () => {
			manager.destroy();
			rendererRef.current = null;
			setCanvasManager(null);
		};
	}, [containerRef.current, options?.background]); // Only run once on mount

	return canvasManager;
};
