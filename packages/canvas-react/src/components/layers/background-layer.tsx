import type { BackgroundOptions } from "@usketch/backgrounds";
import type { Camera } from "@usketch/shared-types";
import type React from "react";
import { useEffect, useRef } from "react";

interface BackgroundLayerProps {
	background: BackgroundOptions | null;
	camera: Camera;
}

export const BackgroundLayer: React.FC<BackgroundLayerProps> = ({ background, camera }) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const rendererRef = useRef<any>(null);

	useEffect(() => {
		if (!containerRef.current || !background) return;

		// Clean up previous renderer
		if (rendererRef.current?.cleanup) {
			rendererRef.current.cleanup(containerRef.current);
		}

		// Set new renderer
		rendererRef.current = background.renderer;

		// Render background
		if (background.renderer.render) {
			background.renderer.render(containerRef.current, camera, background.config);
		}

		return () => {
			if (rendererRef.current?.cleanup && containerRef.current) {
				rendererRef.current.cleanup(containerRef.current);
			}
		};
	}, [background, camera]);

	// Update on camera change
	useEffect(() => {
		if (!containerRef.current || !background || !rendererRef.current) return;

		if (rendererRef.current.render) {
			rendererRef.current.render(containerRef.current, camera, background.config);
		}
	}, [camera, background]);

	return (
		<div
			ref={containerRef}
			className="background-layer"
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
			}}
		/>
	);
};
