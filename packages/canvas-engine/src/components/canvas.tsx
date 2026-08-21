import type { CanvasPointerEvent, RenderMode, ShapeData } from "@edv4h/usketch-shared";
import { compareZIndex, DEFAULT_THEME } from "@edv4h/usketch-shared";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../context.js";
import { screenToWorld } from "../coordinate-transformer.js";
import { dispatchDropToRegistry, extractPasteContent } from "../external-content-dispatch.js";
import { gestureStep, type PointerSample } from "../gesture.js";
import { useFilterPredicate } from "../hooks/use-filter-predicate.js";
import { useInteractingListeners } from "../hooks/use-interacting.js";
import { useStoreSubscribe } from "../hooks/use-store-subscribe.js";
import { useTimeTravelShapes } from "../hooks/use-time-travel.js";

/**
 * Effectively hidden = the shape's own `hidden` flag OR any ancestor's (hiding a
 * group/frame hides its subtree). Resolved locally against the shape map being
 * rendered. Mirrors `isEffectivelyHidden` in @edv4h/usketch-store (kept
 * dependency-free here since canvas-engine doesn't depend on the store).
 *
 * Memoized via the caller-provided `cache` (one per filtering pass) so siblings
 * reuse a parent's result — O(n) instead of O(n*depth) over a render pass. The
 * cache is pre-seeded to `false` before recursing, which also guards `parentId`
 * cycles.
 */
function isEffectivelyHiddenInMap(
	shapes: ReadonlyMap<string, ShapeData>,
	shape: ShapeData,
	cache: Map<string, boolean>,
): boolean {
	const cached = cache.get(shape.id);
	if (cached !== undefined) return cached;
	cache.set(shape.id, false); // cycle guard
	let result = shape.hidden === true;
	if (!result && typeof shape.parentId === "string") {
		const parent = shapes.get(shape.parentId);
		if (parent) result = isEffectivelyHiddenInMap(shapes, parent, cache);
	}
	cache.set(shape.id, result);
	return result;
}

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
		pointerId: e.pointerId,
		pointerType: e.pointerType,
	};
}

/** Two-finger touch travel (px) before a single touch is treated as a tool drag.
 *  Below this, a lone touch stays "pending" so a starting pinch never draws. */
const TOUCH_DRAG_THRESHOLD = 4;

export interface CanvasProps {
	/**
	 * Enable native touch gestures — pinch-to-zoom + two-finger pan, with tool
	 * dispatch suppressed during a gesture (#1004). Touch-only: mouse/pen/wheel
	 * behaviour is unchanged. Default `true`. Pass `false` to keep the old
	 * single-pointer touch behaviour.
	 */
	touchGestures?: boolean;
}

export function Canvas({ touchGestures = true }: CanvasProps = {}) {
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
	const hoveredShapeId = useStoreSubscribe(app.store, (s) => s.getHoveredShapeId());
	const activeToolId = useStoreSubscribe(app.store, (s) => s.getActiveToolId());

	const activeTool = app.tools.get(activeToolId);
	const [, setLayerVersion] = useState(0);
	const [renderMode, setRenderMode] = useState<RenderMode>(() => app.lod.getMode());
	// Canvas pixel size, tracked so layers can derive the visible world rect
	// (`viewportBounds`) for per-shape viewport decisions (off-screen LOD, etc.).
	const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

	// Subscribe to LOD mode changes
	useEffect(() => app.lod.onModeChange(setRenderMode), [app.lod]);

	// Measure the container and keep `canvasSize` current (initial + on resize).
	useLayoutEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const measure = () => setCanvasSize({ width: el.clientWidth, height: el.clientHeight });
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

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

	// ── Touch (multi-pointer) gesture state (#1004) ────────────────────────────
	// All touch-only; mouse/pen never touch these. Active touch pointers by id
	// (container-relative screen coords); a lone touch stays "pending" (not
	// dispatched to the tool) until it drags past the threshold or taps up, so a
	// starting pinch never draws. Two pointers → gesture mode (pinch/pan), tool
	// dispatch suppressed until every finger lifts.
	const pointersRef = useRef<Map<number, PointerSample>>(new Map());
	const pendingRef = useRef<{ id: number; downPt: PointerSample; down: CanvasPointerEvent } | null>(
		null,
	);
	const activeTouchRef = useRef<{ id: number; last: CanvasPointerEvent } | null>(null);
	const gestureRef = useRef<{
		ids: [number, number];
		prevA: PointerSample;
		prevB: PointerSample;
	} | null>(null);
	const touchSuppressRef = useRef(false);

	const screenPointOf = useCallback((e: React.PointerEvent): PointerSample => {
		const rect = containerRef.current?.getBoundingClientRect();
		return {
			x: rect ? e.clientX - rect.left : e.clientX,
			y: rect ? e.clientY - rect.top : e.clientY,
		};
	}, []);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent) => {
			// Mouse / pen (and touch when gestures are off): unchanged single-pointer path.
			if (!touchGestures || e.pointerType !== "touch") {
				const canvasEvent = toCanvasEvent(containerRef, viewport, e);
				if (e.button === 1) {
					app.events.emit("canvas:middle-down", canvasEvent);
					return;
				}
				activeTool?.onPointerDown?.(toolCtx, canvasEvent);
				app.events.emit("canvas:pointerdown", canvasEvent);
				return;
			}

			// ── Touch ──
			const pt = screenPointOf(e);
			pointersRef.current.set(e.pointerId, pt);
			try {
				e.currentTarget.setPointerCapture(e.pointerId);
			} catch {}
			const size = pointersRef.current.size;

			if (size === 2) {
				// Second finger → gesture. End any in-progress single-touch tool drag
				// (commit it), and drop a still-pending primary (never dispatched, so
				// nothing to undo) — the tool never sees the gesture.
				if (activeTouchRef.current) {
					activeTool?.onPointerUp?.(toolCtx, activeTouchRef.current.last);
					app.events.emit("canvas:pointerup", activeTouchRef.current.last);
					activeTouchRef.current = null;
				}
				pendingRef.current = null;
				const [idA, idB] = [...pointersRef.current.keys()] as [number, number];
				const a = pointersRef.current.get(idA);
				const b = pointersRef.current.get(idB);
				if (a && b) gestureRef.current = { ids: [idA, idB], prevA: a, prevB: b };
				touchSuppressRef.current = true;
				return;
			}

			if (size === 1) {
				// Defer: hold the primary until it drags (real interaction) or taps up.
				pendingRef.current = {
					id: e.pointerId,
					downPt: pt,
					down: toCanvasEvent(containerRef, viewport, e),
				};
			}
			// size > 2: extra finger, tracked for the count but otherwise ignored.
		},
		[viewport, activeTool, toolCtx, app.events, touchGestures, screenPointOf],
	);

	const handlePointerMove = useCallback(
		(e: React.PointerEvent) => {
			if (!touchGestures || e.pointerType !== "touch") {
				const canvasEvent = toCanvasEvent(containerRef, viewport, e);
				activeTool?.onPointerMove?.(toolCtx, canvasEvent);
				app.events.emit("canvas:pointermove", canvasEvent);
				return;
			}

			// ── Touch ──
			const id = e.pointerId;
			if (!pointersRef.current.has(id)) return;
			const pt = screenPointOf(e);
			pointersRef.current.set(id, pt);

			const g = gestureRef.current;
			if (g && pointersRef.current.size >= 2) {
				const curA = pointersRef.current.get(g.ids[0]);
				const curB = pointersRef.current.get(g.ids[1]);
				if (!curA || !curB) return;
				const step = gestureStep(g.prevA, g.prevB, curA, curB);
				const vp = app.store.getViewport();
				if (step.scale !== 1) {
					app.store.zoomTo(vp.zoom * step.scale, { x: step.centerX, y: step.centerY });
				}
				if (step.panX !== 0 || step.panY !== 0) app.store.panBy(step.panX, step.panY);
				g.prevA = curA;
				g.prevB = curB;
				app.events.emit("canvas:gesture", {
					scale: step.scale,
					panX: step.panX,
					panY: step.panY,
					center: { x: step.centerX, y: step.centerY },
				});
				return;
			}

			if (touchSuppressRef.current) return; // post-gesture: wait for all fingers up

			const pending = pendingRef.current;
			if (pending && pending.id === id) {
				const moved = Math.hypot(pt.x - pending.downPt.x, pt.y - pending.downPt.y);
				if (moved <= TOUCH_DRAG_THRESHOLD) return;
				// Materialize: dispatch the deferred pointerdown, then this move.
				activeTool?.onPointerDown?.(toolCtx, pending.down);
				app.events.emit("canvas:pointerdown", pending.down);
				const moveEvent = toCanvasEvent(containerRef, viewport, e);
				activeTool?.onPointerMove?.(toolCtx, moveEvent);
				app.events.emit("canvas:pointermove", moveEvent);
				activeTouchRef.current = { id, last: moveEvent };
				pendingRef.current = null;
				return;
			}

			if (activeTouchRef.current?.id === id) {
				const moveEvent = toCanvasEvent(containerRef, viewport, e);
				activeTool?.onPointerMove?.(toolCtx, moveEvent);
				app.events.emit("canvas:pointermove", moveEvent);
				activeTouchRef.current.last = moveEvent;
			}
		},
		[viewport, activeTool, toolCtx, app.events, app.store, touchGestures, screenPointOf],
	);

	const handlePointerUp = useCallback(
		(e: React.PointerEvent) => {
			if (!touchGestures || e.pointerType !== "touch") {
				const canvasEvent = toCanvasEvent(containerRef, viewport, e);
				activeTool?.onPointerUp?.(toolCtx, canvasEvent);
				app.events.emit("canvas:pointerup", canvasEvent);
				return;
			}

			// ── Touch (also handles pointercancel) ──
			const id = e.pointerId;
			const had = pointersRef.current.delete(id);
			try {
				e.currentTarget.releasePointerCapture(id);
			} catch {}
			if (!had) return;

			if (gestureRef.current) {
				if (pointersRef.current.size < 2) gestureRef.current = null;
				if (pointersRef.current.size === 0) touchSuppressRef.current = false;
				return; // gesture pointers never reach the tool
			}
			if (touchSuppressRef.current) {
				if (pointersRef.current.size === 0) touchSuppressRef.current = false;
				return;
			}

			const pending = pendingRef.current;
			if (pending && pending.id === id) {
				// Tap: never crossed the drag threshold → emit down+up so a click registers.
				activeTool?.onPointerDown?.(toolCtx, pending.down);
				app.events.emit("canvas:pointerdown", pending.down);
				const upEvent = toCanvasEvent(containerRef, viewport, e);
				activeTool?.onPointerUp?.(toolCtx, upEvent);
				app.events.emit("canvas:pointerup", upEvent);
				pendingRef.current = null;
				return;
			}
			if (activeTouchRef.current?.id === id) {
				const upEvent = toCanvasEvent(containerRef, viewport, e);
				activeTool?.onPointerUp?.(toolCtx, upEvent);
				app.events.emit("canvas:pointerup", upEvent);
				activeTouchRef.current = null;
			}
		},
		[viewport, activeTool, toolCtx, app.events, touchGestures],
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
			// ── Legacy event (kept for backward compatibility) ──
			// Plugins that listen to `canvas:drop` directly continue to work.
			// New plugins should register via `ctx.externalContent` instead.
			app.events.emit("canvas:drop", {
				files: e.dataTransfer.files,
				worldPoint: screenToWorld(screenPoint, viewport),
				screenPoint,
			});
			// ── External-content registry dispatch ──
			void dispatchDropToRegistry(e.dataTransfer, app.externalContent);
		},
		[viewport, app.events, app.externalContent],
	);

	// ── Re-render when layers change dynamically ──
	// Plugins that register/unregister layers at runtime must emit
	// "layers:changed" via ctx.events after mutation.
	// Installed via useLayoutEffect so that emissions made from the
	// selection-foreground layout effect below (which also runs synchronously
	// before paint on initial mount) are not missed.
	useLayoutEffect(() => {
		return app.events.on("layers:changed", () => setLayerVersion((v) => v + 1));
	}, [app.events]);

	// ── Selection foreground: mount the active registry entry as an internal layer ──
	// The id `__selection-foreground` is reserved; do not register a regular
	// layer with the same id from outside.
	// Uses useLayoutEffect so the layer is registered before the first paint —
	// otherwise the selection UI would be missing for one frame on initial mount.
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
				app.events.emit("layers:changed", {});
			} else if (mounted) {
				app.layers.unregister("__selection-foreground");
				mounted = false;
				app.events.emit("layers:changed", {});
			}
		};
		sync();
		const unsubscribe = app.selectionForeground.subscribe(sync);
		return () => {
			unsubscribe();
			if (mounted) {
				app.layers.unregister("__selection-foreground");
				app.events.emit("layers:changed", {});
			}
		};
	}, [app.selectionForeground, app.layers, app.events]);

	// ── External-content: document-scope paste listener ──
	// `paste` events fire on `document` (the canvas div is not focusable by
	// default), so the listener is registered there. The skip-target check and
	// payload construction run synchronously so we can call `preventDefault()`
	// before yielding — `await`ing inside this handler would let the browser
	// commit the default paste action first. The registry dispatch is
	// fire-and-forget; async handlers settle on their own.
	//
	// `stopImmediatePropagation` prevents duplicate dispatch when multiple
	// <Canvas /> instances are mounted (each registering its own
	// document-level listener) — the first canvas that claims a paste wins,
	// matching what users see for keyboard / pointer focus.
	useEffect(() => {
		const onPaste = (e: ClipboardEvent) => {
			const content = extractPasteContent(e);
			if (!content) return;
			e.preventDefault();
			e.stopImmediatePropagation();
			void app.externalContent.dispatch(content);
		};
		document.addEventListener("paste", onPaste);
		return () => document.removeEventListener("paste", onPaste);
	}, [app.externalContent]);

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

		// Safari pinch (`gesture*`) fires instead of multi-touch pointer events. Always
		// preventDefault (block the browser's own page zoom); when touch gestures are
		// enabled, translate the pinch into an app zoom about the gesture centre. `scale`
		// is cumulative from gesturestart, so we track the previous value for a per-frame
		// ratio. (Chrome/Android pinch goes through the pointer path above instead.)
		let lastGestureScale = 1;
		const onGestureStart = (e: Event) => {
			e.preventDefault();
			lastGestureScale = 1;
		};
		const onGestureChange = (e: Event) => {
			e.preventDefault();
			if (!touchGestures) return;
			const ge = e as Event & { scale?: number; clientX?: number; clientY?: number };
			const scale = typeof ge.scale === "number" && ge.scale > 0 ? ge.scale : 1;
			const factor = lastGestureScale > 0 ? scale / lastGestureScale : 1;
			lastGestureScale = scale;
			if (factor === 1) return;
			const rect = el.getBoundingClientRect();
			const center = {
				x: (ge.clientX ?? rect.left + rect.width / 2) - rect.left,
				y: (ge.clientY ?? rect.top + rect.height / 2) - rect.top,
			};
			app.store.zoomTo(app.store.getViewport().zoom * factor, center);
		};

		el.addEventListener("wheel", onWheel, { passive: false });
		el.addEventListener("gesturestart", onGestureStart);
		el.addEventListener("gesturechange", onGestureChange);

		return () => {
			el.removeEventListener("wheel", onWheel);
			el.removeEventListener("gesturestart", onGestureStart);
			el.removeEventListener("gesturechange", onGestureChange);
		};
	}, [viewport, app.events, app.store, touchGestures]);

	const filterPredicate = useFilterPredicate(app.events);
	const timeTravelShapes = useTimeTravelShapes(app.events);

	const filteredShapes = useMemo(() => {
		// Source is the time-travel snapshot when active, otherwise the live shapes.
		const source = timeTravelShapes ?? shapes;
		// The plugin feature filter is a live-only concept; don't apply it to a
		// historical snapshot.
		const applyFeatureFilter = !timeTravelShapes && filterPredicate;
		// Drop effectively-hidden shapes (self or any ancestor `hidden`) from every
		// render path (dom/engine/gpu all read this via renderCtx.shapesSorted).
		// Applied to both live and time-travel shapes since `hidden` is a core render
		// primitive. Hidden shapes remain in the store, so a layers panel reading
		// ctx.store can still list/toggle them.
		const filtered = new Map<string, ShapeData>();
		const hiddenCache = new Map<string, boolean>(); // memoize across this pass
		for (const [id, shape] of source) {
			if (applyFeatureFilter && !applyFeatureFilter(shape)) continue;
			if (isEffectivelyHiddenInMap(source, shape, hiddenCache)) continue;
			filtered.set(id, shape);
		}
		return filtered;
	}, [shapes, filterPredicate, timeTravelShapes]);

	const shapesSorted = useMemo(
		() => [...filteredShapes.values()].sort((a, b) => compareZIndex(a.zIndex, b.zIndex)),
		[filteredShapes],
	);

	// Visible region in world coords (screenToWorld of the top-left + size/zoom).
	// width/height are 0 until the container is measured — consumers treat that as
	// "unknown" and skip viewport-based decisions.
	const viewportBounds = useMemo(
		() => ({
			x: -viewport.x / viewport.zoom,
			y: -viewport.y / viewport.zoom,
			width: canvasSize.width / viewport.zoom,
			height: canvasSize.height / viewport.zoom,
		}),
		[viewport, canvasSize],
	);

	const renderCtx = {
		viewport,
		shapes: filteredShapes,
		shapesSorted,
		selection,
		hoveredShapeId,
		theme: DEFAULT_THEME,
		renderMode,
		viewportBounds,
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
			onPointerCancel={handlePointerUp}
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
