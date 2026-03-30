import type { EventBus, LayerRenderContext, ShapeRegistry } from "@edv4h/usketch-shared";
import { useEffect, useRef } from "react";
import type { GpuContext } from "./gpu-context.js";
import { createGpuRenderer, type GpuRenderer } from "./renderer.js";

export function GpuShapeLayer({
	ctx,
	shapeRegistry,
	gpuContext,
	events,
}: {
	ctx: LayerRenderContext;
	shapeRegistry: ShapeRegistry;
	gpuContext: GpuContext;
	events: EventBus;
}) {
	const rendererRef = useRef<GpuRenderer | null>(null);

	// Initialize renderer once
	if (!rendererRef.current) {
		rendererRef.current = createGpuRenderer(gpuContext);
	}

	const renderer = rendererRef.current;

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			rendererRef.current?.destroy();
			rendererRef.current = null;
		};
	}, []);

	// Render every time ctx changes (shapes, viewport, selection)
	renderer.setViewport(ctx.viewport, gpuContext.canvas.clientWidth, gpuContext.canvas.clientHeight);
	const claimedIds = renderer.render(ctx.shapes, shapeRegistry);

	// Notify DOM renderer which shapes are GPU-rendered
	events.emit("renderer:claim-shapes", { ids: claimedIds });

	return null;
}
