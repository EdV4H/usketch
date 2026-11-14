// The renderer's 3D shapes: shapes with 3D parameters (`ShapeData.view3d`, or their type's
// default) stand out of the ground while the board is shown in 3D, and shapes lying on
// raised terrain are lifted onto it. The flat DOM layer skips the same shapes through the
// board's shape claims.
//
// Which modes a type may use comes from the type itself (`ShapeDefinition.view3d` with the
// host's `ctx.shapes.configureView3d`). A plugin can hand the renderer its own table and
// limits instead through `css3dShapeSourceService` (the shape-3d plugin does, for its
// older options, until the next major).
import { VIEWPORT_OVERSCAN_EVENT } from "@edv4h/usketch-dom-renderer";
import {
	boardHeight,
	createView3dTracker,
	declaredView3dShapeTypes,
	type Layer,
	type PluginContext,
	sanitizeView3dShapeLimits,
	shapeClaims,
	type View3dOcclusionApi,
	type View3dShapeSource,
	view3dService,
	view3dShapeSourceService,
} from "@edv4h/usketch-shared";
import {
	type Css3dCameraSource,
	type Css3dChangeSource,
	Css3dShapesLayer,
	SHAPE_3D_LAYER_ID,
} from "./shapes-layer.js";
/** What a plugin hands the renderer to draw 3D shapes by (shared's `View3dShapeSource`). */
export type Css3dShapeSource = View3dShapeSource;

/**
 * A plugin's source for the renderer's 3D shapes (shared's `view3dShapeSourceService`,
 * which the GPU 3D renderer reads too).
 */
export const css3dShapeSourceService = view3dShapeSourceService;

let nextClaimSource = 0;

/** Limits with every field usable (shared's `sanitizeView3dShapeLimits`). */
export const sanitizeCss3dShapeLimits = sanitizeView3dShapeLimits;

export interface Css3dShapesOptions {
	/** What the ground hides (the renderer's), read on every draw. */
	occlusion?: () => View3dOcclusionApi | null;
}

/**
 * Register the 3D shape layer on `ctx` (the CSS 3D renderer does it on setup). Returns its
 * teardown.
 */
export function setupCss3dShapes(ctx: PluginContext, options: Css3dShapesOptions = {}): () => void {
	const tracker = createView3dTracker(ctx.services, ctx.events);
	const claims = shapeClaims(ctx.services);
	const claimSource = `usketch-css3d-renderer:shapes#${nextClaimSource++}`;
	const height = ctx.height ?? boardHeight(ctx.services);
	const heightAt = (x: number, y: number) => height.groundAt(x, y);

	// The types' own 3D, rebuilt when a type registers or the host overrides one.
	const declared = declaredView3dShapeTypes(ctx.shapes, () =>
		ctx.events.emit("layers:changed", {}),
	);
	const declaredTypes = declared.get;

	let overscanPx = 0;
	const offOverscan = ctx.events.on<{ px: number }>(VIEWPORT_OVERSCAN_EVENT, ({ px }) => {
		const next = Number.isFinite(px) && px > 0 ? px : 0;
		if (next === overscanPx) return;
		overscanPx = next;
		ctx.events.emit("layers:changed", {});
	});

	const onDrawn = (ids: ReadonlySet<string>): void => claims.claim(claimSource, ids);
	const camera: Css3dCameraSource = {
		get: () => view3dService.get(ctx.services)?.camera() ?? null,
		subscribe: (listener) => tracker.subscribeCamera(listener),
	};

	// One subscription to the occlusion's changes for every mounted layer.
	let occlusionVersion = 0;
	const occlusionChanges: Css3dChangeSource = {
		get: () => occlusionVersion,
		subscribe(listener) {
			const off = options.occlusion?.()?.subscribe(() => {
				occlusionVersion++;
				listener();
			});
			return () => off?.();
		},
	};

	const layer: Layer = {
		id: SHAPE_3D_LAYER_ID,
		view3d: "depth",
		// Just above the flat DOM shapes (50); a fixed layer placed in screen px.
		order: 51,
		avoidCollision: true,
		fixed: true,
		render: (rc) => {
			const source = css3dShapeSourceService.get(ctx.services);
			return (
				<Css3dShapesLayer
					rc={rc}
					shapes={ctx.shapes}
					tracker={tracker}
					types={source?.types?.() ?? declaredTypes()}
					limits={sanitizeCss3dShapeLimits(source?.limits?.())}
					overscanPx={overscanPx}
					heightAt={heightAt}
					onDrawn={onDrawn}
					camera={camera}
					occlusion={options.occlusion?.() ?? null}
					occlusionChanges={occlusionChanges}
				/>
			);
		},
	};
	ctx.layers.register(layer);

	return () => {
		// Another registration under the same id (an older shape-3d plugin) stays.
		if (ctx.layers.getLayers().some((l) => l === layer)) ctx.layers.unregister(SHAPE_3D_LAYER_ID);
		claims.claim(claimSource, []);
		declared.dispose();
		offOverscan();
		tracker.dispose();
	};
}
