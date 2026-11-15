// Where a shape's parts are in a 3D view (world units, height up): the face that shows
// the shape's drawing, a box's walls, a soft shadow. Every 3D renderer places a 3D shape
// the same way, and the pointer picks it by the same faces (see `view-3d-pick`). Pure.
import { shapeView3dAnchor } from "./shape-solids.js";
import type { ShapeView3d } from "./shape-view-3d.js";
import { view3dShapeHeading } from "./shape-view-3d-layout.js";
import type { BoundingBox } from "./types/geometry.js";
import type { ShapeData } from "./types/shape.js";
import { safeRotation } from "./utils/rotation.js";

/** A point or a direction in world space: x, y, height. */
export type Vec3 = [number, number, number];

/** A quad in world space (height up): its top-left corner and its two edges. */
export interface Quad3d {
	at: Vec3;
	/** Along the drawing's width (uv x 0 → 1). */
	u: Vec3;
	/** Along the drawing's height, downward in it (uv y 0 → 1). */
	v: Vec3;
}

/** How a 3D shape is placed in a frame: the face with its drawing, walls and shadow. */
export interface ShapeView3dFaces {
	/** The shape's drawing (grown by `pad` world units on each side). */
	picture: Quad3d;
	/** A box's walls (not grown), with how much they darken. */
	walls: { quad: Quad3d; shade: number }[];
	/** The soft shadow on the ground (a quad the shadow ellipse fills), and its strength. */
	shadow: { quad: Quad3d; opacity: number } | null;
	/** Lies flat on its ground (no depth): drawn with the flat shapes, in z-order. */
	flat: boolean;
}

/** The view a shape's faces are placed for. */
export interface ShapeView3dFacesView {
	/** How far into 3D the view is, 0 … 1. */
	amount: number;
	/** The camera's full yaw (deg), which shapes facing the camera turn to. */
	yaw: number;
	/** The viewport's rotation (deg). */
	viewportRotation: number;
	/** The ground's height under the shape (world units). */
	groundHeight: number;
	/** World units the drawing's face grows by on each side (a picture's margin). */
	pad: number;
}

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];

/** A level quad `w` × `h` centred on (`cx`, `cy`) at height `z`, turned by `rad`. Pure. */
export function flatQuad3d(
	cx: number,
	cy: number,
	z: number,
	w: number,
	h: number,
	rad: number,
): Quad3d {
	const dx: Vec3 = [Math.cos(rad), Math.sin(rad), 0];
	const dy: Vec3 = [-Math.sin(rad), Math.cos(rad), 0];
	return {
		at: add(add([cx, cy, z], mul(dx, -w / 2)), mul(dy, -h / 2)),
		u: mul(dx, w),
		v: mul(dy, h),
	};
}

/**
 * Where a 3D shape's parts are (world units, height up), as the CSS 3D renderer places
 * them: a `stand` shape folded up about its foot by `90° × amount`, turned to its heading;
 * a `box` top and walls risen to `height × amount`; a `float` face lifted to it. Pure.
 */
export function shapeView3dFaces(
	shape: ShapeData,
	params: ShapeView3d,
	view: ShapeView3dFacesView,
): ShapeView3dFaces {
	const amount = Math.min(1, Math.max(0, Number.isFinite(view.amount) ? view.amount : 0));
	const ground = params.ground ? Math.max(0, view.groundHeight) : 0;
	const rot = safeRotation(shape.rotation);
	const { width: w, height: h } = shape;
	const pad = view.pad;
	const anchor = shapeView3dAnchor(shape, params.mode);
	if (params.mode === "stand") {
		// The heading on the flat screen, back to the world (the view turns it by its rotation).
		const screen = view3dShapeHeading(params, rot + view.viewportRotation, amount, view.yaw);
		const rad = ((screen - view.viewportRotation) * Math.PI) / 180;
		const dx: Vec3 = [Math.cos(rad), Math.sin(rad), 0];
		const fold = (amount * Math.PI) / 2;
		// The drawing's "up" (toward its top), folding from the flat board up to the sky.
		const up: Vec3 = [
			Math.sin(rad) * Math.cos(fold),
			-Math.cos(rad) * Math.cos(fold),
			Math.sin(fold),
		];
		const foot: Vec3 = [anchor.x, anchor.y, ground];
		const shadowW = Math.max(4, w * 0.9);
		const shadowD = Math.max(2, Math.min(w, h) * 0.3);
		return {
			picture: {
				at: add(add(foot, mul(dx, -w / 2 - pad)), mul(up, h + pad)),
				u: mul(dx, w + 2 * pad),
				v: mul(up, -(h + 2 * pad)),
			},
			walls: [],
			shadow:
				params.shadow && amount > 0
					? { quad: flatQuad3d(anchor.x, anchor.y, ground, shadowW, shadowD, rad), opacity: amount }
					: null,
			flat: false,
		};
	}
	const rad = (rot * Math.PI) / 180;
	const rise = Math.max(0, params.height) * amount;
	const top = ground + rise;
	const picture = flatQuad3d(anchor.x, anchor.y, top, w + 2 * pad, h + 2 * pad, rad);
	if (params.mode === "box") {
		const body = flatQuad3d(anchor.x, anchor.y, top, w, h, rad);
		const tl = body.at;
		const tr = add(tl, body.u);
		const bl = add(tl, body.v);
		const br = add(tr, body.v);
		const down: Vec3 = [0, 0, -rise];
		const wall = (a: Vec3, b: Vec3, shade: number) => ({
			quad: { at: a, u: [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as Vec3, v: down },
			shade,
		});
		return {
			picture,
			walls:
				rise > 0
					? [wall(tl, tr, 0.22), wall(tr, br, 0.35), wall(br, bl, 0.22), wall(bl, tl, 0.35)]
					: [],
			shadow: null,
			flat: !(rise > 0),
		};
	}
	return {
		picture,
		walls: [],
		shadow:
			params.shadow && amount > 0 && rise > 0
				? {
						quad: flatQuad3d(
							anchor.x,
							anchor.y,
							ground,
							Math.max(4, w * 0.9),
							Math.max(2, h * 0.9),
							rad,
						),
						opacity: amount * 0.7,
					}
				: null,
		flat: !(rise > 0),
	};
}

/**
 * How high a flat shape lies in a 3D view: the ground under its centre, as the 3D
 * renderers draw it (`0` for no ground or below it). Pure.
 */
export function flatShapeView3dHeight(
	box: BoundingBox,
	groundAt: (x: number, y: number) => number,
): number {
	const h = groundAt(box.x + box.width / 2, box.y + box.height / 2);
	return Number.isFinite(h) && h > 0 ? h : 0;
}
