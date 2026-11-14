// The CSS the renderer injects: the tilt of each layer wrapper, the draw-distance clip
// and the depth context. Pure string builders (moved from the Mode 7 plugin).
/**
 * The `clip-path` for the tilted layer wrappers. The tilt uses `overflow:visible` to
 * keep the 3D intact, which would otherwise let content float PAST the grid; the clip
 * bounds the tilted content instead.
 *
 * `distance` is the draw distance in **canvas/world units** measured forward from the
 * near edge (bottom of the viewport). `distance <= 0` means "auto": clip exactly to the
 * box (`inset(0)` — nothing floats past the grid, no overscan). A positive `distance`
 * maps to `distance * zoom` screen px at the bottom of the wrapper box:
 *   - within the box (`distance*zoom < height`) → positive inset (a closer cutoff);
 *   - beyond the box (`distance*zoom > height`) → NEGATIVE inset, i.e. the clip extends
 *     above the box so content farther than the viewport is drawn. The background grid
 *     must be extended to match (see {@link drawDistanceOverscanPx}) or that far content
 *     would float; `clip-path` keeps the 3D tilt intact (unlike `overflow`, flattening).
 */
export function drawDistanceClip(
	distance: number,
	zoom: number,
	viewportHeightPx: number,
	/** Transition amount 0…1: a near-band clip fades in with the tilt, so the still-flat
	 *  board isn't cut off at the top while the ground rises. */
	strength = 1,
): string {
	if (!(distance > 0) || !(zoom > 0) || !(viewportHeightPx > 0)) {
		return "inset(0% 0% 0% 0%)"; // auto → clip to the box
	}
	const bandPx = distance * zoom;
	if (bandPx <= viewportHeightPx) {
		// Within the viewport: keep only the near band; sides stay at the box.
		const s = Math.min(1, Math.max(0, strength));
		return `inset(${round((1 - bandPx / viewportHeightPx) * 100 * s)}% 0% 0% 0%)`;
	}
	// Beyond the viewport: extend equally on ALL sides so the far ground fans out
	// (not just a box-wide strip). The grid overscans to match; the canvas container
	// clips whatever runs off-screen. Negative inset grows the clip region past the box.
	const over = round(bandPx - viewportHeightPx);
	return `inset(${-over}px ${-over}px ${-over}px ${-over}px)`;
}

/**
 * The px the background grid must extend ABOVE/BEYOND the viewport box to stay under the
 * content that {@link drawDistanceClip} reveals for a draw `distance` larger than the
 * viewport. `0` when the distance is auto/within the box (no extension needed). This is
 * what the canvas hands backgrounds as `LayerRenderContext.view3dOverscan` (see
 * `view3dOverscanPx`), so the grid and the shapes end together.
 */
export function drawDistanceOverscanPx(
	distance: number,
	zoom: number,
	viewportHeightPx: number,
): number {
	if (!(distance > 0) || !(zoom > 0) || !(viewportHeightPx > 0)) return 0;
	const bandPx = distance * zoom;
	return bandPx > viewportHeightPx ? Math.ceil(bandPx - viewportHeightPx) : 0;
}

export interface TiltRuleOptions {
	/** Attribute marking the main canvas container (rules are scoped to it). */
	stageAttr: string;
	transform: string;
	transformOrigin: string;
	/** The draw-distance `clip-path` (see {@link drawDistanceClip}). */
	clip: string;
	/** Layers rendered with real depth (`Layer.view3d` `depth`). */
	depthLayerIds: ReadonlySet<string>;
}

/**
 * The injected stylesheet that tilts each selected layer wrapper.
 *
 * `overflow:visible` + `transform-style:preserve-3d` are essential for layers like
 * `dom-shapes`: their wrapper has `overflow:hidden` (which the CSS spec forces
 * `transform-style` to `flat`) and an inner viewport-transform div that Chrome
 * composites separately — so without these the SHAPES render flat in screen space
 * while only the wrapper tilts. A DESCENDANT selector (space, not `>`) matches the
 * wrapper regardless of nesting.
 *
 * Plain layers get the draw-distance clip. A `clip-path` is a grouping property that
 * FLATTENS its subtree onto the plane, so DEPTH layers skip it and instead keep the
 * 3D context through the engine's inner wrappers (viewport-transform / pointer divs):
 * content that sets its own depth (raised map terrain, a character standing on it) then
 * rises out of the tilted ground instead of being painted onto it.
 */
export function tiltLayerRules(layerIds: readonly string[], o: TiltRuleOptions): string {
	return layerIds
		.map((id) => {
			const layer = `[${o.stageAttr}="on"] [data-layer-id="${attrValue(id)}"]`;
			const base = `transform:${o.transform} !important;transform-origin:${o.transformOrigin} !important;overflow:visible !important;transform-style:preserve-3d !important;`;
			if (!o.depthLayerIds.has(id)) return `${layer}{${base}clip-path:${o.clip} !important;}`;
			return `${layer}{${base}}${layer}>div,${layer}>div>div{transform-style:preserve-3d}`;
		})
		.join("");
}

/** Keep an attribute-selector value valid (layer ids are simple, but be safe). */
function attrValue(id: string): string {
	return id.replace(/["\\]/g, "");
}

function round(n: number): number {
	return Math.round(n * 1000) / 1000;
}
