// Which layers the GPU 3D renderer draws itself and which it leaves to the CSS 3D tilt.
//
// The canvas draws the ground: the background grid, the terrain and the shapes (from the
// layers at or under the shapes). Those layers are hidden while it draws. What shows above
// the shapes (a character, the selection handles, a laser, other people's cursors) stays
// DOM and is tilted with CSS 3D, as the CSS 3D renderer does it, over the canvas.
import type { LayerView3d } from "@edv4h/usketch-shared";

/** A layer as the split sees it. */
export interface Gpu3dLayerInfo {
	id: string;
	order: number;
	view3d?: LayerView3d;
}

/** The layers that draw the board's shapes (the canvas draws what they show). */
export const SHAPE_LAYER_IDS: readonly string[] = ["dom-shapes", "gpu-shapes", "shape-3d"];
/** The shapes' order when no shape layer is on the board (the DOM renderer's). */
const DEFAULT_SHAPES_ORDER = 50;

export interface Gpu3dLayerSplit {
	/** Hidden while the canvas draws (it draws what they show, or can't yet). */
	hidden: string[];
	/** Tilted with CSS 3D over the canvas. */
	overlay: string[];
}

/**
 * Split the layers that show in 3D (`shown`: the tilt / depth layers, plus the ones that
 * declare `ground`) between the canvas and the CSS overlay: a tilt / depth layer above
 * every shape layer is overlaid, anything else is hidden. `ownId` (the canvas's layer) is
 * in neither. Pure.
 */
export function splitView3dLayers(
	layers: readonly Gpu3dLayerInfo[],
	shown: readonly string[],
	ownId: string,
): Gpu3dLayerSplit {
	const byId = new Map(layers.map((l) => [l.id, l]));
	let shapesOrder = Number.NEGATIVE_INFINITY;
	for (const id of SHAPE_LAYER_IDS) {
		const l = byId.get(id);
		if (l && l.order > shapesOrder) shapesOrder = l.order;
	}
	if (!Number.isFinite(shapesOrder)) shapesOrder = DEFAULT_SHAPES_ORDER;
	const hidden: string[] = [];
	const overlay: string[] = [];
	for (const id of new Set(shown)) {
		if (id === ownId) continue;
		const l = byId.get(id);
		if (l && l.view3d !== "ground" && l.order > shapesOrder) overlay.push(id);
		else hidden.push(id);
	}
	return { hidden, overlay };
}
