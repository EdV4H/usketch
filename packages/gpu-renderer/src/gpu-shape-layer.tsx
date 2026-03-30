import type { EventBus, LayerRenderContext, ShapeRegistry } from "@edv4h/usketch-shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { initGpuContext } from "./gpu-context.js";
import { createGpuRenderer, type GpuRenderer } from "./renderer.js";

export function GpuShapeLayer({
	ctx,
	shapeRegistry,
	events,
}: {
	ctx: LayerRenderContext;
	shapeRegistry: ShapeRegistry;
	events: EventBus;
}) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const rendererRef = useRef<GpuRenderer | null>(null);
	const initPromiseRef = useRef<Promise<void> | null>(null);
	const readyRef = useRef(false);
	const [, setTick] = useState(0);

	const initGpu = useCallback((canvas: HTMLCanvasElement | null) => {
		canvasRef.current = canvas;
		if (!canvas) return;

		if (initPromiseRef.current) return;

		initPromiseRef.current = (async () => {
			const gpuCtx = await initGpuContext(canvas);
			if (!gpuCtx) {
				console.warn("[gpu-renderer] WebGPU initialization failed, falling back to DOM");
				return;
			}
			rendererRef.current = createGpuRenderer(gpuCtx);
			readyRef.current = true;
			// Force re-render to start GPU rendering
			setTick((t) => t + 1);
		})();
	}, []);

	// Re-render on window resize so the projection matrix stays in sync
	useEffect(() => {
		const onResize = () => setTick((t) => t + 1);
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			rendererRef.current?.destroy();
			rendererRef.current = null;
			readyRef.current = false;
			initPromiseRef.current = null;
		};
	}, []);

	// Render when ready
	if (readyRef.current && rendererRef.current && canvasRef.current) {
		const renderer = rendererRef.current;
		const canvas = canvasRef.current;
		renderer.setViewport(ctx.viewport, canvas.clientWidth, canvas.clientHeight);
		const claimedIds = renderer.render(ctx.shapes, shapeRegistry);
		if (claimedIds.size > 0) {
			events.emit("renderer:claim-shapes", { ids: claimedIds });
		}
	}

	return (
		<canvas
			ref={initGpu}
			style={{
				position: "absolute",
				inset: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
			}}
		/>
	);
}
