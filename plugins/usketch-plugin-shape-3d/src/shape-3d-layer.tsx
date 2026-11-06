// The 3D layer: draws the shapes that rise out of the ground while the board is shown
// in 3D (Mode 7). It must be one of the view's depth layers (Mode 7's default set has
// it) so the `translateZ` / `rotateX` below rise out of the tilted ground instead of
// being flattened onto it. The DOM shape layer skips the same shapes meanwhile.
import { ShapeContent } from "@edv4h/usketch-dom-renderer";
import type {
	LayerRenderContext,
	ShapeData,
	ShapeDefinition,
	ShapeRegistry,
	View3dCamera,
	Viewport,
} from "@edv4h/usketch-shared";
import { memo, type ReactElement, useEffect, useSyncExternalStore } from "react";
import {
	boxTopTransform,
	boxWalls,
	poseBox,
	poseOrigin,
	poseTransform,
	render3dFrame,
	type Shape3dLimits,
	type ShapePose,
	selectShapes3d,
	shadowStyle,
	shapeAnchor,
	shapePose,
	wallColor,
	wallShade,
} from "./shape-3d-layout.js";
import type { Shape3dParams, Shape3dTypes } from "./shape-3d-params.js";
import type { View3dTracker } from "./view-3d-tracker.js";

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

export interface Shape3dLayerProps {
	rc: LayerRenderContext;
	shapes: ShapeRegistry;
	tracker: View3dTracker;
	types: Shape3dTypes;
	limits: Shape3dLimits;
	/** Screen px the 3D view shows past the board box. */
	overscanPx: number;
	/** Ground height at a world point (world units). */
	heightAt: (x: number, y: number) => number;
	/** Told which shapes this layer draws after each render (the DOM layer hides them). */
	onDrawn: (ids: ReadonlySet<string>) => void;
	/** The 3D view's camera, for a type's own `render3d`. */
	camera?: Shape3dCameraSource;
}

/** The drawn camera and its change notifications (see `Shape3dRenderContext`). */
export interface Shape3dCameraSource {
	get(): View3dCamera | null;
	subscribe(listener: () => void): () => void;
}

const NO_CAMERA: Shape3dCameraSource = { get: () => null, subscribe: () => () => {} };

export function Shape3dLayer({
	rc,
	shapes,
	tracker,
	types,
	limits,
	overscanPx,
	heightAt,
	onDrawn,
	camera = NO_CAMERA,
}: Shape3dLayerProps) {
	const view = useSyncExternalStore(tracker.subscribe, tracker.get, tracker.get);
	const entries = selectShapes3d({
		shapes: rc.shapesSorted,
		types,
		viewport: rc.viewport,
		viewportBounds: rc.viewportBounds,
		overscanPx,
		renderMode: rc.renderMode,
		amount: view.amount,
		limits,
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
				const pose = custom?.pose ?? shapePose(shape, params, where);
				const box = poseBox(pose);
				const isBox = pose.mode === "box";
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
							}}
						/>
					) : null,
					custom ? (
						<div
							key={shape.id}
							data-shape-3d-id={shape.id}
							data-shape-3d-mode="custom"
							style={{
								position: "absolute",
								...box,
								transform: custom.transform,
								transformOrigin: poseOrigin(pose),
								transformStyle: "preserve-3d",
							}}
						>
							{custom.element}
						</div>
					) : (
						<div
							key={shape.id}
							data-shape-3d-id={shape.id}
							data-shape-3d-mode={pose.mode}
							style={{
								position: "absolute",
								...box,
								transform: poseTransform(pose),
								transformOrigin: poseOrigin(pose),
								transformStyle: isBox ? "preserve-3d" : undefined,
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
											}}
										/>
									))}
									<div
										data-shape-3d-top=""
										style={{
											position: "absolute",
											inset: 0,
											transform: boxTopTransform(pose),
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
	params: Shape3dParams,
	types: Shape3dTypes,
	view: { viewport: Viewport; amount: number; yaw: number; groundHeight: number },
	camera: Shape3dCameraSource,
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
		camera: camera.get,
		subscribe: camera.subscribe,
	});
	return element ? { pose, transform: frame.transform, element } : null;
}

function round3(n: number): number {
	return Math.round(n * 1000) / 1000;
}
