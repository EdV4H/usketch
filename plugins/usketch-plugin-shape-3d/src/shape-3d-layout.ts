// Where and how each 3D shape is placed in the 3D layer — pure, React-free.
//
// The layer is a fixed (screen-space) depth layer: the Mode 7 runtime tilts its wrapper
// into the ground plane and keeps `preserve-3d` through it, so `translateZ` lifts out of
// the ground (as the map's cliffs and the character do). A shape is placed at its foot
// on screen (`worldToScreen`), and a stood-up shape is the shape's own drawing folded up
// about its bottom edge (`rotateX(-90deg)`), like a cliff wall.
import {
	type BoundingBox,
	type RenderMode,
	type ShapeData,
	safeRotation,
	type Viewport,
	viewportRotation,
	worldToScreen,
	wrapDeg,
} from "@edv4h/usketch-shared";
import { resolveShape3d, type Shape3dParams, type Shape3dTypes } from "./shape-3d-params.js";

/** Screen px a shadow floats above its ground (no z-fighting with a raised terrain top). */
export const SHADOW_LIFT_PX = 0.5;

/** The foot of a stood-up shape: the middle of its (rotated) bottom edge, world units. */
export function standFoot(shape: ShapeData): { x: number; y: number } {
	const rad = (safeRotation(shape.rotation) * Math.PI) / 180;
	const half = shape.height / 2;
	return {
		x: shape.x + shape.width / 2 - Math.sin(rad) * half,
		y: shape.y + shape.height / 2 + Math.cos(rad) * half,
	};
}

/** `a` turned toward `b` by `t` (0…1) the short way round, degrees. Pure. */
export function lerpAngle(a: number, b: number, t: number): number {
	return a + wrapDeg(b - a) * t;
}

export interface StandPose {
	/** The foot on screen (layer px). */
	x: number;
	y: number;
	/** Heading of the stood-up plane on the board (deg): 0 = facing the near edge. */
	face: number;
	/** How far it is stood up, 0 (flat on the board) … 1 (upright). */
	raise: number;
	/** Height of the ground under the foot, screen px (world height × zoom). */
	lift: number;
	zoom: number;
	width: number;
	height: number;
}

/**
 * The pose of a stood-up shape. At `amount` 0 it lies exactly where the flat board
 * draws it (heading = its rotation on screen); as the view rises it stands up and — when
 * facing the camera — turns to face it, against the full camera `yaw` (the ground is
 * spun by the yaw, so the plane turns back by it).
 */
export function standPose(
	shape: ShapeData,
	params: Shape3dParams,
	view: { viewport: Viewport; amount: number; yaw: number; groundHeight: number },
): StandPose {
	const foot = standFoot(shape);
	const at = worldToScreen(foot.x, foot.y, view.viewport);
	const zoom = view.viewport.zoom;
	const flat = safeRotation(shape.rotation) + viewportRotation(view.viewport);
	const amount = clamp01(view.amount);
	const face = params.facing === "camera" ? lerpAngle(flat, -view.yaw, amount) : flat;
	return {
		x: at.x,
		y: at.y,
		face: round(face),
		raise: amount,
		lift: params.ground ? Math.max(0, view.groundHeight) * zoom : 0,
		zoom,
		width: shape.width,
		height: shape.height,
	};
}

/**
 * The stood-up shape's node: a box of the shape's size on screen whose bottom-centre is
 * the foot (the pivot it folds up about). The box must have its real size: Chrome drops
 * a 3D-rotated element with an empty box even when its overflowing content isn't empty.
 */
export function standBox(p: Pick<StandPose, "x" | "y" | "width" | "height" | "zoom">): {
	left: number;
	top: number;
	width: number;
	height: number;
} {
	const w = p.width * p.zoom;
	const h = p.height * p.zoom;
	return { left: round(p.x - w / 2), top: round(p.y - h), width: round(w), height: round(h) };
}

/**
 * CSS for a stood-up shape's node (`transform-origin` at its bottom-centre, see
 * {@link standBox}): lift to the ground, turn to the heading, then fold up.
 */
export function standTransform(p: StandPose): string | undefined {
	const parts: string[] = [];
	if (p.lift > 0) parts.push(`translateZ(${round(p.lift)}px)`);
	if (p.face !== 0) parts.push(`rotateZ(${round(p.face)}deg)`);
	if (p.raise > 0) parts.push(`rotateX(${round(-90 * p.raise)}deg)`);
	return parts.length > 0 ? parts.join(" ") : undefined;
}

/** `transform-origin` of a stood-up shape's node: the foot. */
export const STAND_ORIGIN = "50% 100%";

/**
 * CSS for a stood-up shape's shadow: a flat ellipse on the ground at the foot, along the
 * plane's heading. It grows in with the view (`raise`): the flat board has no shadows.
 */
export function shadowStyle(p: StandPose): {
	transform: string;
	width: number;
	height: number;
	opacity: number;
} {
	const width = Math.max(4, p.width * p.zoom * 0.9);
	const height = Math.max(2, Math.min(p.width, p.height) * p.zoom * 0.3);
	return {
		transform: `translateZ(${round(p.lift + SHADOW_LIFT_PX)}px) rotateZ(${round(p.face)}deg) translate(-50%, -50%)`,
		width: round(width),
		height: round(height),
		opacity: round(p.raise),
	};
}

export interface Shape3dLimits {
	/** Shapes smaller than this on screen (px, longer side) stay flat. */
	minPx: number;
	/** At most this many shapes are drawn in 3D — the nearest (lowest on screen) win. */
	maxCount: number;
}

export const DEFAULT_SHAPE_3D_LIMITS: Shape3dLimits = { minPx: 8, maxCount: 200 };

export interface Shape3dEntry {
	shape: ShapeData;
	params: Shape3dParams;
}

/**
 * The shapes to draw in 3D now (in z-order). Only while the view is (partly) 3D, never
 * in the global LOD mode, and only shapes whose foot is on the drawn ground: the board
 * box grown by the 3D view's overscan. A depth layer isn't clipped by the draw distance,
 * so a shape farther out would stand in the sky past the ground's end. Pure.
 */
export function selectShapes3d(input: {
	shapes: readonly ShapeData[];
	types: Shape3dTypes;
	viewport: Viewport;
	viewportBounds: BoundingBox;
	/** Screen px the 3D view shows past the board box (`bg-grid:set-overscan`). */
	overscanPx: number;
	renderMode: RenderMode;
	amount: number;
	limits: Shape3dLimits;
}): Shape3dEntry[] {
	if (!(input.amount > 0) || input.renderMode === "lod") return [];
	const zoom = input.viewport.zoom;
	if (!(zoom > 0)) return [];
	const pad = input.overscanPx > 0 ? input.overscanPx / zoom : 0;
	const b = input.viewportBounds;
	const x0 = b.x - pad;
	const y0 = b.y - pad;
	const x1 = b.x + b.width + pad;
	const y1 = b.y + b.height + pad;
	const found: (Shape3dEntry & { screenY: number })[] = [];
	for (const shape of input.shapes) {
		if (!shape || typeof shape.id !== "string") continue;
		const params = resolveShape3d(shape, input.types);
		if (!params) continue;
		if (Math.max(shape.width, shape.height) * zoom < input.limits.minPx) continue;
		const foot = standFoot(shape);
		if (foot.x < x0 || foot.x > x1 || foot.y < y0 || foot.y > y1) continue;
		found.push({ shape, params, screenY: worldToScreen(foot.x, foot.y, input.viewport).y });
	}
	const max = Math.max(0, Math.floor(input.limits.maxCount));
	if (found.length > max) {
		const keep = new Set(
			[...found]
				.sort((a, b) => b.screenY - a.screenY)
				.slice(0, max)
				.map((e) => e.shape.id),
		);
		return found
			.filter((e) => keep.has(e.shape.id))
			.map(({ shape, params }) => ({ shape, params }));
	}
	return found.map(({ shape, params }) => ({ shape, params }));
}

function clamp01(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.min(1, Math.max(0, n));
}

function round(n: number): number {
	return Math.round(n * 1000) / 1000;
}
