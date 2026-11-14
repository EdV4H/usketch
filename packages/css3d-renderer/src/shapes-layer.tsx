// The 3D shape layer: draws the shapes that rise out of the ground while the board is
// shown in 3D. It is a depth layer, so the `translateZ` / `rotateX` below rise out of the
// tilted ground instead of being flattened onto it. The DOM shape layer skips the same
// shapes meanwhile (they are claimed through the board's shape claims).
import { ShapeContent } from "@edv4h/usketch-dom-renderer";
import {
	type LayerRenderContext,
	occludedStyle,
	type ShapeData,
	type ShapeDefinition,
	type ShapeRegistry,
	type ShapeView3d,
	type View3dCamera,
	type View3dOcclusionApi,
	type View3dTracker,
	type Viewport,
} from "@edv4h/usketch-shared";
import { memo, type ReactElement, useEffect, useRef, useSyncExternalStore } from "react";
import {
	boxTopTransform,
	boxWalls,
	type Css3dShapeLimits,
	type Css3dShapeTypes,
	poseBox,
	poseOrigin,
	poseTransform,
	render3dFrame,
	type ShapePose,
	selectShapes3d,
	shadowStyle,
	shapeAnchor,
	shapePose,
	wallColor,
	wallShade,
} from "./shapes-layout.js";

/** The layer's id (the shape-3d plugin's, so a 3D view's layer lists keep naming it). */
export const SHAPE_3D_LAYER_ID = "shape-3d";

/**
 * The shape's own drawing at its world size, scaled to the node's px box (re-rendered
 * only when the shape or the zoom changes, not as the camera moves). No opacity here:
 * the renderers apply `style.opacity` themselves, as on the flat DOM layer.
 */
const StandContent = memo(function StandContent({
	shape,
	def,
	zoom,
}: {
	shape: ShapeData;
	def: ShapeDefinition;
	zoom: number;
}) {
	return (
		<div
			style={{
				position: "absolute",
				left: 0,
				top: 0,
				width: shape.width,
				height: shape.height,
				transform: `scale(${zoom})`,
				transformOrigin: "0 0",
			}}
		>
			<ShapeContent shape={shape} def={def} />
		</div>
	);
});

export interface Css3dShapesLayerProps {
	rc: LayerRenderContext;
	shapes: ShapeRegistry;
	tracker: View3dTracker;
	types: Css3dShapeTypes;
	limits: Css3dShapeLimits;
	/** Screen px the 3D view shows past the board box. */
	overscanPx: number;
	/** Ground height at a world point (world units). */
	heightAt: (x: number, y: number) => number;
	/** Told which shapes this layer draws after each render (the DOM layer hides them). */
	onDrawn: (ids: ReadonlySet<string>) => void;
	/** The 3D view's camera, for a type's own `render3d`. */
	camera?: Css3dCameraSource;
	/** What the ground hides: a shape whose top is hidden fades (or isn't drawn). */
	occlusion?: View3dOcclusionApi | null;
	/** Changes to what the ground hides (a counter), to re-render on. */
	occlusionChanges?: Css3dChangeSource;
}

/** A counter that moves on every change of something, and its notifications. */
export interface Css3dChangeSource {
	get(): number;
	subscribe(listener: () => void): () => void;
}

const NO_CHANGES: Css3dChangeSource = { get: () => 0, subscribe: () => () => {} };

/**
 * Answers for "is this shape behind the ground", spread over frames: a follow camera
 * re-renders the layer every frame, and asking for every shape each time costs too much
 * (each answer walks the ground along the line of sight). An answer is reused for
 * `maxAgeMs`, and at most `budget` are asked per frame (the stalest first come due as
 * they age); a shape not asked yet counts as in view.
 */
export interface OcclusionCache {
	/** Start a frame at `now` (ms): the budget refills. */
	frame(now: number): void;
	/** The answer for `id` at this place, asking `ask` when due and within the budget. */
	get(id: string, key: string, ask: () => boolean): boolean;
	/** Forget everything (the setting or the provider changed). */
	clear(): void;
}

export function createOcclusionCache(maxAgeMs = 100, budget = 40): OcclusionCache {
	const answers = new Map<string, { key: string; hidden: boolean; at: number }>();
	let now = 0;
	let left = budget;
	return {
		frame(t) {
			now = t;
			left = budget;
		},
		get(id, key, ask) {
			const old = answers.get(id);
			const fresh = old && old.key === key && now - old.at < maxAgeMs;
			if (fresh || left <= 0) return old?.hidden ?? false;
			left--;
			const hidden = ask();
			answers.set(id, { key, hidden, at: now });
			return hidden;
		},
		clear() {
			answers.clear();
		},
	};
}

/** How high a shape's top is above its ground (world units) in its 3D mode. Pure. */
export function shapeTop3d(shape: ShapeData, params: ShapeView3d): number {
	return params.mode === "stand" ? shape.height : params.height;
}

/** The drawn camera and its change notifications (see `ShapeView3dRenderContext`). */
export interface Css3dCameraSource {
	get(): View3dCamera | null;
	subscribe(listener: () => void): () => void;
}

const NO_CAMERA: Css3dCameraSource = { get: () => null, subscribe: () => () => {} };

export function Css3dShapesLayer({
	rc,
	shapes,
	tracker,
	types,
	limits,
	overscanPx,
	heightAt,
	onDrawn,
	camera = NO_CAMERA,
	occlusion = null,
	occlusionChanges = NO_CHANGES,
}: Css3dShapesLayerProps) {
	const view = useSyncExternalStore(tracker.subscribe, tracker.get, tracker.get);
	// Re-render when what the ground hides may change without the viewport moving.
	useSyncExternalStore(occlusionChanges.subscribe, occlusionChanges.get, occlusionChanges.get);
	const cacheRef = useRef<{ cache: OcclusionCache; look: string; api: unknown } | null>(null);
	const look = occlusion?.look() ?? "fade";
	if (!cacheRef.current || cacheRef.current.look !== look || cacheRef.current.api !== occlusion) {
		cacheRef.current = { cache: createOcclusionCache(), look, api: occlusion };
	}
	const occlusionCache = cacheRef.current.cache;
	occlusionCache.frame(typeof performance !== "undefined" ? performance.now() : Date.now());
	const entries = selectShapes3d({
		shapes: rc.shapesSorted,
		types,
		viewport: rc.viewport,
		viewportBounds: rc.viewportBounds,
		overscanPx,
		renderMode: rc.renderMode,
		amount: view.amount,
		limits,
		heightAt,
	});
	const drawn: { entry: (typeof entries)[number]; def: ShapeDefinition }[] = [];
	for (const entry of entries) {
		const def = shapes.get(entry.shape.type);
		if (def) drawn.push({ entry, def });
	}
	const ids = drawn.map((d) => d.entry.shape.id).join("\n");

	// After the paint: the DOM layer hides exactly what is drawn here (only re-sent when
	// the set changes; the receiver also ignores an unchanged set).
	useEffect(() => {
		onDrawn(new Set(ids ? ids.split("\n") : []));
	}, [ids, onDrawn]);
	// Unmounted (the layer replaced or removed): nothing is drawn here any more.
	useEffect(() => () => onDrawn(new Set()), [onDrawn]);

	if (drawn.length === 0) return null;
	return (
		<div
			data-shape-3d-layer=""
			style={{
				position: "absolute",
				inset: 0,
				pointerEvents: "none",
				transformStyle: "preserve-3d",
			}}
		>
			{drawn.map(({ entry, def }) => {
				const { shape, params } = entry;
				const anchor = shapeAnchor(shape, params.mode);
				const where = {
					viewport: rc.viewport,
					amount: view.amount,
					yaw: view.yaw,
					groundHeight: params.ground ? heightAt(anchor.x, anchor.y) : 0,
				};
				const custom = renderCustom(shape, def, params, types, where, camera);
				const top = where.groundHeight + shapeTop3d(shape, params);
				const hidden = occlusion
					? occlusionCache.get(shape.id, `${anchor.x},${anchor.y},${top}`, () =>
							occlusion.hidden(anchor.x, anchor.y, top),
						)
					: false;
				const pose = custom?.pose ?? shapePose(shape, params, where);
				const box = poseBox(pose);
				const isBox = pose.mode === "box";
				// Opacity would flatten a 3D node's children (a box's walls, a type's own
				// planes), so a box fades its faces instead and a type's own drawing hides.
				const shown = custom ? "hide" : look;
				const hiddenStyle = occludedStyle(hidden, shown);
				const nodeStyle = !custom && isBox && shown === "fade" ? undefined : hiddenStyle;
				const faceStyle = nodeStyle ? undefined : hiddenStyle;
				const shadow = params.shadow ? shadowStyle(pose) : null;
				return [
					shadow ? (
						<div
							key={`shadow-${shape.id}`}
							data-shape-3d-shadow={shape.id}
							style={{
								position: "absolute",
								left: pose.x,
								top: pose.y,
								width: shadow.width,
								height: shadow.height,
								borderRadius: "50%",
								background: "radial-gradient(closest-side, rgba(0,0,0,0.3), rgba(0,0,0,0))",
								opacity: shadow.opacity,
								transform: shadow.transform,
								transformOrigin: "0 0",
								...(hidden ? { visibility: "hidden" } : null),
							}}
						/>
					) : null,
					custom ? (
						<div
							key={shape.id}
							data-shape-3d-id={shape.id}
							data-shape-3d-mode="custom"
							data-shape-3d-hidden={hidden ? "" : undefined}
							style={{
								position: "absolute",
								...box,
								transform: custom.transform,
								transformOrigin: poseOrigin(pose),
								transformStyle: "preserve-3d",
								...nodeStyle,
							}}
						>
							{custom.element}
						</div>
					) : (
						<div
							key={shape.id}
							data-shape-3d-id={shape.id}
							data-shape-3d-mode={pose.mode}
							data-shape-3d-hidden={hidden ? "" : undefined}
							style={{
								position: "absolute",
								...box,
								transform: poseTransform(pose),
								transformOrigin: poseOrigin(pose),
								transformStyle: isBox ? "preserve-3d" : undefined,
								...nodeStyle,
							}}
						>
							{isBox ? (
								<>
									{boxWalls(pose).map((w) => (
										<div
											key={w.side}
											data-shape-3d-wall={w.side}
											style={{
												position: "absolute",
												left: w.left,
												top: w.top,
												width: w.width,
												height: w.height,
												transformOrigin: w.transformOrigin,
												transform: w.transform,
												background: wallColor(shape),
												boxShadow: wallShade(w.side),
												backfaceVisibility: "hidden",
												...faceStyle,
											}}
										/>
									))}
									<div
										data-shape-3d-top=""
										style={{
											position: "absolute",
											inset: 0,
											transform: boxTopTransform(pose),
											...faceStyle,
										}}
									>
										<StandContent shape={shape} def={def} zoom={pose.zoom} />
									</div>
								</>
							) : (
								<StandContent shape={shape} def={def} zoom={pose.zoom} />
							)}
						</div>
					),
				];
			})}
		</div>
	);
}

/** A type's own `render3d` for this shape, placed by {@link render3dFrame}; `null` = use
 *  the generic drawing (no `render3d`, or it returned `null`). */
function renderCustom(
	shape: ShapeData,
	def: ShapeDefinition,
	params: ShapeView3d,
	types: Css3dShapeTypes,
	view: { viewport: Viewport; amount: number; yaw: number; groundHeight: number },
	camera: Css3dCameraSource,
): { pose: ShapePose; transform: string | undefined; element: ReactElement } | null {
	const render3d = types[shape.type]?.render3d;
	if (!render3d) return null;
	const frame = render3dFrame(shape, params, view);
	const { pose } = frame;
	const element = render3d(shape, {
		params,
		amount: pose.raise,
		zoom: pose.zoom,
		width: round3(pose.width * pose.zoom),
		height: round3(pose.height * pose.zoom),
		faceCamera: frame.faceCamera,
		content: <StandContent shape={shape} def={def} zoom={pose.zoom} />,
		camera: () => camera.get(),
		subscribe: (listener) => camera.subscribe(listener),
	});
	return element ? { pose, transform: frame.transform, element } : null;
}

function round3(n: number): number {
	return Math.round(n * 1000) / 1000;
}
