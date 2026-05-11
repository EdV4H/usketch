import type { CanvasPointerEvent, RenderMode } from "@edv4h/usketch-shared";
import { compareZIndex, DEFAULT_THEME } from "@edv4h/usketch-shared";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../context.js";
import { screenToWorld } from "../coordinate-transformer.js";
import { useFilterPredicate } from "../hooks/use-filter-predicate.js";
import { useInteractingListeners } from "../hooks/use-interacting.js";
import { useStoreSubscribe } from "../hooks/use-store-subscribe.js";
import { useTimeTravelShapes } from "../hooks/use-time-travel.js";

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

	// Keep interacting-state listeners alive at all times so that overlays
	// mounted *during* a drag (direct-drag on unselected shape) still see
	// the correct interacting flag via the shared module-scoped store.
	// Uses the listener-only variant to avoid unnecessary re-renders.
	useInteractingListeners(app.events);

	const viewport = useStoreSubscribe(app.store, (s) => s.getViewport());
	const shapes = useStoreSubscribe(app.store, (s) => s.getShapes());
	const selection = useStoreSubscribe(app.store, (s) => s.getSelection());
	const activeToolId = useStoreSubscribe(app.store, (s) => s.getActiveToolId());

	const activeTool = app.tools.get(activeToolId);
	const [, setLayerVersion] = useState(0);
	const [renderMode, setRenderMode] = useState<RenderMode>(() => app.lod.getMode());

	// Subscribe to LOD mode changes
	useEffect(() => app.lod.onModeChange(setRenderMode), [app.lod]);

	// rAF loop: measure smoothed FPS and tick the LOD controller every frame.
	// FPS is the closest available proxy for CPU/GPU load in the browser.
	useEffect(() => {
		let rafId = 0;
		let lastTs = performance.now();
		let smoothedFps = 60;
		const ALPHA = 0.1; // EMA smoothing factor (~30 frame window)
		const tick = (now: number) => {
			const dt = now - lastTs;
			lastTs = now;
			if (dt > 0) {
				const instantFps = 1000 / dt;
				smoothedFps = smoothedFps * (1 - ALPHA) + instantFps * ALPHA;
			}
			app.lod.tick({
				viewport: app.store.getViewport(),
				shapeCount: app.store.getShapes().size,
				fps: smoothedFps,
				currentMode: app.lod.getMode(),
			});
			rafId = requestAnimationFrame(tick);
		};
		rafId = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(rafId);
	}, [app.lod, app.store]);

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

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "copy";
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			const rect = containerRef.current?.getBoundingClientRect();
			const screenPoint = {
				x: rect ? e.clientX - rect.left : e.clientX,
				y: rect ? e.clientY - rect.top : e.clientY,
			};
			app.events.emit("canvas:drop", {
				files: e.dataTransfer.files,
				worldPoint: screenToWorld(screenPoint, viewport),
				screenPoint,
			});
		},
		[viewport, app.events],
	);

	// ── Re-render when layers change dynamically ──
	// Plugins that register/unregister layers at runtime must emit
	// "layers:changed" via ctx.events after mutation.
	useEffect(() => {
		return app.events.on("layers:changed", () => setLayerVersion((v) => v + 1));
	}, [app.events]);

	// ── Selection foreground: mount the active registry entry as an internal layer ──
	// The id `__selection-foreground` is reserved; do not register a regular
	// layer with the same id from outside.
	// Uses useLayoutEffect so the layer is registered before the first paint —
	// otherwise the selection UI would be missing for one frame on initial mount.
	// Drives the Canvas re-render directly via `setLayerVersion` (not via
	// `layers:changed`) because the event listener is installed in a passive
	// `useEffect` that runs after this layout effect — the very first
	// emission from `sync()` would otherwise be missed. The event is still
	// emitted for external listeners that rely on it.
	useLayoutEffect(() => {
		let mounted = false;
		const sync = () => {
			const active = app.selectionForeground.getActive();
			if (active) {
				app.layers.register({
					id: "__selection-foreground",
					order: active.order ?? 80,
					fixed: active.fixed ?? true,
					render: active.render,
				});
				mounted = true;
				setLayerVersion((v) => v + 1);
				app.events.emit("layers:changed", {});
			} else if (mounted) {
				app.layers.unregister("__selection-foreground");
				mounted = false;
				setLayerVersion((v) => v + 1);
				app.events.emit("layers:changed", {});
			}
		};
		sync();
		const unsubscribe = app.selectionForeground.subscribe(sync);
		return () => {
			unsubscribe();
			if (mounted) {
				app.layers.unregister("__selection-foreground");
				setLayerVersion((v) => v + 1);
				app.events.emit("layers:changed", {});
			}
		};
	}, [app.selectionForeground, app.layers, app.events]);

	// ── Tool activate / deactivate lifecycle ──
	const prevToolIdRef = useRef<string | null>(null);
	const activeToolRef = useRef(activeTool);
	activeToolRef.current = activeTool;
	const toolCtxRef = useRef(toolCtx);
	toolCtxRef.current = toolCtx;

	useEffect(() => {
		const prevId = prevToolIdRef.current;
		prevToolIdRef.current = activeToolId;

		if (prevId && prevId !== activeToolId) {
			const prevTool = app.tools.get(prevId);
			prevTool?.onDeactivate?.(toolCtx);
		}
		if (activeToolId && activeToolId !== prevId) {
			activeTool?.onActivate?.(toolCtx);
		}
		// Bump layer version so dynamically registered layers are picked up
		setLayerVersion((v) => v + 1);
	}, [activeToolId, activeTool, toolCtx, app.tools]);

	// Ensure onDeactivate is called once when Canvas unmounts
	useEffect(
		() => () => {
			activeToolRef.current?.onDeactivate?.(toolCtxRef.current);
		},
		[],
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

	const filterPredicate = useFilterPredicate(app.events);
	const timeTravelShapes = useTimeTravelShapes(app.events);

	const filteredShapes = useMemo(() => {
		// Time-travel mode: override with snapshot shapes
		if (timeTravelShapes) return timeTravelShapes;
		if (!filterPredicate) return shapes;
		const filtered = new Map<string, import("@edv4h/usketch-shared").ShapeData>();
		for (const [id, shape] of shapes) {
			if (filterPredicate(shape)) {
				filtered.set(id, shape);
			}
		}
		return filtered;
	}, [shapes, filterPredicate, timeTravelShapes]);

	const shapesSorted = useMemo(
		() => [...filteredShapes.values()].sort((a, b) => compareZIndex(a.zIndex, b.zIndex)),
		[filteredShapes],
	);

	const renderCtx = {
		viewport,
		shapes: filteredShapes,
		shapesSorted,
		selection,
		theme: DEFAULT_THEME,
		renderMode,
	};

	const layers = app.layers.getLayers();
	const viewportTransform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`;

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: Canvas is the interactive drawing surface
		<div
			ref={containerRef}
			style={{
				position: "relative",
				width: "100%",
				height: "100%",
				overflow: "hidden",
				// `data-theme` による CSS 変数がある場合はそちらが効き、無い場合は従来の既定色にフォールバック
				background: `var(--bg-canvas, ${DEFAULT_THEME.canvasBackground})`,
				cursor: activeTool?.cursor ?? "default",
				touchAction: "none",
			}}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onDragOver={handleDragOver}
			onDrop={handleDrop}
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
