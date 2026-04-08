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

	const eventsRef = useRef(events);
	eventsRef.current = events;

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
			gpuCtx.onDeviceLost((reason) => {
				console.warn(`[gpu-renderer] Device lost (${reason}), falling back to DOM`);
				rendererRef.current?.destroy();
				rendererRef.current = null;
				readyRef.current = false;
				initPromiseRef.current = null;
				eventsRef.current.emit("renderer:claim-shapes", { ids: new Set<string>() });
				setTick((t) => t + 1);
			});
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

			// Iterate GPU-claimed shapes in z-order (ascending = back to front).
			// Later (frontmost) hits override earlier ones.
			for (const shape of ctx.shapesSorted) {
				if (!claimedIdsRef.current.has(shape.id)) continue;
				if (
					wp.x >= shape.x &&
					wp.x <= shape.x + shape.width &&
					wp.y >= shape.y &&
					wp.y <= shape.y + shape.height
				) {
					found = shape.id;
					// Don't break — later shapes are on top (higher z)
				}
			}

			if (found !== hoveredIdRef.current) {
				hoveredIdRef.current = found;
				setTick((t) => t + 1);
			}
		});
		return unsub;
	}, [events, ctx.shapesSorted]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			rendererRef.current?.destroy();
			rendererRef.current = null;
			readyRef.current = false;
			initPromiseRef.current = null;
		};
	}, []);

	// LOD: GPU is OFF in interactive mode. Release any prior claims so DOM
	// resumes full rendering of those shapes, then render nothing.
	const gpuActive = ctx.renderMode !== "interactive";
	if (!gpuActive) {
		if (claimedIdsRef.current.size > 0) {
			claimedIdsRef.current = new Set();
			events.emit("renderer:claim-shapes", { ids: claimedIdsRef.current });
		}
		return null;
	}

	// Render when ready
	if (readyRef.current && rendererRef.current && canvasRef.current) {
		const renderer = rendererRef.current;
		const canvas = canvasRef.current;
		renderer.setViewport(ctx.viewport, canvas.clientWidth, canvas.clientHeight);
		const { claimedIds, stats } = renderer.render(ctx.shapesSorted, shapeRegistry, {
			selection: ctx.selection,
			hoveredId: hoveredIdRef.current,
		});
		claimedIdsRef.current = claimedIds;
		if (claimedIds.size > 0) {
			events.emit("renderer:claim-shapes", { ids: claimedIds });
		}
		events.emit("gpu-renderer:stats", stats);
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
