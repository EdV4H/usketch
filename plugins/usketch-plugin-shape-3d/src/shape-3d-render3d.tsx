// A shape type's own 3D look (`render3d` in its type config): it replaces the generic
// stand / box / float drawing for shapes of that type. The layer places a node of the
// shape's size at its anchor on the ground (lifted to the terrain and turned to the
// shape's heading, `preserve-3d`), and `render3d` draws inside it.
import type { ShapeView3dRender, ShapeView3dRenderContext } from "@edv4h/usketch-shared";
import { STAND_ORIGIN } from "./shape-3d-layout.js";

/** What a type's own 3D drawing gets (= `ShapeView3dRenderContext`). */
export type Shape3dRenderContext = ShapeView3dRenderContext;

/** Draws a shape type in 3D (= `ShapeView3dRender`). Return `null` for the generic drawing. */
export type Shape3dRender = ShapeView3dRender;

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
