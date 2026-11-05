// The 3D layer: draws the shapes that stand out of the ground while the board is shown
// in 3D (Mode 7). It must be one of the view's depth layers (Mode 7's default set has
// it) so the `translateZ` / `rotateX` below rise out of the tilted ground instead of
// being flattened onto it. The DOM shape layer skips the same shapes meanwhile.
import { ShapeContent } from "@edv4h/usketch-dom-renderer";
import type {
	LayerRenderContext,
	ShapeData,
	ShapeDefinition,
	ShapeRegistry,
} from "@edv4h/usketch-shared";
import { memo, useEffect, useSyncExternalStore } from "react";
import {
	type Shape3dLimits,
	STAND_ORIGIN,
	selectShapes3d,
	shadowStyle,
	standBox,
	standFoot,
	standPose,
	standTransform,
} from "./shape-3d-layout.js";
import type { Shape3dTypes } from "./shape-3d-params.js";
import type { View3dTracker } from "./view-3d-tracker.js";

export const SHAPE_3D_LAYER_ID = "shape-3d";

/**
 * The shape's own drawing at its world size, scaled to the node's px box (re-rendered
 * only when the shape or the zoom changes, not as the camera moves).
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
				opacity: shape.style?.opacity,
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
}

export function Shape3dLayer({
	rc,
	shapes,
	tracker,
	types,
	limits,
	overscanPx,
	heightAt,
	onDrawn,
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
				const foot = standFoot(shape);
				const pose = standPose(shape, params, {
					viewport: rc.viewport,
					amount: view.amount,
					yaw: view.yaw,
					groundHeight: params.ground ? heightAt(foot.x, foot.y) : 0,
				});
				const box = standBox(pose);
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
					<div
						key={shape.id}
						data-shape-3d-id={shape.id}
						style={{
							position: "absolute",
							...box,
							transform: standTransform(pose),
							transformOrigin: STAND_ORIGIN,
						}}
					>
						<StandContent shape={shape} def={def} zoom={pose.zoom} />
					</div>,
				];
			})}
		</div>
	);
}
