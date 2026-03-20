import type { CanvasPointerEvent } from "@edv4h/usketch-shared";
import { DEFAULT_THEME } from "@edv4h/usketch-shared";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useApp } from "../context.js";
import { screenToWorld } from "../coordinate-transformer.js";
import { useStoreSubscribe } from "../hooks/use-store-subscribe.js";

function toCanvasEvent(
	containerRef: React.RefObject<HTMLDivElement | null>,
	viewport: { x: number; y: number; zoom: number },
	e: React.PointerEvent,
): CanvasPointerEvent {
	const rect = containerRef.current?.getBoundingClientRect();
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
		altKey: e.altKey,
		button: e.button,
	};
}

export function Canvas() {
	const app = useApp();
	const containerRef = useRef<HTMLDivElement | null>(null);

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
			const canvasEvent = toCanvasEvent(containerRef, viewport, e);

			if (e.button === 1) {
				app.events.emit("canvas:middle-down", canvasEvent);
				return;
			}

			activeTool?.onPointerDown?.(toolCtx, canvasEvent);
			app.events.emit("canvas:pointerdown", canvasEvent);
		},
		[viewport, activeTool, toolCtx, app.events],
	);

	const handlePointerMove = useCallback(
		(e: React.PointerEvent) => {
			const canvasEvent = toCanvasEvent(containerRef, viewport, e);
			activeTool?.onPointerMove?.(toolCtx, canvasEvent);
			app.events.emit("canvas:pointermove", canvasEvent);
		},
		[viewport, activeTool, toolCtx, app.events],
	);

	const handlePointerUp = useCallback(
		(e: React.PointerEvent) => {
			const canvasEvent = toCanvasEvent(containerRef, viewport, e);
			activeTool?.onPointerUp?.(toolCtx, canvasEvent);
			app.events.emit("canvas:pointerup", canvasEvent);
		},
		[viewport, activeTool, toolCtx, app.events],
	);

	// Native non-passive wheel listener to reliably prevent browser zoom
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			const rect = el.getBoundingClientRect();
			const screenPoint = {
				x: e.clientX - rect.left,
				y: e.clientY - rect.top,
			};
			app.events.emit("canvas:wheel", {
				screenPoint,
				worldPoint: screenToWorld(screenPoint, viewport),
				deltaX: e.deltaX,
				deltaY: e.deltaY,
				ctrlKey: e.ctrlKey,
				metaKey: e.metaKey,
				shiftKey: e.shiftKey,
			});
		};

		// Prevent Safari gesture zoom (pinch)
		const onGesture = (e: Event) => e.preventDefault();

		el.addEventListener("wheel", onWheel, { passive: false });
		el.addEventListener("gesturestart", onGesture);
		el.addEventListener("gesturechange", onGesture);

		return () => {
			el.removeEventListener("wheel", onWheel);
			el.removeEventListener("gesturestart", onGesture);
			el.removeEventListener("gesturechange", onGesture);
		};
	}, [viewport, app.events]);

	const renderCtx = {
		viewport,
		shapes,
		selection,
		theme: DEFAULT_THEME,
	};

	const layers = app.layers.getLayers();
	const viewportTransform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`;

	return (
		<div
			ref={containerRef}
			style={{
				position: "relative",
				width: "100%",
				height: "100%",
				overflow: "hidden",
				background: DEFAULT_THEME.canvasBackground,
				cursor: activeTool?.cursor ?? "default",
				touchAction: "none",
			}}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
		>
			{layers.map((layer) => {
				if (layer.fixed) {
					return (
						<div
							key={layer.id}
							data-layer-id={layer.id}
							style={{
								position: "absolute",
								inset: 0,
								pointerEvents: "none",
							}}
						>
							<div style={{ pointerEvents: "auto" }}>{layer.render(renderCtx)}</div>
						</div>
					);
				}

				return (
					<div
						key={layer.id}
						data-layer-id={layer.id}
						style={{
							position: "absolute",
							inset: 0,
							pointerEvents: "none",
							overflow: "hidden",
						}}
					>
						<div
							style={{
								transformOrigin: "0 0",
								transform: viewportTransform,
							}}
						>
							<div style={{ pointerEvents: "auto" }}>{layer.render(renderCtx)}</div>
						</div>
					</div>
				);
			})}
		</div>
	);
}
