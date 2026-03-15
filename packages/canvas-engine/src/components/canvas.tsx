import type { CanvasPointerEvent } from "@edv4h/usketch-shared";
import { DEFAULT_THEME } from "@edv4h/usketch-shared";
import { useCallback, useMemo, useRef } from "react";
import { useApp } from "../context.js";
import { screenToWorld } from "../coordinate-transformer.js";
import { useStoreSubscribe } from "../hooks/use-store-subscribe.js";
import { ShapeLayer } from "./shape-layer.js";

function toCanvasEvent(
	e: React.PointerEvent,
	svgRef: React.RefObject<SVGSVGElement | null>,
	viewport: { x: number; y: number; zoom: number },
): CanvasPointerEvent {
	const rect = svgRef.current?.getBoundingClientRect();
	const screenPoint = {
		x: rect ? e.clientX - rect.left : e.clientX,
		y: rect ? e.clientY - rect.top : e.clientY,
	};
	return {
		worldPoint: screenToWorld(screenPoint, viewport),
		screenPoint,
		shiftKey: e.shiftKey,
		ctrlKey: e.ctrlKey,
		metaKey: e.metaKey,
		button: e.button,
	};
}

export function Canvas() {
	const app = useApp();
	const svgRef = useRef<SVGSVGElement | null>(null);

	const viewport = useStoreSubscribe(app.store, (s) => s.getViewport());
	const shapes = useStoreSubscribe(app.store, (s) => s.getShapes());
	const selection = useStoreSubscribe(app.store, (s) => s.getSelection());
	const activeToolId = useStoreSubscribe(app.store, (s) => s.getActiveToolId());

	const activeTool = app.tools.get(activeToolId);

	const toolCtx = useMemo(
		() => ({
			store: app.store,
			shapes: app.shapes,
			commands: app.commands,
			events: app.events,
		}),
		[app.store, app.shapes, app.commands, app.events],
	);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent) => {
			if (!svgRef.current) return;
			const canvasEvent = toCanvasEvent(e, svgRef, viewport);

			// TODO: Implement middle-click pan handler (currently no listener for canvas:pan-start)
			if (e.button === 1) {
				app.events.emit("canvas:pan-start", canvasEvent);
				return;
			}

			activeTool?.onPointerDown?.(toolCtx, canvasEvent);
			app.events.emit("canvas:pointerdown", canvasEvent);
		},
		[viewport, activeTool, toolCtx, app.events],
	);

	const handlePointerMove = useCallback(
		(e: React.PointerEvent) => {
			if (!svgRef.current) return;
			const canvasEvent = toCanvasEvent(e, svgRef, viewport);
			activeTool?.onPointerMove?.(toolCtx, canvasEvent);
			app.events.emit("canvas:pointermove", canvasEvent);
		},
		[viewport, activeTool, toolCtx, app.events],
	);

	const handlePointerUp = useCallback(
		(e: React.PointerEvent) => {
			if (!svgRef.current) return;
			const canvasEvent = toCanvasEvent(e, svgRef, viewport);
			activeTool?.onPointerUp?.(toolCtx, canvasEvent);
			app.events.emit("canvas:pointerup", canvasEvent);
		},
		[viewport, activeTool, toolCtx, app.events],
	);

	const handleWheel = useCallback(
		(e: React.WheelEvent) => {
			e.preventDefault();
			if (e.ctrlKey || e.metaKey) {
				// Zoom
				const rect = svgRef.current?.getBoundingClientRect();
				const center = {
					x: rect ? e.clientX - rect.left : e.clientX,
					y: rect ? e.clientY - rect.top : e.clientY,
				};
				const delta = e.deltaY > 0 ? 0.9 : 1.1;
				app.store.zoomTo(viewport.zoom * delta, center);
			} else {
				// Pan
				app.store.panBy(-e.deltaX, -e.deltaY);
			}
		},
		[viewport, app.store],
	);

	const renderCtx = {
		viewport,
		shapes,
		selection,
		theme: DEFAULT_THEME,
	};

	const layers = app.layers.getLayers();

	return (
		<svg
			ref={svgRef}
			style={{
				width: "100%",
				height: "100%",
				display: "block",
				background: DEFAULT_THEME.canvasBackground,
				cursor: getCursorForTool(activeToolId),
			}}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onWheel={handleWheel}
		>
			<g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
				{layers.map((layer) => {
					if (layer.id === "__shapes__") {
						return <ShapeLayer key={layer.id} ctx={renderCtx} shapeRegistry={app.shapes} />;
					}
					return <g key={layer.id}>{layer.render(renderCtx)}</g>;
				})}
			</g>
		</svg>
	);
}

function getCursorForTool(toolId: string): string {
	switch (toolId) {
		case "select":
			return "default";
		case "pan":
			return "grab";
		default:
			return "crosshair";
	}
}
