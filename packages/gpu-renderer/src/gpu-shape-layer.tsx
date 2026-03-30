import type {
	CanvasPointerEvent,
	EventBus,
	LayerRenderContext,
	ShapeRegistry,
} from "@edv4h/usketch-shared";
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
	const hoveredIdRef = useRef<string | null>(null);
	const claimedIdsRef = useRef<Set<string>>(new Set());

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
			setTick((t) => t + 1);
		})();
	}, []);

	// Re-render on window resize
	useEffect(() => {
		const onResize = () => setTick((t) => t + 1);
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);

	// Hover detection via canvas:pointermove
	useEffect(() => {
		const unsub = events.on<CanvasPointerEvent>("canvas:pointermove", (e) => {
			if (!readyRef.current) return;
			const wp = e.worldPoint;
			let found: string | null = null;

			// Check GPU-claimed shapes for AABB hit
			for (const id of claimedIdsRef.current) {
				const shape = ctx.shapes.get(id);
				if (!shape) continue;
				if (
					wp.x >= shape.x &&
					wp.x <= shape.x + shape.width &&
					wp.y >= shape.y &&
					wp.y <= shape.y + shape.height
				) {
					found = id;
					// Don't break — later shapes are on top (higher z)
				}
			}

			if (found !== hoveredIdRef.current) {
				hoveredIdRef.current = found;
				setTick((t) => t + 1);
			}
		});
		return unsub;
	}, [events, ctx.shapes]);

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
		const claimedIds = renderer.render(ctx.shapes, shapeRegistry, {
			selection: ctx.selection,
			hoveredId: hoveredIdRef.current,
		});
		claimedIdsRef.current = claimedIds;
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
