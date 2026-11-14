// Where and how each 3D shape is placed in the renderer's 3D shape layer — pure, React-free.
// (Moved here from the shape-3d plugin, which re-exports it until the next major.)
//
// The layer is a fixed (screen-space) depth layer: the Mode 7 runtime tilts its wrapper
// into the ground plane and keeps `preserve-3d` through it, so `translateZ` lifts out of
// the ground (as the map's cliffs and the character do). A shape is placed at its anchor
// on screen (`worldToScreen`): a stood-up shape is its own drawing folded up about its
// bottom edge (`rotateX(-90deg)`), like a cliff wall; a floating one is lifted flat; a
// box is lifted as a top with four walls folded down from it.
import {
	type BoundingBox,
	type RenderMode,
	resolveShapeView3d,
	type ShapeData,
	type ShapeTypeView3d,
	type ShapeView3d,
	type ShapeView3dMode,
	safeRotation,
	shapeTypeModes,
	shapeView3dAnchor,
	shapeView3dFoot,
	type Viewport,
	viewportRotation,
	worldToScreen,
	wrapDeg,
} from "@edv4h/usketch-shared";

type Shape3dMode = ShapeView3dMode;
type Shape3dParams = ShapeView3d;

/** Each shape type's 3D (`ShapeTypeView3d`), by type. */
export type Css3dShapeTypes = Readonly<Record<string, ShapeTypeView3d>>;

/** Screen px a shadow floats above its ground (no z-fighting with a raised terrain top). */
export const SHADOW_LIFT_PX = 0.5;

/** The foot of a stood-up shape: the middle of its (rotated) bottom edge, world units. */
export const standFoot = shapeView3dFoot;

/** The point a shape is placed by: the foot for `stand`, the centre otherwise. World units. */
export const shapeAnchor = shapeView3dAnchor;

/** `a` turned toward `b` by `t` (0…1) the short way round, degrees. Pure. */
export function lerpAngle(a: number, b: number, t: number): number {
	return a + wrapDeg(b - a) * t;
}

export interface ShapePose {
	mode: Shape3dMode;
	/** The anchor on screen (layer px): the foot (`stand`) or the centre. */
	x: number;
	y: number;
	/** Heading on the board (deg). `stand`: 0 = facing the near edge. */
	face: number;
	/** How far into 3D it is, 0 (flat on the board) … 1 (fully up). */
	raise: number;
	/** Height of the ground under the anchor, screen px (world height × zoom). */
	lift: number;
	/** `box` / `float`: how far above the ground the face is now, screen px
	 *  (height × raise × zoom). 0 for `stand`. */
	rise: number;
	zoom: number;
	width: number;
	height: number;
}

/**
 * The pose of a 3D shape. At `amount` 0 it lies exactly where the flat board draws it
 * (heading = its rotation on screen). As the view rises, a `stand` shape stands up and —
 * when facing the camera — turns to face it, against the full camera `yaw` (the ground is
 * spun by the yaw, so the plane turns back by it); a `box` / `float` face rises to its
 * height.
 */
export function shapePose(
	shape: ShapeData,
	params: Shape3dParams,
	view: { viewport: Viewport; amount: number; yaw: number; groundHeight: number },
): ShapePose {
	const anchor = shapeAnchor(shape, params.mode);
	const at = worldToScreen(anchor.x, anchor.y, view.viewport);
	const zoom = view.viewport.zoom;
	const flat = safeRotation(shape.rotation) + viewportRotation(view.viewport);
	const amount = clamp01(view.amount);
	const stand = params.mode === "stand";
	const face = stand && params.facing === "camera" ? lerpAngle(flat, -view.yaw, amount) : flat;
	return {
		mode: params.mode,
		x: at.x,
		y: at.y,
		face: round(face),
		raise: amount,
		lift: params.ground ? Math.max(0, view.groundHeight) * zoom : 0,
		rise: stand ? 0 : round(Math.max(0, params.height) * amount * zoom),
		zoom,
		width: shape.width,
		height: shape.height,
	};
}

/**
 * The node of a 3D shape: a box of the shape's size on screen, placed so the anchor is
 * its bottom-centre (`stand`, the pivot it folds up about) or its centre. The box must
 * have its real size: Chrome drops a 3D-rotated element with an empty box even when its
 * overflowing content isn't empty.
 */
export function poseBox(
	p: Pick<ShapePose, "x" | "y" | "width" | "height" | "zoom"> & { mode?: Shape3dMode },
): { left: number; top: number; width: number; height: number } {
	const w = p.width * p.zoom;
	const h = p.height * p.zoom;
	const top = !p.mode || p.mode === "stand" ? p.y - h : p.y - h / 2;
	return { left: round(p.x - w / 2), top: round(top), width: round(w), height: round(h) };
}

/** `transform-origin` of a stood-up shape's node: the foot. */
export const STAND_ORIGIN = "50% 100%";

/** `transform-origin` of a 3D shape's node (see {@link poseBox}). */
export function poseOrigin(p: Pick<ShapePose, "mode">): string {
	return p.mode === "stand" ? STAND_ORIGIN : "50% 50%";
}

/**
 * CSS for a 3D shape's node: lift to the ground, turn to the heading, then fold up
 * (`stand`) or rise (`float`). A `box` node is only lifted and turned: its top and walls
 * are children ({@link boxTopTransform}, {@link boxWalls}). `undefined` when flat.
 */
export function poseTransform(p: ShapePose): string | undefined {
	const parts: string[] = [];
	const z = p.lift + (p.mode === "float" ? p.rise : 0);
	if (z > 0) parts.push(`translateZ(${round(z)}px)`);
	if (p.face !== 0) parts.push(`rotateZ(${round(p.face)}deg)`);
	if (p.mode === "stand" && p.raise > 0) parts.push(`rotateX(${round(-90 * p.raise)}deg)`);
	return parts.length > 0 ? parts.join(" ") : undefined;
}

/**
 * Where a type's own `render3d` draws: the shape's node (as {@link poseBox} /
 * {@link poseOrigin}) lifted to the ground and turned to the shape's own heading, plus
 * how far to turn back to face the camera (scaled by the transition). The generic
 * camera-facing turn isn't applied: `render3d` decides. Pure.
 */
export function render3dFrame(
	shape: ShapeData,
	params: Shape3dParams,
	view: { viewport: Viewport; amount: number; yaw: number; groundHeight: number },
): { pose: ShapePose; transform: string | undefined; faceCamera: number } {
	const pose = shapePose(shape, { ...params, facing: "fixed" }, view);
	const parts: string[] = [];
	if (pose.lift > 0) parts.push(`translateZ(${round(pose.lift)}px)`);
	if (pose.face !== 0) parts.push(`rotateZ(${round(pose.face)}deg)`);
	return {
		pose,
		transform: parts.length > 0 ? parts.join(" ") : undefined,
		faceCamera: round(wrapDeg(-view.yaw - pose.face) * pose.raise),
	};
}

/** CSS for a `box` shape's top (the shape's own drawing), relative to its node. */
export function boxTopTransform(p: Pick<ShapePose, "rise">): string | undefined {
	return p.rise > 0 ? `translateZ(${round(p.rise)}px)` : undefined;
}

export type BoxSide = "n" | "e" | "s" | "w";

export interface BoxWall {
	side: BoxSide;
	left: number;
	top: number;
	width: number;
	height: number;
	transformOrigin: string;
	transform: string;
}

/**
 * The four walls of a `box` shape, in its node's px frame: each a flat strip along one
 * edge of the box, folded up about that edge (like the map's cliff walls) so it reaches
 * from the ground to the top, its face outward. None while the box has no height. Pure.
 */
export function boxWalls(p: Pick<ShapePose, "rise" | "width" | "height" | "zoom">): BoxWall[] {
	const h = round(p.rise);
	if (!(h > 0)) return [];
	const w = round(p.width * p.zoom);
	const d = round(p.height * p.zoom);
	return [
		{
			side: "n",
			left: 0,
			top: 0,
			width: w,
			height: h,
			transformOrigin: "50% 0%",
			transform: "rotateX(90deg)",
		},
		{
			side: "e",
			left: round(w - h),
			top: 0,
			width: h,
			height: d,
			transformOrigin: "100% 50%",
			transform: "rotateY(90deg)",
		},
		{
			side: "s",
			left: 0,
			top: round(d - h),
			width: w,
			height: h,
			transformOrigin: "50% 100%",
			transform: "rotateX(-90deg)",
		},
		{
			side: "w",
			left: 0,
			top: 0,
			width: h,
			height: d,
			transformOrigin: "0% 50%",
			transform: "rotateY(-90deg)",
		},
	];
}

/**
 * A `box` shape's wall colour: its fill (`style.fill`, else `color`) — the walls darken
 * it with an overlay ({@link wallShade}) — or a neutral grey when it has none usable.
 */
export function wallColor(shape: ShapeData): string {
	const color = (shape as { color?: unknown }).color;
	const fill = shape.style?.fill ?? (typeof color === "string" ? color : undefined);
	if (typeof fill !== "string") return "#9e9e9e";
	const f = fill.trim().toLowerCase();
	if (f === "" || f === "none" || f === "transparent") return "#9e9e9e";
	return fill;
}

/** The darkening overlay of a wall: east/west a touch darker, as the map's cliffs. */
export function wallShade(side: BoxSide): string {
	return `inset 0 0 0 9999px rgba(0,0,0,${side === "e" || side === "w" ? 0.35 : 0.22})`;
}

/**
 * CSS for a 3D shape's shadow, at its anchor on the ground: a soft ellipse along the
 * heading — at the foot of a `stand` shape, under a `float` one. It grows in with the
 * view (`raise`): the flat board has no shadows. `null` for a `box` (it sits on the
 * ground).
 */
export function shadowStyle(p: ShapePose): {
	transform: string;
	width: number;
	height: number;
	opacity: number;
} | null {
	if (p.mode === "box") return null;
	const float = p.mode === "float";
	const width = Math.max(4, p.width * p.zoom * 0.9);
	const height = float
		? Math.max(2, p.height * p.zoom * 0.9)
		: Math.max(2, Math.min(p.width, p.height) * p.zoom * 0.3);
	return {
		transform: `translateZ(${round(p.lift + SHADOW_LIFT_PX)}px) rotateZ(${round(p.face)}deg) translate(-50%, -50%)`,
		width: round(width),
		height: round(height),
		opacity: round(p.raise * (float ? 0.7 : 1)),
	};
}

/** How many 3D shapes are drawn, and how. */
export interface Css3dShapeLimits {
	/** Shapes smaller than this on screen (px, longer side) stay flat. */
	minPx: number;
	/** At most this many shapes are drawn in 3D — the nearest (lowest on screen) win. */
	maxCount: number;
	/** Shapes holding no 3D parameters still lie on the terrain's height where it is
	 *  raised (drawn here as a flat `float` of height 0), instead of on the board at 0.
	 *  Default `true`. */
	groundFlat: boolean;
}

export const DEFAULT_CSS3D_SHAPE_LIMITS: Css3dShapeLimits = {
	minPx: 8,
	maxCount: 200,
	groundFlat: true,
};

/** What a shape holding no 3D parameters is drawn as on raised ground: flat, at its height. */
export const GROUND_FLAT_PARAMS: Shape3dParams = {
	mode: "float",
	height: 0,
	facing: "camera",
	ground: true,
	shadow: false,
	collision: "none",
};

export interface Shape3dEntry {
	shape: ShapeData;
	params: Shape3dParams;
}

/**
 * The shapes to draw in 3D now (in z-order). Only while the view is (partly) 3D, never
 * in the global LOD mode, and only shapes whose anchor is on the drawn ground: the board
 * box grown by the 3D view's overscan. A depth layer isn't clipped by the draw distance,
 * so a shape farther out would stand in the sky past the ground's end. With
 * `limits.groundFlat` and a `heightAt`, a shape holding no 3D parameters whose centre is
 * on raised ground is drawn too, lying flat at that height ({@link GROUND_FLAT_PARAMS}).
 * Pure.
 */
export function selectShapes3d(input: {
	shapes: readonly ShapeData[];
	types: Css3dShapeTypes;
	viewport: Viewport;
	viewportBounds: BoundingBox;
	/** Screen px the 3D view shows past the board box (`bg-grid:set-overscan`). */
	overscanPx: number;
	renderMode: RenderMode;
	amount: number;
	limits: Css3dShapeLimits;
	/** The terrain's height (world units) for `limits.groundFlat`; absent = no terrain. */
	heightAt?: (x: number, y: number) => number;
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
		// Size and place first: they need no terrain, so a shape too small or off screen never
		// samples `heightAt` (on a wide board that thrashes the terrain's chunk cache every frame).
		if (Math.max(shape.width, shape.height) * zoom < input.limits.minPx) continue;
		const own = resolveShapeView3d(shape, input.types[shape.type]);
		const at = shapeAnchor(shape, own?.mode ?? GROUND_FLAT_PARAMS.mode);
		if (at.x < x0 || at.x > x1 || at.y < y0 || at.y > y1) continue;
		const params = own ?? groundFlatParams(shape, input);
		if (!params) continue;
		found.push({ shape, params, screenY: worldToScreen(at.x, at.y, input.viewport).y });
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

/** {@link GROUND_FLAT_PARAMS} for a parameterless shape on raised ground, else `null`. */
function groundFlatParams(
	shape: ShapeData,
	input: {
		types: Css3dShapeTypes;
		limits: Css3dShapeLimits;
		heightAt?: (x: number, y: number) => number;
	},
): Shape3dParams | null {
	if (!input.limits.groundFlat || !input.heightAt) return null;
	if (!shapeTypeModes(input.types[shape.type]).includes("float")) return null;
	const at = shapeAnchor(shape, "float");
	const h = input.heightAt(at.x, at.y);
	return Number.isFinite(h) && h > 0 ? GROUND_FLAT_PARAMS : null;
}

function clamp01(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.min(1, Math.max(0, n));
}

function round(n: number): number {
	return Math.round(n * 1000) / 1000;
}
