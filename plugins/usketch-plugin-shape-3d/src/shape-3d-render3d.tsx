// A shape type's own 3D look (`render3d` in its type config): it replaces the generic
// stand / box / float drawing for shapes of that type. The layer places a node of the
// shape's size at its anchor on the ground (lifted to the terrain and turned to the
// shape's heading, `preserve-3d`), and `render3d` draws inside it.
import type { ShapeData, View3dCamera } from "@edv4h/usketch-shared";
import type { ReactElement } from "react";
import { STAND_ORIGIN } from "./shape-3d-layout.js";
import type { Shape3dParams } from "./shape-3d-params.js";

export interface Shape3dRenderContext {
	/** The shape's resolved 3D parameters. */
	params: Shape3dParams;
	/** How far into 3D the view is, 0 (flat) … 1. Draw flat at 0: the board is flat then. */
	amount: number;
	/** Screen px per world unit. */
	zoom: number;
	/** The node's size in screen px (the shape's size × zoom). Its ground is z = 0. */
	width: number;
	height: number;
	/** Degrees to turn by (`rotateZ`, about the node's anchor) to face the camera, already
	 *  scaled by `amount`. 0 when flat. */
	faceCamera: number;
	/** The shape's own drawing, filling the node (as the flat board draws it). */
	content: ReactElement;
	/** The camera as drawn now (pitch / yaw scaled by `amount`), `null` without a 3D view.
	 *  For a canvas (three.js etc.) that matches its own camera to the view. */
	camera(): View3dCamera | null;
	/** Notified on every change of the camera or the transition amount (also once a 3D view
	 *  appears later), without re-rendering React. Returns an unsubscribe. */
	subscribe(listener: () => void): () => void;
}

/**
 * Draws a shape type in 3D. Return `null` to use the generic drawing for this shape's
 * mode (e.g. only handle `stand`).
 */
export type Shape3dRender = (shape: ShapeData, ctx: Shape3dRenderContext) => ReactElement | null;

/**
 * A ready-made `render3d`: a stood-up shape drawn as two crossed planes (the classic
 * tree / plant sprite), so it reads as solid from any side without turning to the
 * camera. Other modes fall back to the generic drawing.
 */
export const crossRender3d: Shape3dRender = (_shape, ctx) => {
	if (ctx.params.mode !== "stand") return null;
	const fold = ctx.amount > 0 ? ` rotateX(${Math.round(-90 * ctx.amount * 1000) / 1000}deg)` : "";
	return (
		<>
			{[0, 90].map((turn) => (
				<div
					key={turn}
					data-shape-3d-plane={turn}
					style={{
						position: "absolute",
						inset: 0,
						transformOrigin: STAND_ORIGIN,
						// The second plane swings out as the view rises: flat, both coincide.
						transform: `rotateZ(${Math.round(turn * ctx.amount * 1000) / 1000}deg)${fold}`,
						transformStyle: "preserve-3d",
					}}
				>
					{ctx.content}
				</div>
			))}
		</>
	);
};
